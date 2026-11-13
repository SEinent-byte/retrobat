namespace RetroBat.Services;

/// <summary>
/// Client configuration. The Google client id is a PUBLIC desktop-client id
/// (no secret embedded — the Worker is the confidential client, SPEC §4).
/// </summary>
public sealed record ClientConfig(
    string ApiBaseUrl,
    string GoogleClientId,
    string GoogleAuthEndpoint = "https://accounts.google.com/o/oauth2/v2/auth",
    string Scope = "openid email")
{
    /// <summary>Production defaults.</summary>
    public static ClientConfig Default { get; } = new(
        ApiBaseUrl: "https://retrobat-api.anthoniogarciareyes25.workers.dev",
        GoogleClientId:
            "1046162067802-989bevbeer6l8o0cmon15fsdje67d9u7.apps.googleusercontent.com");
}
