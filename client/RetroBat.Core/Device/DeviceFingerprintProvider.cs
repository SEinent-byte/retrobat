using System.Management;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;
using RetroBat.Core.Contracts;

namespace RetroBat.Core.Device;

/// <summary>
/// Collects the multilayer hardware/OS signal package (SPEC §8.1) and derives
/// the stable fingerprint = SHA-256(MachineGuid + combo). Each signal is
/// best-effort: a failed probe yields null, never an exception that aborts
/// login. The raw package is sent to the server, which scores the combo.
/// </summary>
public static class DeviceFingerprintProvider
{
    public static DeviceIdentity Collect()
    {
        var signals = new DeviceSignals(
            MachineGuid: ReadMachineGuid(),
            CpuModel: WmiString("Win32_Processor", "Name"),
            CpuCores: WmiInt("Win32_Processor", "NumberOfCores"),
            RamTotalBytes: WmiLong("Win32_ComputerSystem", "TotalPhysicalMemory"),
            DiskSerial: WmiString("Win32_DiskDrive", "SerialNumber"),
            BaseboardSerial: WmiString("Win32_BaseBoard", "SerialNumber"),
            MacAddress: ReadPrimaryMac(),
            ScreenResolution: ReadScreenResolution());

        return new DeviceIdentity(ComputeFingerprint(signals), signals);
    }

    /// <summary>Deterministic SHA-256 over the anchor + stable combo. Screen
    /// resolution is intentionally excluded (it changes with monitors).</summary>
    public static string ComputeFingerprint(DeviceSignals s)
    {
        var combo = string.Join(
            "|",
            s.MachineGuid ?? "",
            s.CpuModel ?? "",
            s.CpuCores?.ToString() ?? "",
            s.RamTotalBytes?.ToString() ?? "",
            s.DiskSerial ?? "",
            s.BaseboardSerial ?? "",
            s.MacAddress ?? "");

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(combo));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string? ReadMachineGuid()
    {
        try
        {
            using var hklm = RegistryKey.OpenBaseKey(
                RegistryHive.LocalMachine, RegistryView.Registry64);
            using var key = hklm.OpenSubKey(
                @"SOFTWARE\Microsoft\Cryptography");
            return key?.GetValue("MachineGuid") as string;
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadPrimaryMac()
    {
        try
        {
            return NetworkInterface.GetAllNetworkInterfaces()
                .Where(n =>
                    n.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                    n.NetworkInterfaceType != NetworkInterfaceType.Tunnel &&
                    n.OperationalStatus == OperationalStatus.Up)
                .Select(n => n.GetPhysicalAddress().ToString())
                .FirstOrDefault(mac => !string.IsNullOrEmpty(mac));
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadScreenResolution()
    {
        var w = WmiInt("Win32_VideoController", "CurrentHorizontalResolution");
        var h = WmiInt("Win32_VideoController", "CurrentVerticalResolution");
        return w is > 0 && h is > 0 ? $"{w}x{h}" : null;
    }

    private static ManagementObject? FirstOf(string wmiClass)
    {
        using var searcher =
            new ManagementObjectSearcher($"SELECT * FROM {wmiClass}");
        foreach (var o in searcher.Get())
            return (ManagementObject)o;
        return null;
    }

    private static string? WmiString(string wmiClass, string prop)
    {
        try
        {
            using var mo = FirstOf(wmiClass);
            var v = mo?[prop];
            var s = v?.ToString()?.Trim();
            return string.IsNullOrEmpty(s) ? null : s;
        }
        catch
        {
            return null;
        }
    }

    private static int? WmiInt(string wmiClass, string prop)
    {
        var s = WmiString(wmiClass, prop);
        return int.TryParse(s, out var n) ? n : null;
    }

    private static long? WmiLong(string wmiClass, string prop)
    {
        var s = WmiString(wmiClass, prop);
        return long.TryParse(s, out var n) ? n : null;
    }
}
