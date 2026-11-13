using System.Diagnostics;
using System.IO;
using System.Windows;
using RetroBat.Core.Contracts;
using RetroBat.Core.Security;
using RetroBat.Services;
using RetroBat.Services.Api;
using RetroBat.Services.Auth;
using RetroBat.Services.Games;

namespace RetroBat.Launcher;

/// <summary>
/// Transparent proxy installed as RetroBat's emulatorLauncher.exe. When
/// EmulationStation launches a game, this runs first:
///  - if the ROM is a CatalogSync stub (not downloaded), it validates the
///    license, pulls a presigned R2 URL, downloads the real ROM over the stub
///    (with a progress window) and records a play-start event;
///  - then it hands the original arguments to the real launcher
///    (emulatorLauncher_real.exe) and waits;
///  - on exit it records a play-end event.
/// Already-downloaded ROMs pass straight through.
/// </summary>
public partial class App : Application
{
    private const string RealLauncherName = "emulatorLauncher_real.exe";

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        int exitCode;
        try
        {
            exitCode = await RunAsync(e.Args).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            Fatal(ex.Message);
            exitCode = 1;
        }
        Shutdown(exitCode);
    }

    private async Task<int> RunAsync(string[] args)
    {
        var baseDir = AppContext.BaseDirectory;
        var paths = new RetrobatPaths();

        var romPath = ArgValue(args, "-rom");
        var core = ArgValue(args, "-core");
        var gameId = romPath is not null && CatalogSync.IsStub(romPath)
            ? CatalogSync.ReadStubGameId(romPath)
            : null;

        var needDownload = romPath is not null && gameId is not null;
        var config = ClientConfig.Default;
        var api = new ApiClient(config);
        var session = new SessionManager(
            api, new TokenStore(), new GoogleOAuthFlow(config), new ClockGuard());

        // "Mi Cuenta" entry: open the account menu instead of launching a game.
        if (romPath is not null && CatalogSync.IsAccount(romPath))
        {
            var sync = new CatalogSync(api, session, paths);
            new AccountMenuWindow(session, sync).ShowDialog();
            return 0;
        }

        if (needDownload)
        {
            if (!session.LoadPersisted())
            {
                Fatal("Please open the RetroBat app and sign in first.");
                return 1;
            }

            var window = new ProgressWindow();
            window.Show();
            try
            {
                window.SetStatus("Checking your license…");
                var dl = await session
                    .AuthorizedAsync((t) => api.GetDownloadUrlAsync(t, gameId!))
                    .ConfigureAwait(true);

                window.SetStatus($"Downloading {Path.GetFileName(romPath!)}…");
                var progress = new Progress<double>(window.SetProgress);
                await new HttpDownloadManager()
                    .DownloadAsync(dl.Url, romPath!, progress)
                    .ConfigureAwait(true);

                window.SetIndeterminate();
                window.SetStatus("Starting game…");
                await PostPlay(session, api, gameId!, PlayAction.Start, null)
                    .ConfigureAwait(true);
            }
            catch (ApiException ex) when (ex.Code == ApiErrorCode.LicenseRequired)
            {
                window.Close();
                Fatal("This game needs an active trial or subscription.");
                return 1;
            }
            catch (Exception ex)
            {
                window.Close();
                Fatal("Download failed: " + ex.Message);
                return 1;
            }
            window.Close();
        }

        var startedAt = DateTimeOffset.UtcNow;
        var exitCode = await LaunchGameAsync(paths, baseDir, core, romPath, args)
            .ConfigureAwait(true);

        if (needDownload)
        {
            var duration = (int)(DateTimeOffset.UtcNow - startedAt).TotalSeconds;
            try
            {
                await PostPlay(session, api, gameId!, PlayAction.End, duration)
                    .ConfigureAwait(true);
            }
            catch
            {
                // analytics best-effort
            }
        }
        return exitCode;
    }

    private static Task PostPlay(
        SessionManager session, ApiClient api, string gameId, PlayAction action, int? dur) =>
        session.AuthorizedAsync((t) =>
            api.PostPlayEventAsync(t, new PlayEventRequest(gameId, action, dur)));

    /// <summary>
    /// Launch the game. Standalone (distro) mode runs RetroArch directly with
    /// the system's core; if that is not available it falls back to a bundled
    /// RetroBat launcher (emulatorLauncher_real.exe) for RetroBat-mode installs.
    /// </summary>
    private async Task<int> LaunchGameAsync(
        RetrobatPaths paths, string baseDir, string? core, string? romPath, string[] args)
    {
        var retroArch = paths.RetroArchExe;
        var corePath = core is not null
            ? Path.Combine(paths.CoresDir, $"{core}_libretro.dll")
            : null;

        // Distro mode: RetroArch directly with the requested core.
        if (romPath is not null && corePath is not null &&
            File.Exists(retroArch) && File.Exists(corePath))
        {
            return await LaunchViaRetroArchAsync(retroArch, corePath, romPath)
                .ConfigureAwait(true);
        }

        // Fallback: RetroBat's original launcher, if present.
        var realLauncher = Path.Combine(baseDir, RealLauncherName);
        if (File.Exists(realLauncher))
            return await LaunchRealAsync(realLauncher, args).ConfigureAwait(true);

        Fatal(
            core is not null
                ? $"Emulator core not found: {core}. Reinstall the app."
                : $"{RealLauncherName} not found next to the launcher.");
        return 1;
    }

    private static async Task<int> LaunchViaRetroArchAsync(
        string retroArchExe, string corePath, string romPath)
    {
        var psi = new ProcessStartInfo(retroArchExe)
        {
            WorkingDirectory = Path.GetDirectoryName(retroArchExe)!,
            UseShellExecute = false,
        };
        psi.ArgumentList.Add("-L");
        psi.ArgumentList.Add(corePath);
        psi.ArgumentList.Add(romPath);

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("failed to start RetroArch");
        await proc.WaitForExitAsync().ConfigureAwait(true);
        return proc.ExitCode;
    }

    private static async Task<int> LaunchRealAsync(string realLauncher, string[] args)
    {
        var psi = new ProcessStartInfo(realLauncher)
        {
            WorkingDirectory = Path.GetDirectoryName(realLauncher)!,
            UseShellExecute = false,
        };
        foreach (var a in args)
            psi.ArgumentList.Add(a);

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("failed to start real launcher");
        await proc.WaitForExitAsync().ConfigureAwait(true);
        return proc.ExitCode;
    }

    /// <summary>Value following a flag in the args, or null.</summary>
    private static string? ArgValue(string[] args, string flag)
    {
        for (var i = 0; i < args.Length - 1; i++)
            if (string.Equals(args[i], flag, StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        return null;
    }

    private static void Fatal(string message) =>
        MessageBox.Show(message, "RetroBat", MessageBoxButton.OK, MessageBoxImage.Warning);
}
