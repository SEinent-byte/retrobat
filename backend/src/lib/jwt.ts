/** Session JWT (HS256) signing/verification with the Worker's JWT_SECRET. */
import { SignJWT, jwtVerify } from "jose";

/** Session token lifetime: short (SPEC §4). */
export const SESSION_TTL_MS = 15 * 60 * 1000; // 15 min
/** Refresh token lifetime. */
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const ISSUER = "retrobat-api";
const AUDIENCE = "retrobat-client";
const ADMIN_AUDIENCE = "retrobat-admin";

/** Admin session lifetime. */
export const ADMIN_TTL_MS = 60 * 60 * 1000; // 1 hour

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export interface SessionClaims {
  /** user id (subject). */
  sub: string;
}

/** Sign a session JWT valid for {@link SESSION_TTL_MS}. */
export async function signSession(
  userId: string,
  secret: string,
  now = Date.now(),
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = now + SESSION_TTL_MS;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(key(secret));
  return { token, expiresAt };
}

/** Verify a session JWT; throws if invalid/expired. Returns the user id. */
export async function verifySession(
  token: string,
  secret: string,
): Promise<string> {
  const { payload } = await jwtVerify(token, key(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!payload.sub) throw new Error("missing sub");
  return payload.sub;
}

/** Sign an admin session JWT (subject = admin id, carries email). */
export async function signAdmin(
  adminId: string,
  email: string,
  secret: string,
  now = Date.now(),
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = now + ADMIN_TTL_MS;
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuer(ISSUER)
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(key(secret));
  return { token, expiresAt };
}

/** Verify an admin JWT; returns { adminId, email }. Throws if invalid. */
export async function verifyAdmin(
  token: string,
  secret: string,
): Promise<{ adminId: string; email: string }> {
  const { payload } = await jwtVerify(token, key(secret), {
    issuer: ISSUER,
    audience: ADMIN_AUDIENCE,
  });
  if (!payload.sub) throw new Error("missing sub");
  return { adminId: payload.sub, email: String(payload["email"] ?? "") };
}
