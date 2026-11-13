/**
 * Admin panel business logic (SPEC §10). No HTTP here. Admin identity is
 * gated by the `admins` table; auth is Google login (the email must already
 * be an admin — admins are created by seeding or by promotion).
 */
import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import {
  type AdminAuthResponse,
  type AdminCreateGameRequest,
  type AdminFreeWindowRequest,
  type AdminGrantTimeRequest,
  type AdminGrantTimeResponse,
  type AdminListUsersResponse,
  type AdminNowPlayingResponse,
  type AdminPromoteResponse,
  type AdminTopGamesResponse,
  type AdminUpsertSystemRequest,
  type AdminUserDto,
  AbuseState,
  type GameDto,
  LicenseStatus,
  type SystemDto,
} from "@retrobat/shared";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import type { Env } from "../env.js";
import { uuid } from "../lib/crypto.js";
import { verifyIdToken } from "../lib/google.js";
import { fail } from "../lib/http.js";
import { signAdmin } from "../lib/jwt.js";
import { getStatus } from "./license.js";

/* ------------------------------- auth ------------------------------- */

/** POST /admin/auth/google — verify Google id_token, gate by admins table. */
export async function adminAuthGoogle(
  dbc: Db,
  env: Env,
  idToken: string,
  now = Date.now(),
): Promise<AdminAuthResponse> {
  const identity = await verifyIdToken(idToken, env.ADMIN_GOOGLE_CLIENT_ID);

  const admin = await dbc
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.email, identity.email))
    .get();
  if (!admin) throw fail.forbidden("not an admin");

  const { token, expiresAt } = await signAdmin(
    admin.id,
    admin.email,
    env.JWT_SECRET,
    now,
  );
  return {
    session: { adminToken: token, expiresAt },
    admin: { id: admin.id, email: admin.email },
  };
}

/* ------------------------------ users ------------------------------- */

export async function listUsers(
  dbc: Db,
  query: { q?: string; limit?: number; offset?: number },
  now = Date.now(),
): Promise<AdminListUsersResponse> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  const where = query.q ? like(schema.users.email, `%${query.q}%`) : undefined;

  const rows = await dbc
    .select()
    .from(schema.users)
    .where(where)
    .orderBy(desc(schema.users.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const totalRow = await dbc
    .select({ n: sql<number>`count(*)` })
    .from(schema.users)
    .where(where)
    .get();

  const users: AdminUserDto[] = [];
  for (const u of rows) {
    const state = await getStatus(dbc, u.id, now);
    const trialFp = await dbc
      .select({ fp: schema.trials.deviceFingerprint })
      .from(schema.trials)
      .where(eq(schema.trials.userId, u.id))
      .orderBy(desc(schema.trials.expiresAt))
      .get();
    users.push({
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      blocked: u.blocked,
      abuseScore: u.abuseScore,
      abuseState: u.underReview ? AbuseState.UnderReview : AbuseState.Clear,
      licenseStatus: state.status,
      trialExpiresAt:
        state.status === LicenseStatus.TrialActive ||
        state.status === LicenseStatus.TrialExpired
          ? state.expiresAt
          : null,
      subscriptionPeriodEnd: state.currentPeriodEnd,
      deviceFingerprint: trialFp?.fp ?? null,
    });
  }

  return { users, total: totalRow?.n ?? users.length };
}

/** POST /admin/users/:id/grant — override/extend the trial (SPEC §10). */
export async function grantTime(
  dbc: Db,
  adminId: string,
  userId: string,
  body: AdminGrantTimeRequest,
  now = Date.now(),
): Promise<AdminGrantTimeResponse> {
  const user = await dbc
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!user) throw fail.notFound("user not found");

  const trial = await dbc
    .select()
    .from(schema.trials)
    .where(eq(schema.trials.userId, userId))
    .orderBy(desc(schema.trials.expiresAt))
    .get();

  let newExpiry: number | null = null;
  if (body.setTrialExpiresAt != null) {
    newExpiry = body.setTrialExpiresAt;
  } else if (body.extendTrialMs != null) {
    const base = trial ? Math.max(trial.expiresAt, now) : now;
    newExpiry = base + body.extendTrialMs;
  }

  if (newExpiry != null && trial) {
    await dbc
      .update(schema.trials)
      .set({ expiresAt: newExpiry })
      .where(eq(schema.trials.id, trial.id));
  }

  await audit(dbc, adminId, "grant_time", userId, { ...body, newExpiry }, now);
  return { userId, trialExpiresAt: newExpiry ?? trial?.expiresAt ?? null };
}

