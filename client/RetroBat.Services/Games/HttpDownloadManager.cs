namespace RetroBat.Services.Games;

/// <summary>
/// Downloads a ROM straight from the server over HTTPS (the presigned R2 URL),
/// streaming to disk with progress. No external downloader. Writes to a temp
/// file and moves it into place so a partial download never leaves a broken
/// ROM where a stub was.
/// </summary>
public sealed class HttpDownloadManager(HttpClient? http = null)
{
    private readonly HttpClient _http = http ?? new HttpClient();

    public async Task DownloadAsync(
        string url,
        string destPath,
        IProgress<double>? progress = null,
        CancellationToken ct = default)
    {
        var dir = Path.GetDirectoryName(destPath)!;
        Directory.CreateDirectory(dir);
        var tmp = destPath + ".part";

        using (var res = await _http
            .GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct)
            .ConfigureAwait(false))
        {
            if (!res.IsSuccessStatusCode)
                throw new DownloadException($"server returned {(int)res.StatusCode}");

            var total = res.Content.Headers.ContentLength ?? -1L;
            await using var src = await res.Content
                .ReadAsStreamAsync(ct)
                .ConfigureAwait(false);
            await using var dst = new FileStream(
                tmp, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 16, true);

            var buffer = new byte[1 << 16];
            long readTotal = 0;
            int n;
            while ((n = await src.ReadAsync(buffer, ct).ConfigureAwait(false)) > 0)
            {
                await dst.WriteAsync(buffer.AsMemory(0, n), ct).ConfigureAwait(false);
                readTotal += n;
                if (total > 0)
                    progress?.Report(Math.Clamp((double)readTotal / total, 0, 1));
            }
        }

        File.Move(tmp, destPath, overwrite: true);
    }
}

public sealed class DownloadException(string message) : Exception(message);
