using System.Windows;
using RetroBat.Core.Security;
using RetroBat.Services;
using RetroBat.Services.Api;
using RetroBat.Services.Auth;
using RetroBat.Services.Games;

namespace RetroBat.App;

/// <summary>App composition root: wires the service graph and shows the main
/// window. (A DI container is overkill for this surface.)</summary>
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var config = ClientConfig.Default;
        var api = new ApiClient(config);
        var store = new TokenStore();
        var oauth = new GoogleOAuthFlow(config);
        var clock = new ClockGuard();
        var session = new SessionManager(api, store, oauth, clock);

        var paths = new RetrobatPaths();
        var games = new GameService(
            api, session, paths,
            new Aria2DownloadManager(paths),
            new EmulatorLauncher(paths));

        var vm = new MainViewModel(session, games);

        var window = new MainWindow { DataContext = vm };
        window.Show();
    }
}