/* ---------------------------- analytics ----------------------------- */

export async function topGames(dbc: Db): Promise<AdminTopGamesResponse> {
  const rows = await dbc
    .select({
      gameId: schema.playEvents.gameId,
      title: schema.games.title,
      systemId: schema.games.systemId,
      playCount: sql<number>`count(*)`,
      totalDurationSec: sql<number>`coalesce(sum(${schema.playEvents.durationSec}), 0)`,
    })
    .from(schema.playEvents)
    .innerJoin(schema.games, eq(schema.games.id, schema.playEvents.gameId))
    .groupBy(schema.playEvents.gameId)
    .orderBy(desc(sql`count(*)`))
    .limit(50)
    .all();
  return { games: rows };
}

export async function nowPlaying(dbc: Db): Promise<AdminNowPlayingResponse> {
  const rows = await dbc
    .select({
      userId: schema.playEvents.userId,
      email: schema.users.email,
      gameId: schema.playEvents.gameId,
      title: schema.games.title,
      startedAt: schema.playEvents.startedAt,
    })
    .from(schema.playEvents)
    .innerJoin(schema.users, eq(schema.users.id, schema.playEvents.userId))
    .innerJoin(schema.games, eq(schema.games.id, schema.playEvents.gameId))
    .where(isNull(schema.playEvents.durationSec))
    .orderBy(desc(schema.playEvents.startedAt))
    .all();
  return { sessions: rows };
}

/* ---------------------- systems (consoles) -------------------------- */

export async function listSystems(dbc: Db): Promise<SystemDto[]> {
  const rows = await dbc
    .select()
    .from(schema.systems)
    .orderBy(schema.systems.sortOrder)
    .all();
  return rows.map(toSystemDto);
}

export async function upsertSystem(
  dbc: Db,
  adminId: string,
  body: AdminUpsertSystemRequest,
  now = Date.now(),
): Promise<SystemDto> {
  const extensions = normalizeExtensions(body.extensions);
  const id = body.id ?? body.name.trim().toLowerCase().replace(/\s+/g, "");
  if (!id) throw fail.badRequest("system id/name required");

  await dbc
    .insert(schema.systems)
    .values({
      id,
      name: body.name,
      retrobatFolder: body.retrobatFolder,
      defaultCore: body.defaultCore,
      extensions: extensions.join(","),
      sortOrder: body.sortOrder,
    })
    .onConflictDoUpdate({
      target: schema.systems.id,
      set: {
        name: body.name,
        retrobatFolder: body.retrobatFolder,
        defaultCore: body.defaultCore,
        extensions: extensions.join(","),
        sortOrder: body.sortOrder,
      },
    });

  await audit(dbc, adminId, "upsert_system", id, body, now);
  const row = await dbc
    .select()
    .from(schema.systems)
    .where(eq(schema.systems.id, id))
    .get();
  return toSystemDto(row!);
}

/* ------------------------------ games ------------------------------- */

/**
 * POST /admin/games — add a game. Validates the system FK and that the ROM
 * extension is allowed for that system (SPEC §7.1). The ROM is uploaded to
 * R2 separately; r2_key is derived here.
 */
