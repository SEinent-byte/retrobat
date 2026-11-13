using RetroBat.Core.Contracts;
using RetroBat.Core.Device;
using RetroBat.Core.Security;
using RetroBat.Services.Api;
using RetroBat.Services.Auth;

namespace RetroBat.Services;

/// <summary>
/// Orchestrates auth + license for the UI. Owns the current session, persists
/// it via <see cref="TokenStore"/>, and transparently refreshes an expired
/// session once on an Unauthorized response. The server stays the source of
/// truth (SPEC §2); this just relays.
/// </summary>
public sealed class SessionManager(
    ApiClient api,
    TokenStore store,
    GoogleOAuthFlow oauth,
    ClockGuard clock)
{
    private Session? _session;
    private DeviceIdentity? _device;
    private string? _email;

    public DeviceIdentity Device => _device ??= DeviceFingerprintProvider.Collect();
    public bool IsSignedIn => _session is not null;

    /// <summary>Signed-in user's email, cached or loaded from the token store.
    /// Null when signed out or unknown.</summary>
    public string? Email => _email ??= store.TryLoadEmail();

    /// <summary>Last local-clock anti-tamper check (SPEC §6), updated on each
    /// license status fetch.</summary>
    public ClockCheck ClockState { get; private set; } = new(ClockStatus.Ok, 0, 0);

    /// <summary>Load a persisted session, if any, at startup.</summary>
    public bool LoadPersisted()
    {
        _session = store.TryLoadSession();
        return _session is not null;
    }

    /// <summary>Full interactive login (SPEC §4), then persist.</summary>
    public async Task<UserDto> SignInAsync(CancellationToken ct = default)
    {
        var auth = await oauth.AuthorizeAsync(ct).ConfigureAwait(false);
        var res = await api.ExchangeAsync(
            new AuthExchangeRequest(
                auth.Code, auth.CodeVerifier, auth.RedirectUri, Device),
            ct).ConfigureAwait(false);
        SetSession(res.Session);
        _email = res.User.Email;
        store.SaveEmail(res.User.Email);
        return res.User;
    }

    public async Task SignOutAsync(CancellationToken ct = default)
    {
        if (_session is { } s)
        {
            try
            {
                await api.LogoutAsync(s.SessionToken, s.RefreshToken, ct)
                    .ConfigureAwait(false);
            }
            catch (ApiException)
            {
                // best-effort; clear locally regardless
            }
        }
        _session = null;
        _email = null;
        store.Clear();
    }

    public async Task<LicenseState> GetStatusAsync(CancellationToken ct = default)
    {
        var state = await WithValidSession(
            (token) => api.GetLicenseStatusAsync(token, ct), ct).ConfigureAwait(false);
        // Server time is authoritative: advance the monotonic mark and
        // re-check the local clock for roll-back (SPEC §6).
        clock.RecordServerTime(state.ServerTime);
        ClockState = clock.Check();
        return state;
    }

    public Task<ActivateTrialResponse> ActivateTrialAsync(CancellationToken ct = default) =>
        WithValidSession((token) => api.ActivateTrialAsync(token, Device, ct), ct);

    /// <summary>Run an authorized API call with the current session token,
    /// refreshing once on Unauthorized. For callers outside this class
    /// (e.g. the game library).</summary>
    public Task<T> AuthorizedAsync<T>(
        Func<string, Task<T>> call, CancellationToken ct = default) =>
        WithValidSession(call, ct);

    private void SetSession(Session s)
    {
        _session = s;
        store.SaveSession(s);
    }

    /// <summary>Run an authorized call; on Unauthorized, refresh once and retry.</summary>
    private async Task<T> WithValidSession<T>(
        Func<string, Task<T>> call, CancellationToken ct)
    {
        var session = _session
            ?? throw new InvalidOperationException("not signed in");

        try
        {
            return await call(session.SessionToken).ConfigureAwait(false);
        }
        catch (ApiException ex) when (ex.Code == ApiErrorCode.Unauthorized)
        {
            var refreshed = await api.RefreshAsync(session.RefreshToken, ct)
                .ConfigureAwait(false);
            SetSession(refreshed);
            return await call(refreshed.SessionToken).ConfigureAwait(false);
        }
    }
}
