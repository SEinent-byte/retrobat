using System.Diagnostics;
using RetroBat.Core.Contracts;
using RetroBat.Services;
using RetroBat.Services.Api;

namespace RetroBat.Launcher;

/// <summary>
/// Enforces the licence window while a game is running. The server is the
/// source of truth (SPEC §6): a server-anchored deadline closes the game when
/// the granted trial time ends, and a periodic re-poll closes it if the admin
/// blocks or revokes the account mid-session, or the local clock is moved
/// backwards. On a kill it exposes a user-facing reason the caller shows.
/// </summary>
internal sealed class GameLicenseWatchdog(
    Process proc, SessionManager session, ApiClient api) : IDisposable
{
    private static readonly TimeSpan PollEvery = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan Tick = TimeSpan.FromSeconds(5);

    private readonly CancellationTokenSource _cts = new();
    private Task? _loop;

    /// <summary>Non-null once the watchdog has killed the game; the message to
    /// show the player.</summary>
    public string? KillReason { get; private set; }

    public void Start(LicenseState initial) =>
        _loop = Task.Run(() => RunAsync(initial, _cts.Token));

    private async Task RunAsync(LicenseState status, CancellationToken ct)
    {
        var deadline = ComputeDeadline(status, DateTimeOffset.UtcNow);
        var lastPoll = DateTimeOffset.UtcNow;
        try
        {
            while (!ct.IsCancellationRequested && !proc.HasExited)
            {
                var nowUtc = DateTimeOffset.UtcNow;
                if (deadline is not null && nowUtc >= deadline)
                {
                    Kill("Tu tiempo de juego ha terminado.");
                    return;
                }

                if (nowUtc - lastPoll >= PollEvery)
                {
                    lastPoll = nowUtc;
                    try
                    {
                        var fresh = await session.GetStatusAsync(ct).ConfigureAwait(false);
                        if (fresh.Blocked)
                        {
                            Kill("Tu acceso ha sido bloqueado.");
                            return;
                        }
                        if (fresh.Status != LicenseStatus.Subscribed &&
                            fresh.Status != LicenseStatus.TrialActive)
                        {
                            Kill("Tu prueba terminó.");
                            return;
                        }
                        deadline = ComputeDeadline(fresh, nowUtc);
                    }
                    catch
                    {
                        // Transient network: keep the last server-anchored deadline.
                    }
                }

                await Task.Delay(Tick, ct).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal stop when the game exits on its own.
        }
        _ = api; // reserved for a future per-game revalidation call
    }

    /// <summary>Local deadline from the server-anchored remaining trial time.
    /// Null for a subscription (no mid-session cut); now for an inactive state
    /// (stop immediately).</summary>
    private static DateTimeOffset? ComputeDeadline(LicenseState s, DateTimeOffset nowUtc)
    {
        if (s.Status == LicenseStatus.Subscribed)
            return null;
        if (s.Status == LicenseStatus.TrialActive && s.ExpiresAt is long exp)
        {
            var remainingMs = exp - s.ServerTime;
            return remainingMs <= 0 ? nowUtc : nowUtc.AddMilliseconds(remainingMs);
        }
        return nowUtc;
    }

    private void Kill(string reason)
    {
        KillReason = reason;
        try
        {
            if (!proc.HasExited)
                proc.Kill(entireProcessTree: true);
        }
        catch
        {
            // best effort: the process may have exited between the check and kill
        }
    }

    public void Stop()
    {
        try { _cts.Cancel(); }
        catch { /* already disposed */ }
    }

    public void Dispose()
    {
        Stop();
        _cts.Dispose();
    }
}
