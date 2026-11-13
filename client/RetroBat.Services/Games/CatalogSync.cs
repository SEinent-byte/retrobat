using System.Text;
using System.Xml.Linq;
using RetroBat.Core.Contracts;
using RetroBat.Services.Api;

namespace RetroBat.Services.Games;

/// <summary>
/// Projects the server catalog into the RetroBat EmulationStation library so
/// games show up inside RetroBat itself (not a separate storefront). For each
/// game it writes a small STUB file at roms\&lt;folder&gt;\&lt;romFilename&gt; carrying
/// the game id, and a gamelist.xml per console with the titles. The launch
/// proxy (emulatorLauncher.exe) later replaces a stub with the real ROM on
/// demand. Already-downloaded real ROMs are never overwritten.
/// </summary>
public sealed class CatalogSync(ApiClient api, SessionManager session, RetrobatPaths paths)
{
    /// <summary>Marker prefix identifying a not-yet-downloaded stub ROM.</summary>
    public const string StubPrefix = "RBSTUB:";

    /// <summary>Fetch the catalog and materialize stubs + gamelists. Returns the
    /// number of game entries written.</summary>
    public async Task<int> SyncAsync(CancellationToken ct = default)
    {
        var catalog = await session
            .AuthorizedAsync((token) => api.GetCatalogAsync(token, ct), ct)
            .ConfigureAwait(false);

        var systems = catalog.Systems.ToDictionary(s => s.Id);
        var byFolder = new Dictionary<string, List<GameDto>>();

        foreach (var game in catalog.Games)
        {
            if (!systems.TryGetValue(game.SystemId, out var sys))
                continue;
            var dir = paths.RomsDir(sys.RetrobatFolder);
            Directory.CreateDirectory(dir);
            WriteStubIfAbsent(Path.Combine(dir, game.RomFilename), game.Id);

            if (!byFolder.TryGetValue(sys.RetrobatFolder, out var list))
                byFolder[sys.RetrobatFolder] = list = [];
            list.Add(game);
        }

        foreach (var (folder, games) in byFolder)
            WriteGameList(paths.RomsDir(folder), games);

        return catalog.Games.Count;
    }

    /// <summary>True when the file is a sync stub (not a real downloaded ROM).</summary>
    public static bool IsStub(string path)
    {
        try
        {
            if (!File.Exists(path))
                return false;
            var info = new FileInfo(path);
            if (info.Length > 256)
                return false; // real ROMs are larger than any stub
            using var fs = File.OpenRead(path);
            var buf = new byte[StubPrefix.Length];
            var read = fs.Read(buf, 0, buf.Length);
            return read == buf.Length &&
                Encoding.ASCII.GetString(buf) == StubPrefix;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Read the game id embedded in a stub file, or null.</summary>
    public static string? ReadStubGameId(string path)
    {
        try
        {
            var text = File.ReadAllText(path, Encoding.ASCII);
            if (!text.StartsWith(StubPrefix, StringComparison.Ordinal))
                return null;
            return text[StubPrefix.Length..].Trim();
        }
        catch
        {
            return null;
        }
    }

    private static void WriteStubIfAbsent(string path, string gameId)
    {
        // Preserve a real ROM already downloaded here; only (re)write stubs.
        if (File.Exists(path) && !IsStub(path))
            return;
        File.WriteAllText(path, StubPrefix + gameId, Encoding.ASCII);
    }

    private static void WriteGameList(string dir, IReadOnlyList<GameDto> games)
    {
        var list = new XElement("gameList");
        foreach (var g in games)
        {
            list.Add(new XElement(
                "game",
                new XElement("path", "./" + g.RomFilename),
                new XElement("name", g.Title)));
        }
        new XDocument(list).Save(Path.Combine(dir, "gamelist.xml"));
    }
}
