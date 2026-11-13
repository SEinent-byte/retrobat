namespace RetroBat.Services.Games;

/// <summary>
/// Resolves RetroBat install paths. The launcher is bundled inside a RetroBat
/// install, so the root is the first ancestor of the app directory that
/// contains RetroBat.exe (or an emulationstation\ folder). Falls back to the
/// app directory.
/// </summary>
public sealed class RetrobatPaths
{
    public string RootDir { get; }

    public RetrobatPaths(string? rootOverride = null)
    {
        RootDir = rootOverride ?? FindRoot(AppBaseDir());
    }

    /// <summary>
    /// Directory of the running executable. Uses <see cref="Environment.ProcessPath"/>
    /// so it stays correct for single-file self-contained builds, whose
    /// <see cref="AppContext.BaseDirectory"/> points at a temp extraction dir.
    /// </summary>
    public static string AppBaseDir()
    {
        var exe = Environment.ProcessPath;
        return !string.IsNullOrEmpty(exe)
            ? Path.GetDirectoryName(exe)!
            : AppContext.BaseDirectory;
    }

    public string RomsDir(string retrobatFolder) =>
        Path.Combine(RootDir, "roms", retrobatFolder);

    public string EmulatorLauncherExe =>
        Path.Combine(RootDir, "emulationstation", "emulatorLauncher.exe");

    /// <summary>RetroArch executable bundled with the distribution.</summary>
    public string RetroArchExe =>
        Path.Combine(RootDir, "emulators", "retroarch", "retroarch.exe");

    /// <summary>libretro cores directory.</summary>
    public string CoresDir =>
        Path.Combine(RootDir, "emulators", "retroarch", "cores");

    /// <summary>EmulationStation home (holds es_systems.cfg, themes, settings).</summary>
    public string EmulationStationHome =>
        Path.Combine(RootDir, "emulationstation", ".emulationstation");

    private static string FindRoot(string start)
    {
        var dir = new DirectoryInfo(start);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "RetroBat.exe")) ||
                Directory.Exists(Path.Combine(dir.FullName, "emulationstation")) ||
                // Standalone (distro) layout: ES binary sits at the root.
                File.Exists(Path.Combine(dir.FullName, "emulationstation.exe")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return start;
    }
}
