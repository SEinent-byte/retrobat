using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using RetroBat.Core.Branding;
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
        var baseDir = RetrobatPaths.AppBaseDir();
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

        // Start-menu "Mi Cuenta" entry (ES passes -account): open the account menu
        // directly, with no game rom. Refresh the top-left status on close.
        if (HasFlag(args, "-account"))
        {
            var sync = new CatalogSync(api, session, paths);
            session.LoadPersisted();
            new AccountMenuWindow(session, sync).ShowDialog();
            await WriteStatusAfterMenu(session, paths).ConfigureAwait(true);
            return 0;
        }

        // Legacy "Mi Cuenta" pseudo-ROM entry: open the account menu instead of a
        // game. Kept for pre-login first-run seeds; the live sync no longer writes it.
        if (romPath is not null && CatalogSync.IsAccount(romPath))
        {
            var sync = new CatalogSync(api, session, paths);
            new AccountMenuWindow(session, sync).ShowDialog();
            await WriteStatusAfterMenu(session, paths).ConfigureAwait(true);
            return 0;
        }

        if (needDownload)
        {
            if (!session.LoadPersisted())
            {
                Fatal($"Please open {BrandInfo.Name} and sign in first.");
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

        // One-time per-system controls help (ES "basic" view hides descriptions).
        ControlsCard.ShowOnce(ArgValue(args, "-system"));

        var startedAt = DateTimeOffset.UtcNow;
        var exitCode = await LaunchGameAsync(
                paths, baseDir, core, romPath, ArgValue(args, "-system"), args)
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
        RetrobatPaths paths, string baseDir, string? core, string? romPath,
        string? system, string[] args)
    {
        var retroArch = paths.RetroArchExe;
        var corePath = core is not null
            ? Path.Combine(paths.CoresDir, $"{core}_libretro.dll")
            : null;

        // Distro mode: RetroArch directly with the requested core.
        if (romPath is not null && corePath is not null &&
            File.Exists(retroArch) && File.Exists(corePath))
        {
            return await LaunchViaRetroArchAsync(retroArch, corePath, romPath, system)
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

    // Systems whose movement is the analog stick (3D). Everything else uses the
    // d-pad. Drives which keyboard-movement overlay is layered on at launch.
    private static readonly HashSet<string> AnalogSystems =
        new(StringComparer.OrdinalIgnoreCase) { "n64", "psx" };

    private static async Task<int> LaunchViaRetroArchAsync(
        string retroArchExe, string corePath, string romPath, string? system)
    {
        var psi = new ProcessStartInfo(retroArchExe)
        {
            WorkingDirectory = Path.GetDirectoryName(retroArchExe)!,
            UseShellExecute = false,
        };
        psi.ArgumentList.Add("-L");
        psi.ArgumentList.Add(corePath);
        // PlayVault RetroArch overrides, layered on top of the user's
        // retroarch.cfg. The base (borderless window, face buttons, analog binds)
        // plus one per-system movement overlay so "arrows = move" stays identical
        // for the player while routing correctly to stick (3D) or d-pad (2D).
        var cfgDir = Path.GetDirectoryName(retroArchExe)!;
        var cfgs = new List<string>();
        var baseCfg = Path.Combine(cfgDir, "playvault.cfg");
        if (File.Exists(baseCfg))
            cfgs.Add(baseCfg);
        var overlay = Path.Combine(
            cfgDir,
            system is not null && AnalogSystems.Contains(system)
                ? "playvault-analog.cfg"
                : "playvault-dpad.cfg");
        if (File.Exists(overlay))
            cfgs.Add(overlay);
        if (cfgs.Count > 0)
        {
            // RetroArch accepts a comma-separated list; Windows paths carry no comma.
            psi.ArgumentList.Add("--appendconfig");
            psi.ArgumentList.Add(string.Join(",", cfgs));
        }
        psi.ArgumentList.Add(romPath);

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("failed to start RetroArch");
        // Expand the (borderless) RetroArch window to fill the desktop work area,
        // so it opens maximized while the Windows taskbar stays visible.
        _ = MaximizeToWorkAreaAsync(proc);
        // In-game controls overlay: press H during play to toggle the key list.
        using var controlsOverlay = new GameControlsOverlay(system);
        controlsOverlay.Start();
        await proc.WaitForExitAsync().ConfigureAwait(true);
        controlsOverlay.Stop();
        return proc.ExitCode;
    }

    /// <summary>Resize the process's main window to the primary monitor work
    /// area (screen minus the taskbar) once it appears. Best effort.</summary>
    private static async Task MaximizeToWorkAreaAsync(Process proc)
    {
        try
        {
            var hwnd = IntPtr.Zero;
            for (var i = 0; i < 50 && !proc.HasExited; i++)
            {
                proc.Refresh();
                hwnd = proc.MainWindowHandle;
                if (hwnd != IntPtr.Zero)
                    break;
                await Task.Delay(100).ConfigureAwait(true);
            }
            if (hwnd == IntPtr.Zero)
                return;
            // Let RetroArch finish creating/sizing its own window first.
            await Task.Delay(400).ConfigureAwait(true);
            if (SystemParametersInfo(SPI_GETWORKAREA, 0, out var wa, 0))
                MoveWindow(hwnd, wa.Left, wa.Top, wa.Right - wa.Left, wa.Bottom - wa.Top, true);
            // Rebrand the taskbar label away from "RetroArch <core>".
            SetWindowText(hwnd, BrandInfo.Name);
        }
        catch
        {
            // best effort: a normal window is fine if this fails
        }
    }

    private const uint SPI_GETWORKAREA = 0x0030;

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveWindow(
        IntPtr hWnd, int x, int y, int width, int height,
        [MarshalAs(UnmanagedType.Bool)] bool repaint);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SystemParametersInfo(
        uint action, uint param, out Rect rect, uint winIni);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowText(IntPtr hWnd, string text);

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

    /// <summary>Refresh account_status.txt from the current session after the
    /// account menu closes (covers login, logout and trial changes).</summary>
    private static async Task WriteStatusAfterMenu(SessionManager session, RetrobatPaths paths)
    {
        LicenseState? status = null;
        try
        {
            if (session.LoadPersisted())
                status = await session.GetStatusAsync().ConfigureAwait(true);
        }
        catch { /* best effort */ }
        CatalogSync.WriteAccountStatus(paths, status);
    }

    /// <summary>True when the args contain a standalone flag (no value).</summary>
    private static bool HasFlag(string[] args, string flag)
    {
        foreach (var a in args)
            if (string.Equals(a, flag, StringComparison.OrdinalIgnoreCase))
                return true;
        return false;
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
        MessageBox.Show(message, BrandInfo.Name, MessageBoxButton.OK, MessageBoxImage.Warning);
}
