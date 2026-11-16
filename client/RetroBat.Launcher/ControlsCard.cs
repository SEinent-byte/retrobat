using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Win32;
using RetroBat.Core.Branding;

namespace RetroBat.Launcher;

/// <summary>
/// One-time per-system controls help, shown just before a game launches.
/// EmulationStation runs in a "basic" gamelist view that hides descriptions,
/// so the launcher surfaces the control scheme here instead. Each system shows
/// its card once; the choice is remembered under HKCU so repeat launches skip
/// straight to the game.
/// </summary>
internal static class ControlsCard
{
    private const string ShownKeyPath = @"Software\PlayVault\ControlsShown";

    /// <summary>Show the controls card for <paramref name="systemId"/> unless it
    /// has already been shown once. No-op on a null/empty system.</summary>
    public static void ShowOnce(string? systemId)
    {
        var id = string.IsNullOrWhiteSpace(systemId) ? "default" : systemId!.ToLowerInvariant();
        if (AlreadyShown(id))
            return;
        try
        {
            new Window
            {
                Title = $"{BrandInfo.Name} — Controles",
                Width = 560,
                SizeToContent = SizeToContent.Height,
                WindowStartupLocation = WindowStartupLocation.CenterScreen,
                ResizeMode = ResizeMode.NoResize,
                Background = new SolidColorBrush(Color.FromRgb(0x14, 0x17, 0x1c)),
                Content = BuildBody(id),
            }.ShowDialog();
        }
        catch
        {
            // Help is best-effort; never block the game on it.
        }
        MarkShown(id);
    }

    private static UIElement BuildBody(string systemId)
    {
        var panel = BuildPanel(systemId, "En el juego, pulsa H para ver estos controles.");
        var play = new Button
        {
            Content = "Jugar",
            Padding = new Thickness(22, 7, 22, 7),
            Margin = new Thickness(0, 20, 0, 0),
            HorizontalAlignment = HorizontalAlignment.Right,
            Background = new SolidColorBrush(Color.FromRgb(0x1f, 0x6f, 0xeb)),
            Foreground = Brushes.White,
            BorderThickness = new Thickness(0),
            FontWeight = FontWeights.SemiBold,
            Cursor = System.Windows.Input.Cursors.Hand,
        };
        play.Click += (_, _) => Window.GetWindow(play)!.Close();
        panel.Children.Add(play);
        return panel;
    }

    /// <summary>Build the control-scheme panel (title, intro, key table, notes)
    /// for <paramref name="systemId"/>. Shared by the one-time card and the
    /// in-game overlay. <paramref name="footer"/> is an optional hint line.</summary>
    public static StackPanel BuildPanel(string systemId, string? footer)
    {
        var panel = new StackPanel { Margin = new Thickness(28) };
        var fg = new SolidColorBrush(Color.FromRgb(0xe6, 0xe9, 0xef));
        var accent = new SolidColorBrush(Color.FromRgb(0x1f, 0x6f, 0xeb));
        var dim = new SolidColorBrush(Color.FromRgb(0xb0, 0xb6, 0xc0));

        panel.Children.Add(new TextBlock
        {
            Text = "Controles",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = accent,
            Margin = new Thickness(0, 0, 0, 2),
        });
        panel.Children.Add(new TextBlock
        {
            Text = "Conecta un mando (Xbox/PS) y se configura solo, stick incluido. "
                 + "Sin mando, usa el teclado:",
            Foreground = fg,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 14),
        });

        panel.Children.Add(BuildGrid(fg, accent, KeyboardRows(systemId)));

        if (systemId == "n64")
        {
            panel.Children.Add(new TextBlock
            {
                Text = "N64: mover y apuntar usan el stick (flechas). Los botones C "
                     + "(cámara/arma) solo con mando.",
                Foreground = dim,
                FontSize = 12,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 14, 0, 0),
            });
        }

        if (!string.IsNullOrEmpty(footer))
        {
            panel.Children.Add(new TextBlock
            {
                Text = footer,
                Foreground = dim,
                FontSize = 12,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 14, 0, 0),
            });
        }
        return panel;
    }

    private static (string, string)[] KeyboardRows(string systemId)
    {
        // Key letter matches the on-screen button label (see playvault.cfg).
        var rows = new List<(string, string)>
        {
            ("Mover", "Flechas"),
            ("Botón A", "A"),
            ("Botón B", "B"),
            ("Botón X / Y", "X / Y"),
            ("L / R", "Q / W"),
            ("Start / Select", "Enter / May. der."),
        };
        if (systemId == "n64")
        {
            rows.Insert(3, ("Gatillo Z", "Z"));
            rows.Insert(6, ("Botones C (cámara)", "I / J / K / L"));
        }
        rows.Add(("Salir del juego", "Esc"));
        rows.Add(("Menú del emulador", "F1"));
        return rows.ToArray();
    }

    private static Grid BuildGrid(Brush fg, Brush accent, (string Label, string Keys)[] rows)
    {
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        for (var i = 0; i < rows.Length; i++)
        {
            grid.RowDefinitions.Add(new RowDefinition());
            var label = new TextBlock
            {
                Text = rows[i].Label,
                Foreground = fg,
                Margin = new Thickness(0, 3, 16, 3),
            };
            var keys = new TextBlock
            {
                Text = rows[i].Keys,
                Foreground = accent,
                FontWeight = FontWeights.SemiBold,
                FontFamily = new FontFamily("Consolas"),
                HorizontalAlignment = HorizontalAlignment.Right,
                Margin = new Thickness(0, 3, 0, 3),
            };
            Grid.SetRow(label, i);
            Grid.SetRow(keys, i);
            Grid.SetColumn(keys, 1);
            grid.Children.Add(label);
            grid.Children.Add(keys);
        }
        return grid;
    }

    private static bool AlreadyShown(string systemId)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(ShownKeyPath);
            return key?.GetValue(systemId) is not null;
        }
        catch
        {
            return false;
        }
    }

    private static void MarkShown(string systemId)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(ShownKeyPath);
            key?.SetValue(systemId, 1, RegistryValueKind.DWord);
        }
        catch
        {
            // non-fatal: at worst the card shows again next launch
        }
    }
}
