using System.Collections.ObjectModel;
using RetroBat.App.Mvvm;
using RetroBat.Core.Contracts;
using RetroBat.Core.Security;
using RetroBat.Services;
using RetroBat.Services.Api;
using RetroBat.Services.Games;

namespace RetroBat.App;

/// <summary>A catalog row: the game plus its resolved system, for display and
/// launch.</summary>
public sealed record GameRow(GameDto Game, SystemDto System)
{
    public string Title => Game.Title;
    public string SystemName => System.Name;
    public bool TrialEligible => Game.TrialEligible;
}

/// <summary>Drives the main window: sign-in, license status, trial start.
/// All access decisions come from the server (SPEC §2); this only displays
/// what GET /license/status returns.</summary>
public sealed class MainViewModel : ViewModelBase
{
    private readonly SessionManager _session;
    private readonly GameService _games;

    private string _statusText = "Not signed in.";
    private string? _userEmail;
    private bool _isSignedIn;
    private bool _canStartTrial;
    private bool _isBusy;
    private GameRow? _selectedGame;
    private double _downloadProgress;

    public MainViewModel(SessionManager session, GameService games)
    {
        _session = session;
        _games = games;

        SignInCommand = new AsyncRelayCommand(SignInAsync, () => !IsSignedIn, OnError);
        RefreshCommand = new AsyncRelayCommand(RefreshStatusAsync, () => IsSignedIn, OnError);
        StartTrialCommand = new AsyncRelayCommand(StartTrialAsync, () => CanStartTrial, OnError);
        SignOutCommand = new AsyncRelayCommand(SignOutAsync, () => IsSignedIn, OnError);
        PlayCommand = new AsyncRelayCommand(PlayAsync, () => SelectedGame is not null, OnError);
    }

    public AsyncRelayCommand SignInCommand { get; }
    public AsyncRelayCommand RefreshCommand { get; }
    public AsyncRelayCommand StartTrialCommand { get; }
    public AsyncRelayCommand SignOutCommand { get; }
    public AsyncRelayCommand PlayCommand { get; }

    public ObservableCollection<GameRow> Games { get; } = new();

    public string StatusText { get => _statusText; private set => Set(ref _statusText, value); }
    public string? UserEmail { get => _userEmail; private set => Set(ref _userEmail, value); }
    public bool IsBusy { get => _isBusy; private set => Set(ref _isBusy, value); }
    public double DownloadProgress { get => _downloadProgress; private set => Set(ref _downloadProgress, value); }

    public GameRow? SelectedGame
    {
        get => _selectedGame;
        set { if (Set(ref _selectedGame, value)) PlayCommand.RaiseCanExecuteChanged(); }
    }

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

    /// <summary>Called once at window load: resume a persisted session.</summary>
    public async Task InitializeAsync()
    {
        if (_session.LoadPersisted())
        {
            IsSignedIn = true;
            await RefreshStatusAsync().ConfigureAwait(true);
        }
    }

    private async Task SignInAsync()
    {
        await RunBusy("Opening browser for Google sign-in…", async () =>
        {
            var user = await _session.SignInAsync().ConfigureAwait(true);
            UserEmail = user.Email;
            IsSignedIn = true;
            await RefreshStatusAsync().ConfigureAwait(true);
        }).ConfigureAwait(true);
    }

    private Task RefreshStatusAsync() =>
        RunBusy("Checking license…", async () =>
        {
            var state = await _session.GetStatusAsync().ConfigureAwait(true);
            var text = Format(state);
            if (_session.ClockState.Status == ClockStatus.RolledBack)
                text += "\n⚠ System clock set back — time is verified online.";
            StatusText = text;
            CanStartTrial = state.Status == LicenseStatus.None;
            await LoadCatalogAsync().ConfigureAwait(true);
        });

    private async Task LoadCatalogAsync()
    {
        var catalog = await _games.GetCatalogAsync().ConfigureAwait(true);
        var systems = catalog.Systems.ToDictionary(s => s.Id);
        Games.Clear();
        foreach (var g in catalog.Games)
        {
            if (systems.TryGetValue(g.SystemId, out var sys))
                Games.Add(new GameRow(g, sys));
        }
    }

    private Task PlayAsync()
    {
        var row = SelectedGame;
        if (row is null)
            return Task.CompletedTask;

        return RunBusy($"Preparing {row.Title}…", async () =>
        {
            DownloadProgress = 0;
            var progress = new Progress<double>(p => DownloadProgress = p);
            StatusText = $"Downloading {row.Title}…";
            await _games.PlayAsync(row.Game, progress).ConfigureAwait(true);
            StatusText = $"Finished playing {row.Title}.";
            await RefreshStatusAsync().ConfigureAwait(true);
        });
    }

    private Task StartTrialAsync() =>
        RunBusy("Starting trial…", async () =>
        {
            await _session.ActivateTrialAsync().ConfigureAwait(true);
            await RefreshStatusAsync().ConfigureAwait(true);
        });

    private async Task SignOutAsync()
    {
        await _session.SignOutAsync().ConfigureAwait(true);
        IsSignedIn = false;
        CanStartTrial = false;
        UserEmail = null;
        Games.Clear();
        SelectedGame = null;
        StatusText = "Not signed in.";
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
        RefreshCommand.RaiseCanExecuteChanged();
        StartTrialCommand.RaiseCanExecuteChanged();
        SignOutCommand.RaiseCanExecuteChanged();
        PlayCommand.RaiseCanExecuteChanged();
    }

    private void OnError(Exception ex)
    {
        IsBusy = false;
        StatusText = ex switch
        {
            ApiException { Code: ApiErrorCode.TrialAlreadyUsed } =>
                "This device already used its free trial.",
            ApiException { Code: ApiErrorCode.Blocked } =>
                "This account or device is blocked.",
            ApiException api => $"Error: {api.Message}",
            _ => $"Error: {ex.Message}",
        };
    }

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
