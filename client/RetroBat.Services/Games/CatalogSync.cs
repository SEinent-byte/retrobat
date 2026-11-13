using System.Linq;
using System.Text;
using System.Xml.Linq;
using RetroBat.Core.Contracts;
using RetroBat.Services.Account;
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

    /// <summary>Marker prefix identifying the "Mi Cuenta" account entry (a
    /// pseudo-ROM the launch proxy turns into the account menu, not a game).</summary>
    public const string AccountPrefix = "RBACCT:";

    /// <summary>Base filename (without extension) of the account pseudo-ROM.
    /// Leading underscore keeps it first in the console's game list.</summary>
    private const string AccountFileBase = "_mi_cuenta";

    /// <summary>Artwork filename for the account entry (EmulationStation renders
    /// SVG via nanosvg).</summary>
    private const string AccountImageFile = "_mi_cuenta.svg";

    /// <summary>Simple user-avatar icon shown for the "Mi Cuenta" entry.</summary>
    private const string AccountImageSvg =
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 256 256\">" +
        "<rect width=\"256\" height=\"256\" rx=\"32\" fill=\"#1f6feb\"/>" +
        "<circle cx=\"128\" cy=\"100\" r=\"44\" fill=\"#ffffff\"/>" +
        "<path d=\"M48 216c0-44 36-72 80-72s80 28 80 72z\" fill=\"#ffffff\"/>" +
        "</svg>";

    /// <summary>Fetch the catalog and materialize stubs + gamelists. Returns the
    /// number of game entries written. <paramref name="status"/> is the current
    /// license state used for the "Mi Cuenta" entry; when null it is fetched.</summary>
    public async Task<int> SyncAsync(
        LicenseState? status = null, string? email = null, CancellationToken ct = default)
    {
        var catalog = await session
            .AuthorizedAsync((token) => api.GetCatalogAsync(token, ct), ct)
            .ConfigureAwait(false);

        status ??= await session.GetStatusAsync(ct).ConfigureAwait(false);

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

        var acctShort = AccountStatusText.Short(status);
        var acctDesc = AccountStatusText.Full(status, email);
        foreach (var (folder, games) in byFolder)
        {
            var dir = paths.RomsDir(folder);
            var acctFile = WriteAccountEntry(dir, games);
            WriteGameList(dir, games, acctFile, acctShort, acctDesc);
        }

        WriteEsSystems(catalog.Systems);

        return catalog.Games.Count;
    }

    /// <summary>
    /// Generate the standalone EmulationStation systems config from the catalog
    /// (one &lt;system&gt; per console, each launching our launcher with the
    /// system's default core).
    /// <para>
    /// In the distro layout the real <c>es_systems.cfg</c> is written straight
    /// into the ES home at the install root, with <c>%HOME%\launcher.exe</c> and
    /// <c>~\roms\&lt;folder&gt;</c> paths (both resolve to the install root when ES
    /// runs with that home). In a RetroBat dev install it is written as a
    /// <c>.dist</c> sidecar instead, so the real config is never clobbered.
    /// </para>
    /// </summary>
    private void WriteEsSystems(IReadOnlyList<SystemDto> systems)
    {
        var home = paths.EmulationStationHome;
        if (!Directory.Exists(home))
            return;

        var distro = paths.IsDistro;
        var launcher = paths.LauncherExeName;

        var root = new XElement("systemList");
        foreach (var s in systems)
        {
            var ext = string.Join(
                " ",
                s.Extensions.Select((e) => e.Trim()).Where((e) => e.Length > 0));
            var coreArgs = string.IsNullOrEmpty(s.DefaultCore)
                ? ""
                : $" -core {s.DefaultCore}";
            var command =
                $"\"%HOME%\\{launcher}\" -system {s.Id}{coreArgs} -rom %ROM%";
            // Distro ES home sits at the install root, so ~ already points there;
            // a RetroBat dev home is one level under emulationstation\, so hop up.
            var romPath = distro
                ? $"~\\roms\\{s.RetrobatFolder}"
                : $"~\\..\\roms\\{s.RetrobatFolder}";

            root.Add(new XElement(
                "system",
                new XElement("name", s.Id),
                new XElement("fullname", s.Name),
                new XElement("path", romPath),
                new XElement("extension", ext),
                new XElement("command", command),
                new XElement("platform", s.Id),
                new XElement("theme", s.Id)));
        }

        var fileName = distro ? "es_systems.cfg" : "es_systems.cfg.dist";
        new XDocument(root).Save(Path.Combine(home, fileName));
    }

    /// <summary>True when the file is the "Mi Cuenta" account pseudo-ROM.</summary>
    public static bool IsAccount(string path)
    {
        try
        {
            if (!File.Exists(path))
                return false;
            if (new FileInfo(path).Length > 256)
                return false;
            var text = File.ReadAllText(path, Encoding.ASCII);
            return text.StartsWith(AccountPrefix, StringComparison.Ordinal);
        }
        catch
        {
            return false;
        }
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

    /// <summary>Write the account pseudo-ROM into a console folder, reusing the
    /// console's own ROM extension so EmulationStation lists it. Returns the
    /// filename to reference from gamelist.xml.</summary>
    private static string WriteAccountEntry(string dir, IReadOnlyList<GameDto> games)
    {
        var ext = Path.GetExtension(games[0].RomFilename);
        if (string.IsNullOrEmpty(ext))
            ext = ".zip";
        var fileName = AccountFileBase + ext;
        File.WriteAllText(Path.Combine(dir, fileName), AccountPrefix, Encoding.ASCII);
        File.WriteAllText(Path.Combine(dir, AccountImageFile), AccountImageSvg, Encoding.UTF8);
        return fileName;
    }

    private static void WriteGameList(
        string dir,
        IReadOnlyList<GameDto> games,
        string accountFile,
        string accountShort,
        string accountDesc)
    {
        var list = new XElement("gameList");

        // "Mi Cuenta" first so it sits at the top of the console's list.
        list.Add(new XElement(
            "game",
            new XElement("path", "./" + accountFile),
            new XElement("name", "Mi Cuenta — " + accountShort),
            new XElement("desc", accountDesc),
            new XElement("image", "./" + AccountImageFile)));

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
