using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;
using RetroBat.Core.Contracts;

namespace RetroBat.Services.Auth;

/// <summary>
/// Persists the session + refresh tokens in the Windows Registry under
/// HKCU\Software\RetroBat, DPAPI-protected (CurrentUser scope, SPEC §8.3).
/// Tied to the Windows user; not portable to another machine without a
/// fresh login.
/// </summary>
public sealed class TokenStore
{
    private const string KeyPath = @"Software\RetroBat";
    private const string SessionValue = "session";
    private static readonly byte[] Entropy =
        Encoding.UTF8.GetBytes("RetroBat.session.v1");

    public void SaveSession(Session session)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(session, ApiJson.Options);
        var sealedBytes = ProtectedData.Protect(
            json, Entropy, DataProtectionScope.CurrentUser);
        using var key = Registry.CurrentUser.CreateSubKey(KeyPath);
        key.SetValue(SessionValue, Convert.ToBase64String(sealedBytes),
            RegistryValueKind.String);
    }

    public Session? TryLoadSession()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(KeyPath);
            if (key?.GetValue(SessionValue) is not string b64)
                return null;
            var unsealed = ProtectedData.Unprotect(
                Convert.FromBase64String(b64), Entropy,
                DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<Session>(unsealed, ApiJson.Options);
        }
        catch
        {
            // Corrupt/foreign/undecryptable blob — treat as logged out.
            return null;
        }
    }

    public void Clear()
    {
        using var key = Registry.CurrentUser.OpenSubKey(KeyPath, writable: true);
        key?.DeleteValue(SessionValue, throwOnMissingValue: false);
    }
}
