using System.Diagnostics;

namespace RetroBat.Services.Games;

/// <summary>
/// Launches a ROM through RetroBat's emulatorLauncher.exe using the system's
/// folder + default libretro core (SPEC §7.1), and waits for it to exit so a
/// play-session duration can be measured.
/// </summary>
public sealed class EmulatorLauncher(RetrobatPaths paths)
{
    /// <summary>Launch and block until the emulator closes.</summary>
    /// <returns>Seconds the session lasted.</returns>
    public async Task<int> LaunchAsync(
        string retrobatFolder,
        string? defaultCore,
        string romPath,
        CancellationToken ct = default)
    {
        var exe = paths.EmulatorLauncherExe;
        if (!File.Exists(exe))
            throw new FileNotFoundException("emulatorLauncher.exe not found", exe);
        if (!File.Exists(romPath))
            throw new FileNotFoundException("ROM not found", romPath);

        var psi = new ProcessStartInfo(exe)
        {
            WorkingDirectory = Path.GetDirectoryName(exe)!,
            UseShellExecute = false,
        };
        psi.ArgumentList.Add("-system");
        psi.ArgumentList.Add(retrobatFolder);
        if (!string.IsNullOrEmpty(defaultCore))
        {
            psi.ArgumentList.Add("-emulator");
            psi.ArgumentList.Add("libretro");
            psi.ArgumentList.Add("-core");
            psi.ArgumentList.Add(defaultCore);
        }
        psi.ArgumentList.Add("-rom");
        psi.ArgumentList.Add(romPath);

        var startedAt = DateTimeOffset.UtcNow;
        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("failed to start emulatorLauncher");
        await proc.WaitForExitAsync(ct).ConfigureAwait(false);

        var seconds = (int)(DateTimeOffset.UtcNow - startedAt).TotalSeconds;
        return Math.Max(0, seconds);
    }
}
