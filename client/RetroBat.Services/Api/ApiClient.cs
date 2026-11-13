using System.Net.Http.Headers;
using System.Net.Http.Json;
using RetroBat.Core.Contracts;

namespace RetroBat.Services.Api;

/// <summary>
/// Typed client for the Workers API. Adds the X-Api-Version header to every
/// request and maps non-2xx responses to <see cref="ApiException"/>. The
/// client is never the source of truth — it just relays decisions (SPEC §2).
/// </summary>
public sealed class ApiClient
{
    private readonly HttpClient _http;

    public ApiClient(ClientConfig config, HttpClient? http = null)
    {
        _http = http ?? new HttpClient();
        _http.BaseAddress = new Uri(config.ApiBaseUrl);
        _http.DefaultRequestHeaders.Add(ApiJson.ApiVersionHeader, ApiJson.ApiVersion);
    }

    public Task<AuthExchangeResponse> ExchangeAsync(
        AuthExchangeRequest body, CancellationToken ct = default) =>
        PostAsync<AuthExchangeRequest, AuthExchangeResponse>(
            "/auth/exchange", body, null, ct);

    public Task<Session> RefreshAsync(
        string refreshToken, CancellationToken ct = default) =>
        PostAsync<AuthRefreshRequest, Session>(
            "/auth/refresh", new AuthRefreshRequest(refreshToken), null, ct);

    public Task LogoutAsync(
        string sessionToken, string refreshToken, CancellationToken ct = default) =>
        PostAsync<AuthLogoutRequest, object>(
            "/auth/logout", new AuthLogoutRequest(refreshToken), sessionToken, ct);

    public Task<LicenseState> GetLicenseStatusAsync(
        string sessionToken, CancellationToken ct = default) =>
        GetAsync<LicenseState>("/license/status", sessionToken, ct);

    public Task<ActivateTrialResponse> ActivateTrialAsync(
        string sessionToken, DeviceIdentity device, CancellationToken ct = default) =>
        PostAsync<ActivateTrialRequest, ActivateTrialResponse>(
            "/license/activate-trial", new ActivateTrialRequest(device),
            sessionToken, ct);

    public Task<CatalogResponse> GetCatalogAsync(
        string sessionToken, CancellationToken ct = default) =>
        GetAsync<CatalogResponse>("/catalog", sessionToken, ct);

    public Task<DownloadUrlResponse> GetDownloadUrlAsync(
        string sessionToken, string gameId, CancellationToken ct = default) =>
        PostAsync<DownloadUrlRequest, DownloadUrlResponse>(
            "/download/url", new DownloadUrlRequest(gameId), sessionToken, ct);

    public Task<PlayEventResponse> PostPlayEventAsync(
        string sessionToken, PlayEventRequest body, CancellationToken ct = default) =>
        PostAsync<PlayEventRequest, PlayEventResponse>(
            "/play/event", body, sessionToken, ct);

    /* --------------------------- transport --------------------------- */

    private async Task<TRes> GetAsync<TRes>(
        string path, string? bearer, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, path);
        Authorize(req, bearer);
        return await SendAsync<TRes>(req, ct).ConfigureAwait(false);
    }

    private async Task<TRes> PostAsync<TReq, TRes>(
        string path, TReq body, string? bearer, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body, options: ApiJson.Options),
        };
        Authorize(req, bearer);
        return await SendAsync<TRes>(req, ct).ConfigureAwait(false);
    }

    private static void Authorize(HttpRequestMessage req, string? bearer)
    {
        if (!string.IsNullOrEmpty(bearer))
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
    }

    private async Task<TRes> SendAsync<TRes>(
        HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
            throw await ReadErrorAsync(res, ct).ConfigureAwait(false);

        if (typeof(TRes) == typeof(object))
            return default!;

        var value = await res.Content
            .ReadFromJsonAsync<TRes>(ApiJson.Options, ct)
            .ConfigureAwait(false);
        return value ?? throw new ApiException(
            ApiErrorCode.Internal, "empty response body", (int)res.StatusCode);
    }

    private static async Task<ApiException> ReadErrorAsync(
        HttpResponseMessage res, CancellationToken ct)
    {
        var status = (int)res.StatusCode;
        try
        {
            var body = await res.Content
                .ReadFromJsonAsync<ApiError>(ApiJson.Options, ct)
                .ConfigureAwait(false);
            if (body?.Error is { } e)
                return new ApiException(e.Code, e.Message, status, e.Details);
        }
        catch
        {
            // fall through to a generic error below
        }
        return new ApiException(
            ApiErrorCode.Internal, $"HTTP {status}", status);
    }
}
