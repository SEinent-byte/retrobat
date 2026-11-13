# client

C# / .NET 8 + WPF desktop app (Windows, MVVM). Integrates RetroBat, aria2, Windows Registry.

Layout: `/Core`, `/Services`, `/UI`.

Auth: Google OAuth 2.0 Authorization Code + PKCE, loopback redirect (RFC 8252).

The client is never the source of truth: every license/trial/download decision is validated server-side.
Scope: `agente-client` edits only this folder.
