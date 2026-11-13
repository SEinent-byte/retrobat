/** Google OAuth 2.0 code exchange + id_token validation (SPEC §4). */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { fail } from "./http.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Cached across requests within the same isolate.
const jwks = createRemoteJWKSet(new URL(JWKS_URI));

export interface GoogleIdentity {
  /** Stable Google account id (`sub`). */
  sub: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Exchange an authorization code (Authorization Code + PKCE) for tokens and
 * return the verified identity from the id_token. The Worker is the
 * confidential client (holds GOOGLE_CLIENT_SECRET).
 */
export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleIdentity> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    code_verifier: opts.codeVerifier,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw fail.authExchangeFailed(
      `google token endpoint returned ${res.status}`,
    );
  }
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw fail.authExchangeFailed("no id_token in response");

  return verifyIdToken(json.id_token, opts.clientId);
}

/**
 * Verify a Google id_token signature, issuer and audience, and return the
 * identity. Used by the desktop code exchange and by the admin panel
 * (Google Identity Services) login.
 */
export async function verifyIdToken(
  idToken: string,
  audience: string,
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ISSUERS,
    audience,
  }).catch(() => {
    throw fail.authExchangeFailed("id_token verification failed");
  });

  const sub = payload.sub;
  const email = payload["email"] as string | undefined;
  if (!sub || !email) {
    throw fail.authExchangeFailed("id_token missing sub/email");
  }
  return {
    sub,
    email,
    emailVerified: payload["email_verified"] === true,
  };
}
