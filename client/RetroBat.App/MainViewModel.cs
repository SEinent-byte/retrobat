using RetroBat.App.Mvvm;
using RetroBat.Core.Contracts;
using RetroBat.Core.Security;
using RetroBat.Services;
using RetroBat.Services.Api;
using RetroBat.Services.Games;

namespace RetroBat.App;

/// <summary>
/// Account panel: sign-in, license status, trial start. Games themselves live
/// inside RetroBat (EmulationStation); after sign-in this window silently
/// syncs the catalog into RetroBat via <see cref="CatalogSync"/> so the games
/// appear there. No catalog/play UI here.
/// </summary>
public sealed class MainViewModel : ViewModelBase
{
    private readonly SessionManager _session;
    private readonly CatalogSync _sync;

    private string _statusText = "Not signed in.";
    private string? _userEmail;
    private string? _syncInfo;
    private bool _isSignedIn;
    private bool _canStartTrial;
    private bool _isBusy;

    public MainViewModel(SessionManager session, CatalogSync sync)
    {
        _session = session;
        _sync = sync;

        SignInCommand = new AsyncRelayCommand(SignInAsync, () => !IsSignedIn, OnError);
        StartTrialCommand = new AsyncRelayCommand(StartTrialAsync, () => CanStartTrial, OnError);
        SignOutCommand = new AsyncRelayCommand(SignOutAsync, () => IsSignedIn, OnError);
    }

    public AsyncRelayCommand SignInCommand { get; }
    public AsyncRelayCommand StartTrialCommand { get; }
    public AsyncRelayCommand SignOutCommand { get; }

    public string StatusText { get => _statusText; private set => Set(ref _statusText, value); }
    public string? UserEmail { get => _userEmail; private set => Set(ref _userEmail, value); }
    public string? SyncInfo { get => _syncInfo; private set => Set(ref _syncInfo, value); }
    public bool IsBusy { get => _isBusy; private set => Set(ref _isBusy, value); }

    public bool IsSignedIn
    {
        get => _isSignedIn;
        private set { if (Set(ref _isSignedIn, value)) RaiseCommands(); }
    }

    public bool CanStartTrial
    {
        get => _canStartTrial;
        private set { if (Set(ref _canStartTrial, value)) StartTrialCommand.RaiseCanExecuteChanged(); }
    }

    /// <summary>Resume a persisted session at startup.</summary>
    public async Task InitializeAsync()
    {
        if (_session.LoadPersisted())
        {
            IsSignedIn = true;
            await RefreshAsync().ConfigureAwait(true);
        }
    }

    private Task SignInAsync() =>
        RunBusy("Opening browser for Google sign-in…", async () =>
        {
            var user = await _session.SignInAsync().ConfigureAwait(true);
            UserEmail = user.Email;
            IsSignedIn = true;
            await RefreshAsync().ConfigureAwait(true);
        });

    private Task StartTrialAsync() =>
        RunBusy("Starting trial…", async () =>
        {
            await _session.ActivateTrialAsync().ConfigureAwait(true);
            await RefreshAsync().ConfigureAwait(true);
        });

    private async Task SignOutAsync()
    {
        await _session.SignOutAsync().ConfigureAwait(true);
        IsSignedIn = false;
        CanStartTrial = false;
        UserEmail = null;
        SyncInfo = null;
        StatusText = "Not signed in.";
    }

    /// <summary>Refresh license status, then sync the catalog into RetroBat.</summary>
    private async Task RefreshAsync()
    {
        var state = await _session.GetStatusAsync().ConfigureAwait(true);
        var text = Format(state);
        if (_session.ClockState.Status == ClockStatus.RolledBack)
            text += "\n⚠ System clock set back — time is verified online.";
        StatusText = text;
        CanStartTrial = state.Status == LicenseStatus.None;

        await SyncCatalogAsync(state).ConfigureAwait(true);
    }

    private async Task SyncCatalogAsync(LicenseState state)
    {
        try
        {
            SyncInfo = "Syncing library into RetroBat…";
            var n = await _sync.SyncAsync(state, UserEmail).ConfigureAwait(true);
            SyncInfo = $"{n} game(s) available in RetroBat. Launch RetroBat to play.";
        }
        catch (Exception ex)
        {
            SyncInfo = $"Library sync failed: {Describe(ex)}";
        }
    }

    private async Task RunBusy(string message, Func<Task> work)
    {
        IsBusy = true;
        StatusText = message;
        try
        {
            await work().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void RaiseCommands()
    {
        SignInCommand.RaiseCanExecuteChanged();
        StartTrialCommand.RaiseCanExecuteChanged();
        SignOutCommand.RaiseCanExecuteChanged();
    }

    private void OnError(Exception ex)
    {
        IsBusy = false;
        StatusText = "Error: " + Describe(ex);
    }

    private static string Describe(Exception ex) => ex switch
    {
        ApiException { Code: ApiErrorCode.TrialAlreadyUsed } =>
            "this device already used its free trial",
        ApiException { Code: ApiErrorCode.Blocked } =>
            "this account or device is blocked",
        ApiException api => api.Message,
        _ => ex.Message,
    };

    private static string Format(LicenseState s) => s.Status switch
    {
        LicenseStatus.TrialActive =>
            $"Trial active — {Remaining(s.ServerTime, s.ExpiresAt)} left.",
        LicenseStatus.TrialExpired =>
            "Trial expired. Subscribe to keep playing.",
        LicenseStatus.Subscribed =>
            "Subscription active." + PeriodEnd(s.CurrentPeriodEnd),
        LicenseStatus.None =>
            "No trial yet. Start your 7-day free trial.",
        _ => "Unknown status.",
    };

    private static string Remaining(long serverTime, long? expiresAt)
    {
        if (expiresAt is not { } end)
            return "0h";
        var span = TimeSpan.FromMilliseconds(Math.Max(0, end - serverTime));
        return span.TotalHours >= 24
            ? $"{(int)span.TotalDays}d {span.Hours}h"
            : $"{(int)span.TotalHours}h {span.Minutes}m";
    }

    private static string PeriodEnd(long? end) =>
        end is { } ms
            ? $" Renews {DateTimeOffset.FromUnixTimeMilliseconds(ms).LocalDateTime:d}."
            : "";
}
