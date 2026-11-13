using System.Windows;

namespace RetroBat.Launcher;

public partial class ProgressWindow : Window
{
    public ProgressWindow()
    {
        InitializeComponent();
    }

    public void SetStatus(string text) =>
        Dispatcher.Invoke(() => StatusText.Text = text);

    public void SetProgress(double fraction) =>
        Dispatcher.Invoke(() =>
        {
            Bar.IsIndeterminate = false;
            Bar.Value = Math.Clamp(fraction, 0, 1);
        });

    public void SetIndeterminate() =>
        Dispatcher.Invoke(() => Bar.IsIndeterminate = true);
}