export async function createGame(
  dbc: Db,
  adminId: string,
  body: AdminCreateGameRequest,
  now = Date.now(),
): Promise<GameDto> {
  const system = await dbc
    .select()
    .from(schema.systems)
    .where(eq(schema.systems.id, body.systemId))
    .get();
  if (!system) throw fail.badRequest("unknown system", { systemId: "not found" });

  const ext = fileExt(body.romFilename);
  const allowed = normalizeExtensions(system.extensions.split(","));
  if (!ext || !allowed.includes(ext)) {
    throw fail.badRequest(
      `extension ${ext || "(none)"} not allowed for ${system.id}`,
      { romFilename: `allowed: ${allowed.join(", ")}` },
    );
  }

  const id = uuid();
  const r2Key = `roms/${system.retrobatFolder}/${body.romFilename}`;
  await dbc.insert(schema.games).values({
    id,
    systemId: body.systemId,
    title: body.title,
    r2Key,
    romFilename: body.romFilename,
    sizeBytes: body.sizeBytes,
    trialEligible: body.trialEligible,
  });

  await audit(dbc, adminId, "create_game", id, body, now);
  const row = await dbc.select().from(schema.games).where(eq(schema.games.id, id)).get();
  return toGameDto(row!);
}

export async function setFreeWindow(
  dbc: Db,
  adminId: string,
  gameId: string,
  body: AdminFreeWindowRequest,
  now = Date.now(),
): Promise<GameDto> {
  const game = await dbc.select().from(schema.games).where(eq(schema.games.id, gameId)).get();
  if (!game) throw fail.notFound("game not found");
  if (body.freeFrom != null && body.freeUntil != null && body.freeFrom > body.freeUntil) {
    throw fail.badRequest("freeFrom must be <= freeUntil");
  }

  await dbc
    .update(schema.games)
    .set({ freeFrom: body.freeFrom, freeUntil: body.freeUntil })
    .where(eq(schema.games.id, gameId));

  await audit(dbc, adminId, "free_window", gameId, body, now);
  const row = await dbc.select().from(schema.games).where(eq(schema.games.id, gameId)).get();
  return toGameDto(row!);
}

/* ------------------------------ admins ------------------------------ */

/** POST /admin/admins — promote an existing user to admin by email. */
export async function promoteAdmin(
  dbc: Db,
  adminId: string,
  email: string,
  now = Date.now(),
): Promise<AdminPromoteResponse> {
  const user = await dbc
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (!user) throw fail.notFound("no user with that email");

  const existing = await dbc
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.email, email))
    .get();
  if (existing) {
    return { id: existing.id, email: existing.email, createdAt: existing.createdAt };
  }

  const id = uuid();
  await dbc.insert(schema.admins).values({ id, email, createdAt: now });
  await audit(dbc, adminId, "promote_admin", id, { email }, now);
  return { id, email, createdAt: now };
}

/* ------------------------------ helpers ----------------------------- */

async function audit(
  dbc: Db,
  adminId: string,
  action: string,
  targetId: string | null,
  details: unknown,
  now: number,
): Promise<void> {
  await dbc.insert(schema.adminAudit).values({
    id: uuid(),
    adminId,
    action,
    targetId,
    detailsJson: JSON.stringify(details),
    createdAt: now,
  });
}

function fileExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

function normalizeExtensions(exts: string[]): string[] {
  return exts
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((e) => (e.startsWith(".") ? e : `.${e}`));
}

function toSystemDto(s: typeof schema.systems.$inferSelect): SystemDto {
  return {
    id: s.id,
    name: s.name,
    retrobatFolder: s.retrobatFolder,
    defaultCore: s.defaultCore,
    extensions: s.extensions.split(",").map((e) => e.trim()).filter(Boolean),
    sortOrder: s.sortOrder,
  };
}

function toGameDto(g: typeof schema.games.$inferSelect): GameDto {
  return {
    id: g.id,
    systemId: g.systemId,
    title: g.title,
    romFilename: g.romFilename,
    sizeBytes: g.sizeBytes,
    trialEligible: g.trialEligible,
    freeFrom: g.freeFrom,
    freeUntil: g.freeUntil,
  };
}
