using RetroBat.Core.Branding;
using RetroBat.Services.Api;

namespace RetroBat.Services.Update;

/// <summary>Outcome of an update check.</summary>
/// <param name="UpdateAvailable">A newer build than this one is published.</param>
/// <param name="Mandatory">This build is below the server's minimum; it must
/// update before continuing.</param>
public sealed record UpdateInfo(
    bool UpdateAvailable,
    bool Mandatory,
    string LatestVersion,
    string CurrentVersion,
    string DownloadUrl,
    string? Notes);

/// <summary>
/// Checks the backend for a newer desktop client build (SPEC auto-update).
/// Best-effort and non-blocking: any failure returns null so startup is never
/// gated on the network. The server stays the source of truth for the version.
/// </summary>
public sealed class UpdateChecker(ApiClient api)
{
    private readonly ApiClient _api = api;

    public async Task<UpdateInfo?> CheckAsync(CancellationToken ct = default)
    {
        try
        {
            var v = await _api.GetClientVersionAsync(ct).ConfigureAwait(false);
            var current = BrandInfo.AppVersion;
            var newer = Compare(v.LatestVersion, current) > 0;
            var mandatory = Compare(current, v.MinVersion) < 0;
            return new UpdateInfo(
                newer || mandatory, mandatory,
                v.LatestVersion, current, v.DownloadUrl, v.Notes);
        }
        catch
        {
            return null; // never block on the updater
        }
    }

    /// <summary>
    /// Compare two dotted numeric versions ("1.2.3"). Returns &gt;0 if a is
    /// newer than b, &lt;0 if older, 0 if equal. Non-numeric or missing parts
    /// count as 0, so malformed input never throws.
    /// </summary>
    internal static int Compare(string a, string b)
    {
        var pa = Parts(a);
        var pb = Parts(b);
        var n = Math.Max(pa.Length, pb.Length);
        for (var i = 0; i < n; i++)
        {
            var x = i < pa.Length ? pa[i] : 0;
            var y = i < pb.Length ? pb[i] : 0;
            if (x != y)
                return x < y ? -1 : 1;
        }
        return 0;
    }

    private static int[] Parts(string v)
    {
        if (string.IsNullOrWhiteSpace(v))
            return [];
        // Drop any pre-release / build suffix (e.g. "1.2.3-beta").
        var core = v.Split('-', '+')[0];
        var segs = core.Split('.');
        var parts = new int[segs.Length];
        for (var i = 0; i < segs.Length; i++)
            parts[i] = int.TryParse(segs[i], out var p) ? p : 0;
        return parts;
    }
}
