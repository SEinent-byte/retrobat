using System.Windows;
using RetroBat.Core.Branding;
using RetroBat.Core.Contracts;
using RetroBat.Services;
using RetroBat.Services.Account;
using RetroBat.Services.Api;
using RetroBat.Services.Games;

namespace RetroBat.Launcher;

/// <summary>
/// In-RetroBat account menu, opened by the launch proxy when the user selects
/// the "Mi Cuenta" entry inside EmulationStation. Reuses the same
/// <see cref="SessionManager"/> logic as the WPF panel: Google sign-in,
/// trial activation and sign-out. After any change it refreshes the status and
/// re-syncs the catalog so the "Mi Cuenta" entry reflects the new state.
/// </summary>
public partial class AccountMenuWindow : Window
{
    private readonly SessionManager _session;
    private readonly CatalogSync _sync;

    public AccountMenuWindow(SessionManager session, CatalogSync sync)
    {
        _session = session;
        _sync = sync;
        InitializeComponent();
        BackButton.Content = $"Volver a {BrandInfo.Name}";
        Loaded += async (_, _) => await RefreshAsync().ConfigureAwait(true);
    }

    private async void OnSignIn(object sender, RoutedEventArgs e) =>
        await Guarded(async () =>
        {
            await _session.SignInAsync().ConfigureAwait(true);
            await RefreshAsync().ConfigureAwait(true);
        }).ConfigureAwait(true);

    private async void OnStartTrial(object sender, RoutedEventArgs e) =>
        await Guarded(async () =>
        {
            await _session.ActivateTrialAsync().ConfigureAwait(true);
            await RefreshAsync().ConfigureAwait(true);
        }).ConfigureAwait(true);

    private async void OnSignOut(object sender, RoutedEventArgs e) =>
        await Guarded(async () =>
        {
            await _session.SignOutAsync().ConfigureAwait(true);
            await RefreshAsync().ConfigureAwait(true);
        }).ConfigureAwait(true);

    private void OnClose(object sender, RoutedEventArgs e) => Close();

    /// <summary>Pull the current state, update the UI and re-sync the catalog
    /// so the ES entry's label/description stay in step.</summary>
    private async Task RefreshAsync()
    {
        if (!_session.IsSignedIn)
            _session.LoadPersisted();

        LicenseState? state = null;
        if (_session.IsSignedIn)
        {
            try
            {
                state = await _session.GetStatusAsync().ConfigureAwait(true);
            }
            catch (ApiException)
            {
                // Show signed-out text rather than an error on a stale session.
            }
        }

        StatusText.Text = AccountStatusText.Full(state, _session.Email);
        var signedIn = _session.IsSignedIn && state is not null;
        SignInButton.Visibility = signedIn ? Visibility.Collapsed : Visibility.Visible;
        SignOutButton.IsEnabled = signedIn;
        TrialButton.IsEnabled = signedIn && state!.Status == LicenseStatus.None;

        if (signedIn)
        {
            try
            {
                await _sync.SyncAsync(state, _session.Email).ConfigureAwait(true);
            }
            catch
            {
                // Catalog sync is best-effort; the menu still works.
            }
        }
    }

    private async Task Guarded(Func<Task> work)
    {
        IsEnabled = false;
        try
        {
            await work().ConfigureAwait(true);
        }
        catch (ApiException ex) when (ex.Code == ApiErrorCode.TrialAlreadyUsed)
        {
            MessageBox.Show("Este dispositivo ya uso su prueba gratis.", "Mi Cuenta");
        }
        catch (ApiException ex) when (ex.Code == ApiErrorCode.Blocked)
        {
            MessageBox.Show("Esta cuenta o dispositivo esta bloqueado.", "Mi Cuenta");
        }
        catch (Exception ex)
        {
            MessageBox.Show("Error: " + ex.Message, "Mi Cuenta");
        }
        finally
        {
            IsEnabled = true;
        }
    }
}
