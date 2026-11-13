using System.Diagnostics;

namespace RetroBat.Services.Games;

/// <summary>
/// Downloads a ROM via the bundled aria2c.exe (SPEC §7): multi-connection,
/// resumable. Progress is reported as a 0..1 fraction parsed from aria2's
/// console output (best-effort).
/// </summary>
public sealed class Aria2DownloadManager(RetrobatPaths paths)
{
    public async Task DownloadAsync(
        string url,
        string destPath,
        IProgress<double>? progress = null,
        CancellationToken ct = default)
    {
        var dir = Path.GetDirectoryName(destPath)!;
        Directory.CreateDirectory(dir);

        var exe = paths.Aria2Exe;
        if (!File.Exists(exe))
            throw new FileNotFoundException("aria2c.exe not found", exe);

        var psi = new ProcessStartInfo(exe)
        {
            WorkingDirectory = dir,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add("--dir=" + dir);
        psi.ArgumentList.Add("--out=" + Path.GetFileName(destPath));
        psi.ArgumentList.Add("--max-connection-per-server=4");
        psi.ArgumentList.Add("--split=4");
        psi.ArgumentList.Add("--continue=true");
        psi.ArgumentList.Add("--allow-overwrite=true");
        psi.ArgumentList.Add("--auto-file-renaming=false");
        psi.ArgumentList.Add("--summary-interval=1");
        psi.ArgumentList.Add(url);

        using var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
        proc.OutputDataReceived += (_, e) =>
        {
            if (e.Data is { } line && TryParseProgress(line, out var p))
                progress?.Report(p);
        };

        if (!proc.Start())
            throw new InvalidOperationException("failed to start aria2c");
        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();

        await proc.WaitForExitAsync(ct).ConfigureAwait(false);

        if (proc.ExitCode != 0)
            throw new DownloadException($"aria2c exited with code {proc.ExitCode}");
        if (!File.Exists(destPath))
            throw new DownloadException("download finished but file is missing");
    }

    /// <summary>aria2 prints lines like "[#1 ... 45%] ...". Extract the %.</summary>
    private static bool TryParseProgress(string line, out double fraction)
    {
        fraction = 0;
        var pct = line.IndexOf('%');
        if (pct <= 0)
            return false;
        var start = pct - 1;
        while (start >= 0 && (char.IsDigit(line[start]) || line[start] == '.'))
            start--;
        var span = line[(start + 1)..pct];
        if (double.TryParse(span, out var value))
        {
            fraction = Math.Clamp(value / 100.0, 0, 1);
            return true;
        }
        return false;
    }
}

public sealed class DownloadException(string message) : Exception(message);
