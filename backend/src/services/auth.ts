/**
 * Auth business logic (SPEC §4). No HTTP here: routes adapt requests to
 * these functions. The client is a public PKCE client; the Worker is the
 * confidential party that talks to Google and issues its own session.
 */
import { and, eq, isNull } from "drizzle-orm";
import type {
  AuthExchangeResponse,
  DeviceIdentity,
  Session,
} from "@retrobat/shared";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { randomToken, sha256Hex, uuid } from "../lib/crypto.js";
import { exchangeCode } from "../lib/google.js";
import { fail } from "../lib/http.js";
import { REFRESH_TTL_MS, signSession } from "../lib/jwt.js";

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
}

/** Upsert the user by google_sub, returning the internal row. */
async function upsertUser(
  dbc: Db,
  sub: string,
  email: string,
  now: number,
): Promise<{ id: string; email: string; createdAt: number; blocked: boolean }> {
  const existing = await dbc
    .select()
    .from(schema.users)
    .where(eq(schema.users.googleSub, sub))
    .get();

  if (existing) {
    if (existing.blocked) throw fail.blocked();
    if (existing.email !== email) {
      await dbc
        .update(schema.users)
        .set({ email })
        .where(eq(schema.users.id, existing.id));
    }
    return {
      id: existing.id,
      email,
      createdAt: existing.createdAt,
      blocked: existing.blocked,
    };
  }

  const id = uuid();
  await dbc.insert(schema.users).values({
    id,
    googleSub: sub,
    email,
    createdAt: now,
  });
  return { id, email, createdAt: now, blocked: false };
}

/** Record / refresh the device row from the client signal package (§8.1). */
async function touchDevice(
  dbc: Db,
  device: DeviceIdentity,
  now: number,
): Promise<void> {
  await dbc
    .insert(schema.devices)
    .values({
      fingerprint: device.fingerprint,
      machineGuid: device.signals.machineGuid,
      signalsJson: JSON.stringify(device.signals),
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: schema.devices.fingerprint,
      set: {
        lastSeenAt: now,
        signalsJson: JSON.stringify(device.signals),
        machineGuid: device.signals.machineGuid,
      },
    });
}

/** Issue a session JWT + a fresh stored refresh token. */
async function issueSession(
  dbc: Db,
  userId: string,
  jwtSecret: string,
  now: number,
): Promise<Session> {
  const { token: sessionToken, expiresAt } = await signSession(
    userId,
    jwtSecret,
    now,
  );
  const refreshToken = randomToken();
  await dbc.insert(schema.refreshTokens).values({
    id: uuid(),
    userId,
    tokenHash: await sha256Hex(refreshToken),
    createdAt: now,
    expiresAt: now + REFRESH_TTL_MS,
  });
  return { sessionToken, refreshToken, expiresAt };
}

/** POST /auth/exchange. */
export async function exchangeAndIssue(
  dbc: Db,
  cfg: GoogleConfig,
  input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    device: DeviceIdentity;
  },
  now = Date.now(),
): Promise<AuthExchangeResponse> {
  const identity = await exchangeCode({
    code: input.code,
    codeVerifier: input.codeVerifier,
    redirectUri: input.redirectUri,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
  });

  const user = await upsertUser(dbc, identity.sub, identity.email, now);
  await touchDevice(dbc, input.device, now);
  const session = await issueSession(dbc, user.id, cfg.jwtSecret, now);

  return {
    session,
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
  };
}

/** POST /auth/refresh — rotate: revoke the presented token, issue a new one. */
export async function refreshSession(
  dbc: Db,
  jwtSecret: string,
  rawRefresh: string,
  now = Date.now(),
): Promise<Session> {
  const hash = await sha256Hex(rawRefresh);
  const row = await dbc
    .select()
    .from(schema.refreshTokens)
    .where(
      and(
        eq(schema.refreshTokens.tokenHash, hash),
        isNull(schema.refreshTokens.revokedAt),
      ),
    )
    .get();

  if (!row || row.expiresAt <= now) throw fail.unauthorized("invalid refresh");

  // Reject blocked users at refresh time too.
  const user = await dbc
    .select({ blocked: schema.users.blocked })
    .from(schema.users)
    .where(eq(schema.users.id, row.userId))
    .get();
  if (!user) throw fail.unauthorized("unknown user");
  if (user.blocked) throw fail.blocked();

  await dbc
    .update(schema.refreshTokens)
    .set({ revokedAt: now })
    .where(eq(schema.refreshTokens.id, row.id));

  return issueSession(dbc, row.userId, jwtSecret, now);
}

/** POST /auth/logout — revoke the refresh token (idempotent). */
export async function logout(
  dbc: Db,
  rawRefresh: string,
  now = Date.now(),
): Promise<void> {
  const hash = await sha256Hex(rawRefresh);
  await dbc
    .update(schema.refreshTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(schema.refreshTokens.tokenHash, hash),
        isNull(schema.refreshTokens.revokedAt),
      ),
    );
}
