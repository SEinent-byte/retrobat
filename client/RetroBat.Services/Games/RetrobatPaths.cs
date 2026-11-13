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
        RootDir = rootOverride ?? FindRoot(AppContext.BaseDirectory);
    }

    public string RomsDir(string retrobatFolder) =>
        Path.Combine(RootDir, "roms", retrobatFolder);

    public string EmulatorLauncherExe =>
        Path.Combine(RootDir, "emulationstation", "emulatorLauncher.exe");

    /// <summary>aria2c.exe: next to the app (tools\), else in the RetroBat root.</summary>
    public string Aria2Exe
    {
        get
        {
            var local = Path.Combine(AppContext.BaseDirectory, "tools", "aria2c.exe");
            if (File.Exists(local))
                return local;
            return Path.Combine(RootDir, "aria2c.exe");
        }
    }

    private static string FindRoot(string start)
    {
        var dir = new DirectoryInfo(start);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "RetroBat.exe")) ||
                Directory.Exists(Path.Combine(dir.FullName, "emulationstation")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return start;
    }
}
