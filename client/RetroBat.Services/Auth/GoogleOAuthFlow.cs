using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Web;
using RetroBat.Core.Security;

namespace RetroBat.Services.Auth;

/// <summary>Result of the loopback flow: hand { Code, CodeVerifier,
/// RedirectUri } to POST /auth/exchange (SPEC §4).</summary>
public sealed record AuthorizationResult(
    string Code,
    string CodeVerifier,
    string RedirectUri);

/// <summary>
/// Authorization Code + PKCE with a loopback redirect (RFC 8252, SPEC §4).
/// Opens the system browser to Google's consent screen, captures the code on
/// a one-shot 127.0.0.1 listener, validates state, and returns the code.
/// The client is a public client: it holds no client secret.
/// </summary>
public sealed class GoogleOAuthFlow(ClientConfig config)
{
    public async Task<AuthorizationResult> AuthorizeAsync(
        CancellationToken ct = default)
    {
        var pkce = PkcePair.Create();
        var state = PkcePair.NewState();

        var port = GetFreeLoopbackPort();
        // Literal loopback IP, not "localhost" (SPEC §4).
        var redirectUri = $"http://127.0.0.1:{port}/callback";

        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        listener.Start();

        var authUrl = BuildAuthUrl(redirectUri, pkce.Challenge, state);
        OpenBrowser(authUrl);

        var context = await GetContextAsync(listener, ct).ConfigureAwait(false);
        var query = context.Request.QueryString;

        try
        {
            var error = query["error"];
            if (!string.IsNullOrEmpty(error))
                throw new OAuthFlowException($"authorization denied: {error}");

            if (query["state"] != state)
                throw new OAuthFlowException("state mismatch (possible CSRF)");

            var code = query["code"];
            if (string.IsNullOrEmpty(code))
                throw new OAuthFlowException("no authorization code returned");

            await WriteClosePageAsync(context).ConfigureAwait(false);
            return new AuthorizationResult(code, pkce.Verifier, redirectUri);
        }
        finally
        {
            listener.Stop();
        }
    }

    private string BuildAuthUrl(string redirectUri, string challenge, string state)
    {
        var q = HttpUtility.ParseQueryString(string.Empty);
        q["client_id"] = config.GoogleClientId;
        q["redirect_uri"] = redirectUri;
        q["response_type"] = "code";
        q["scope"] = config.Scope;
        q["code_challenge"] = challenge;
        q["code_challenge_method"] = PkcePair.Method;
        q["state"] = state;
        return $"{config.GoogleAuthEndpoint}?{q}";
    }

    private static int GetFreeLoopbackPort()
    {
        var l = new TcpListener(IPAddress.Loopback, 0);
        l.Start();
        var port = ((IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    private static void OpenBrowser(string url) =>
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });

    private static async Task<HttpListenerContext> GetContextAsync(
        HttpListener listener, CancellationToken ct)
    {
        var contextTask = listener.GetContextAsync();
        using (ct.Register(listener.Stop))
        {
            try
            {
                return await contextTask.ConfigureAwait(false);
            }
            catch (HttpListenerException) when (ct.IsCancellationRequested)
            {
                throw new OperationCanceledException(ct);
            }
        }
    }

    private static async Task WriteClosePageAsync(HttpListenerContext context)
    {
        const string html =
            "<!doctype html><meta charset=utf-8><title>RetroBat</title>" +
            "<body style='font-family:sans-serif;text-align:center;margin-top:3rem'>" +
            "<h2>Sign-in complete</h2><p>You can close this tab and return to RetroBat.</p>";
        var buffer = System.Text.Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.ContentLength64 = buffer.Length;
        await context.Response.OutputStream.WriteAsync(buffer).ConfigureAwait(false);
        context.Response.OutputStream.Close();
    }
}

public sealed class OAuthFlowException(string message) : Exception(message);
