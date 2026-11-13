using RetroBat.Core.Contracts;
using RetroBat.Services.Api;

namespace RetroBat.Services.Games;

/// <summary>
/// Orchestrates the play pipeline (SPEC §7, §14 step 7): fetch catalog,
/// download a ROM on demand, launch the emulator, and bracket the session
/// with play-event analytics. Access is always re-validated by the server
/// (the download URL call); the client only relays.
/// </summary>
public sealed class GameService(
    ApiClient api,
    SessionManager session,
    RetrobatPaths paths,
    Aria2DownloadManager downloader,
    EmulatorLauncher launcher)
{
    public Task<CatalogResponse> GetCatalogAsync(CancellationToken ct = default) =>
        session.AuthorizedAsync((token) => api.GetCatalogAsync(token, ct), ct);

    /// <summary>Ensure the ROM is present, then launch it and record play events.</summary>
    public async Task PlayAsync(
        GameDto game,
        IProgress<double>? downloadProgress = null,
        CancellationToken ct = default)
    {
        var dl = await session
            .AuthorizedAsync((token) => api.GetDownloadUrlAsync(token, game.Id, ct), ct)
            .ConfigureAwait(false);

        var romsDir = paths.RomsDir(dl.RetrobatFolder);
        var destPath = Path.Combine(romsDir, dl.RomFilename);

        if (!IsPresent(destPath, dl.SizeBytes))
        {
            await downloader.DownloadAsync(dl.Url, destPath, downloadProgress, ct)
                .ConfigureAwait(false);
        }

        await PostPlayAsync(game.Id, PlayAction.Start, null, ct).ConfigureAwait(false);

        var duration = await launcher
            .LaunchAsync(dl.RetrobatFolder, dl.DefaultCore, destPath, ct)
            .ConfigureAwait(false);

        await PostPlayAsync(game.Id, PlayAction.End, duration, ct).ConfigureAwait(false);
    }

    private Task PostPlayAsync(
        string gameId, PlayAction action, int? durationSec, CancellationToken ct) =>
        session.AuthorizedAsync(
            (token) => api.PostPlayEventAsync(
                token, new PlayEventRequest(gameId, action, durationSec), ct),
            ct);

    private static bool IsPresent(string path, long expectedSize) =>
        File.Exists(path) &&
        (expectedSize <= 0 || new FileInfo(path).Length == expectedSize);
}
