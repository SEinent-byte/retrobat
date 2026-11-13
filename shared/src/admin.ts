/**
 * Admin panel contracts (SPEC §10, §11). All require an admin session.
 * These power the Cloudflare Pages owner panel; the client app never calls
 * them.
 */

import type { AbuseState, LicenseStatus } from "./enums.js";
import type { EpochMs, GameDto, SystemDto } from "./models.js";

/* ------------------------- admin auth (§10) ------------------------- */

/**
 * POST /admin/auth/google — public. The admin panel signs in with Google
 * (Google Identity Services) and posts the resulting id_token. The server
 * verifies it and issues an admin session only if the email is in `admins`.
 */
export interface AdminAuthRequest {
  /** Google id_token from GIS (audience = the admin web client id). */
  idToken: string;
}

export interface AdminSession {
  adminToken: string;
  expiresAt: EpochMs;
}

export interface AdminIdentity {
  id: string;
  email: string;
}

export interface AdminAuthResponse {
  session: AdminSession;
  admin: AdminIdentity;
}

/* ----------------------------- users ----------------------------- */

/** One row in the admin user list. */
export interface AdminUserDto {
  id: string;
  email: string;
  createdAt: EpochMs;
  blocked: boolean;
  abuseScore: number;
  abuseState: AbuseState;
  /** Effective license at query time. */
  licenseStatus: LicenseStatus;
  trialExpiresAt: EpochMs | null;
  subscriptionPeriodEnd: EpochMs | null;
  /** Fingerprint of the device tied to this user's trial, if any. */
  deviceFingerprint: string | null;
}

/** GET /admin/users — paged list, optional search. Query params: */
export interface AdminListUsersQuery {
  /** Substring match on email. */
  q?: string;
  limit?: number;
  offset?: number;
}
export interface AdminListUsersResponse {
  users: AdminUserDto[];
  total: number;
}

/**
 * POST /admin/users/:id/grant — extend/override trial or grant manual time
 * (SPEC §10). Exactly one of the fields is applied; `setTrialExpiresAt`
 * overrides, `extendTrialMs` adds to the current expiry.
 */
export interface AdminGrantTimeRequest {
  setTrialExpiresAt?: EpochMs;
  extendTrialMs?: number;
  /** Free-text reason, stored in the audit log. */
  reason?: string;
}
export interface AdminGrantTimeResponse {
  userId: string;
  trialExpiresAt: EpochMs | null;
}

/* --------------------------- analytics --------------------------- */

/** GET /admin/analytics/top-games — most played (SPEC §10). */
export interface TopGameRow {
  gameId: string;
  title: string;
  systemId: string;
  playCount: number;
  totalDurationSec: number;
}
export interface AdminTopGamesResponse {
  games: TopGameRow[];
}

/** GET /admin/analytics/now-playing — who is playing what (SPEC §10). */
export interface NowPlayingRow {
  userId: string;
  email: string;
  gameId: string;
  title: string;
  startedAt: EpochMs;
}
export interface AdminNowPlayingResponse {
  sessions: NowPlayingRow[];
}

/* ---------------------- systems (consoles) ----------------------- */

/** GET /admin/systems — full console list. */
export interface AdminListSystemsResponse {
  systems: SystemDto[];
}

/** POST /admin/systems — create or edit a console. Omit `id` to create. */
export interface AdminUpsertSystemRequest {
  id?: string;
  name: string;
  retrobatFolder: string;
  defaultCore: string | null;
  extensions: string[];
  sortOrder: number;
}
export type AdminUpsertSystemResponse = SystemDto;

/* ----------------------------- games ----------------------------- */

/**
 * POST /admin/games — add a game. The server validates `systemId` (FK) and
 * that `romFilename`'s extension is allowed for that system (SPEC §7.1).
 * The actual ROM upload to R2 is handled separately; `r2Key` is server-set.
 */
export interface AdminCreateGameRequest {
  systemId: string;
  title: string;
  romFilename: string;
  sizeBytes: number;
  trialEligible: boolean;
}
export type AdminCreateGameResponse = GameDto;

/**
 * POST /admin/games/:id/rom — upload the ROM bytes for a registered game to
 * R2 (SPEC §10). Request body is the raw ROM file (application/octet-stream),
 * not JSON. The server writes it to the game's `r2Key` and updates
 * `sizeBytes` to the actual byte length. Admin session required.
 */
export interface AdminUploadRomResponse {
  gameId: string;
  romFilename: string;
  /** Actual byte length written to R2 (overwrites the registered size). */
  sizeBytes: number;
  /** R2 object ETag of the stored object. */
  etag: string;
}

/** POST /admin/games/:id/free-window — set/clear the free window (SPEC §10). */
export interface AdminFreeWindowRequest {
  /** null on both clears the window. */
  freeFrom: EpochMs | null;
  freeUntil: EpochMs | null;
}
export type AdminFreeWindowResponse = GameDto;

/* ----------------------------- admins ---------------------------- */

/** POST /admin/admins — promote an existing user to admin by email (SPEC §10). */
export interface AdminPromoteRequest {
  email: string;
}
export interface AdminPromoteResponse {
  id: string;
  email: string;
  createdAt: EpochMs;
}
