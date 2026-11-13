using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace RetroBat.Core.Security;

public enum ClockStatus
{
    /// <summary>Local clock is at or ahead of the last server time seen.</summary>
    Ok,
    /// <summary>Local clock rolled back below a server time already observed —
    /// possible trial-extension tampering (SPEC §6).</summary>
    RolledBack,
}

public sealed record ClockCheck(ClockStatus Status, long HighWaterMs, long LocalMs);

/// <summary>
/// Monotonic anti-tamper clock mark (SPEC §6). Stores the highest server time
/// ever seen (the "high-water mark") in HKCU\Software\RetroBat, DPAPI-protected
/// so the user cannot edit it by hand. If the local wall clock later reads
/// earlier than that mark (beyond a small skew), the user likely moved the
/// clock back to extend a trial. The server stays authoritative; this only
/// adds a local offline signal.
/// </summary>
public sealed class ClockGuard
{
    private const string KeyPath = @"Software\RetroBat";
    private const string ValueName = "clock";
    // Allow modest forward skew between the server clock and this machine.
    private const long SkewToleranceMs = 5 * 60 * 1000;

    private static readonly byte[] Entropy =
        Encoding.UTF8.GetBytes("RetroBat.clock.v1");

    private readonly Func<long> _localNowMs;

    public ClockGuard(Func<long>? localNowMs = null)
    {
        _localNowMs = localNowMs
            ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    /// <summary>Record a server timestamp; the mark only ever moves forward.</summary>
    public void RecordServerTime(long serverTimeMs)
    {
        var current = ReadHighWater() ?? 0;
        if (serverTimeMs <= current)
            return;
        WriteHighWater(serverTimeMs);
    }

    /// <summary>Compare the local clock against the stored mark.</summary>
    public ClockCheck Check()
    {
        var local = _localNowMs();
        var high = ReadHighWater() ?? 0;
        var status = local + SkewToleranceMs < high
            ? ClockStatus.RolledBack
            : ClockStatus.Ok;
        return new ClockCheck(status, high, local);
    }

    private long? ReadHighWater()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(KeyPath);
            if (key?.GetValue(ValueName) is not string b64)
                return null;
            var json = ProtectedData.Unprotect(
                Convert.FromBase64String(b64), Entropy,
                DataProtectionScope.CurrentUser);
            var mark = JsonSerializer.Deserialize<Mark>(json);
            return mark?.HighWaterMs;
        }
        catch
        {
            // Corrupt/foreign blob — treat as no mark yet.
            return null;
        }
    }

    private void WriteHighWater(long value)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(new Mark(value));
        var sealedBytes = ProtectedData.Protect(
            json, Entropy, DataProtectionScope.CurrentUser);
        using var key = Registry.CurrentUser.CreateSubKey(KeyPath);
        key.SetValue(ValueName, Convert.ToBase64String(sealedBytes),
            RegistryValueKind.String);
    }

    private sealed record Mark(long HighWaterMs);
}
