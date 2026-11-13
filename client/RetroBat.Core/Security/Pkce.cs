using System.Security.Cryptography;
using System.Text;

namespace RetroBat.Core.Security;

/// <summary>PKCE (RFC 7636) verifier/challenge for the Authorization Code +
/// PKCE desktop flow (SPEC §4). S256 method only.</summary>
public sealed record PkcePair(string Verifier, string Challenge)
{
    public const string Method = "S256";

    public static PkcePair Create()
    {
        // 32 random bytes -> 43-char base64url verifier (RFC 7636 §4.1).
        var bytes = RandomNumberGenerator.GetBytes(32);
        var verifier = Base64Url(bytes);
        var challenge = Base64Url(
            SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        return new PkcePair(verifier, challenge);
    }

    /// <summary>Random base64url state value for CSRF protection.</summary>
    public static string NewState() => Base64Url(RandomNumberGenerator.GetBytes(16));

    private static string Base64Url(byte[] data) =>
        Convert.ToBase64String(data)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
}
