using System.Xml.Linq;

namespace RetroBat.Services.Games;

/// <summary>
/// Seeds a just-installed standalone distro so the user can reach sign-in
/// before any server catalog exists. A fresh install ships an es_systems.cfg
/// (the consoles) but no gamelists and no "Mi Cuenta" entry — those are written
/// by <see cref="CatalogSync"/> only after login, which the user cannot reach
/// without an entry to select. This writes a single pre-login "Mi Cuenta" entry
/// into one welcome console so EmulationStation shows it; selecting it opens the
/// account menu, and the first login re-syncs the real catalog over the seed.
/// </summary>
public static class FirstRunSeed
{
    /// <summary>Write the pre-login welcome entry into the first console declared
    /// by the install's es_systems.cfg. Returns the roms folder seeded, or null
    /// when there is no systems config to seed from. Idempotent: a later catalog
    /// sync overwrites the entry (and a real ROM is never a stub/account file).</summary>
    public static string? Seed(RetrobatPaths paths)
    {
        var cfg = Path.Combine(paths.EmulationStationHome, "es_systems.cfg");
        if (!File.Exists(cfg))
            return null;

        var system = XDocument.Load(cfg).Root?.Elements("system").FirstOrDefault();
        if (system is null)
            return null;

        var folder = FolderFromPath((string?)system.Element("path"));
        var ext = FirstExtension((string?)system.Element("extension"));
        if (folder is null || ext is null)
            return null;

        CatalogSync.WriteAccountOnly(paths.RomsDir(folder), ext);
        return folder;
    }

    /// <summary>Last path segment of an es_systems path like <c>~\roms\nes</c>.</summary>
    private static string? FolderFromPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return null;
        var seg = path.Replace('/', '\\').TrimEnd('\\').Split('\\');
        var last = seg.Length > 0 ? seg[^1].Trim() : "";
        return last.Length > 0 ? last : null;
    }

    /// <summary>First space-separated token of an es_systems extension list.</summary>
    private static string? FirstExtension(string? extensions)
    {
        if (string.IsNullOrWhiteSpace(extensions))
            return null;
        var first = extensions
            .Split([' ', '\t', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault();
        return string.IsNullOrEmpty(first) ? null : first;
    }
}
