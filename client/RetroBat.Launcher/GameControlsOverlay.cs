using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using RetroBat.Core.Branding;

namespace RetroBat.Launcher;

/// <summary>
/// In-game controls overlay. While a game runs, the launcher stays alive
/// (it waits for RetroArch to exit). This installs a global low-level keyboard
/// hook on its own STA thread; pressing H toggles a top-most, non-activating
/// window that lists the current system's keyboard controls. H is not mapped to
/// any RetroPad button in our cores, so the game ignores it and the hook
/// swallows it. The window never takes focus (WS_EX_NOACTIVATE), so RetroArch
/// does not pause.
/// </summary>
internal sealed class GameControlsOverlay : IDisposable
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int VK_H = 0x48;

    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    private readonly string _systemId;
    private readonly LowLevelKeyboardProc _proc; // keep a strong reference
    private Thread? _thread;
    private Dispatcher? _dispatcher;
    private IntPtr _hook = IntPtr.Zero;
    private Window? _window;

    public GameControlsOverlay(string? systemId)
    {
        _systemId = string.IsNullOrWhiteSpace(systemId) ? "default" : systemId!.ToLowerInvariant();
        _proc = HookCallback;
    }

    /// <summary>Start the hook + overlay on a dedicated STA message-pump thread.</summary>
    public void Start()
    {
        _thread = new Thread(() =>
        {
            _dispatcher = Dispatcher.CurrentDispatcher;
            _hook = SetHook(_proc);
            Dispatcher.Run();
            if (_hook != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hook);
                _hook = IntPtr.Zero;
            }
        })
        { IsBackground = true, Name = "PlayVaultControlsOverlay" };
        _thread.SetApartmentState(ApartmentState.STA);
        _thread.Start();
    }

    public void Stop()
    {
        try
        {
            _dispatcher?.InvokeShutdown();
            _thread?.Join(1500);
        }
        catch
        {
            // best effort
        }
    }

    public void Dispose() => Stop();

    private void Toggle()
    {
        if (_window == null)
        {
            _window = new Window
            {
                Title = $"{BrandInfo.Name} — Controles",
                Width = 460,
                SizeToContent = SizeToContent.Height,
                WindowStartupLocation = WindowStartupLocation.CenterScreen,
                WindowStyle = WindowStyle.None,
                ResizeMode = ResizeMode.NoResize,
                ShowActivated = false,
                Topmost = true,
                ShowInTaskbar = false,
                Background = new SolidColorBrush(Color.FromRgb(0x14, 0x17, 0x1c)),
                Content = new Border
                {
                    BorderBrush = new SolidColorBrush(Color.FromRgb(0x1f, 0x6f, 0xeb)),
                    BorderThickness = new Thickness(1),
                    Child = ControlsCard.BuildPanel(_systemId, "Pulsa H para cerrar."),
                },
            };
            _window.SourceInitialized += (_, _) =>
            {
                var h = new WindowInteropHelper(_window!).Handle;
                var ex = GetWindowLongPtr(h, GWL_EXSTYLE).ToInt64();
                SetWindowLongPtr(h, GWL_EXSTYLE,
                    new IntPtr(ex | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW));
            };
            _window.Show();
            return;
        }
        _window.Visibility =
            _window.Visibility == Visibility.Visible ? Visibility.Hidden : Visibility.Visible;
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var msg = wParam.ToInt32();
            if (msg == WM_KEYDOWN || msg == WM_KEYUP)
            {
                var vk = Marshal.ReadInt32(lParam);
                if (vk == VK_H)
                {
                    if (msg == WM_KEYDOWN)
                        _dispatcher?.BeginInvoke(new Action(Toggle));
                    return new IntPtr(1); // swallow H (down and up) so the game never sees it
                }
            }
        }
        return CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc)
    {
        // A low-level hook needs no target module; pass the current module handle.
        using var mod = System.Diagnostics.Process.GetCurrentProcess().MainModule!;
        return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(mod.ModuleName), 0);
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(
        int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);
}
