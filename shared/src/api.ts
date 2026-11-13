/**
 * Per-endpoint request/response contracts (SPEC §11). One `*Request` /
 * `*Response` pair per endpoint. Success bodies only; every error uses the
 * {@link ApiError} envelope from errors.ts.
 *
 * Auth model per endpoint is documented inline:
 *  - "public": no auth (PKCE / provider signature carries trust)
 *  - "session": Bearer session JWT
 *  - "refresh": refresh token in body
 *  - "admin": admin session
 */

import type { PlayAction } from "./enums.js";
import type {
  DeviceIdentity,
  EpochMs,
  GameDto,
  LicenseState,
  SystemDto,
  UserDto,
} from "./models.js";

/* ----------------------------- auth ----------------------------- */

/** POST /auth/exchange — public. Exchanges the OAuth code (SPEC §4). */
export interface AuthExchangeRequest {
  /** Authorization code from Google's loopback redirect. */
  code: string;
  /** PKCE verifier matching the challenge sent to Google. */
  codeVerifier: string;
  /** Exact loopback redirect URI used, e.g. "http://127.0.0.1:49152/callback". */
  redirectUri: string;
  /** Device identity, so first login can anchor the trial/device. */
  device: DeviceIdentity;
}

export interface Session {
  /** Short-lived session JWT (Bearer). */
  sessionToken: string;
  /** Long-lived refresh token (opaque). */
  refreshToken: string;
  /** Session token expiry. */
  expiresAt: EpochMs;
}

export interface AuthExchangeResponse {
  session: Session;
  user: UserDto;
}

/** POST /auth/refresh — refresh. Renews the session (SPEC §4). */
export interface AuthRefreshRequest {
  refreshToken: string;
}
export type AuthRefreshResponse = Session;

/** POST /auth/logout — session. Revokes the refresh token (SPEC §4). */
export interface AuthLogoutRequest {
  refreshToken: string;
}
export interface AuthLogoutResponse {
  ok: true;
}

/* ---------------------------- license ---------------------------- */

/** POST /license/activate-trial — session. Anti-farm rule (SPEC §5, §3). */
export interface ActivateTrialRequest {
  device: DeviceIdentity;
}
export interface ActivateTrialResponse {
  status: LicenseState["status"];
  expiresAt: EpochMs;
}

/** GET /license/status — session. Effective license (SPEC §5). No request body. */
export type LicenseStatusResponse = LicenseState;

/* ---------------------------- catalog ---------------------------- */

/**
 * GET /catalog — session. Games visible under the caller's license plus any
 * active free window (SPEC §7, §10). Systems are returned alongside so the
 * client can group and know `retrobatFolder`/`defaultCore`.
 */
export interface CatalogResponse {
  systems: SystemDto[];
  games: GameDto[];
}

/* ---------------------------- download ---------------------------- */

/** POST /download/url — session. Presigned R2 URL (SPEC §7). */
export interface DownloadUrlRequest {
  gameId: string;
}
export interface DownloadUrlResponse {
  /** Presigned R2 URL, short expiry. */
  url: string;
  expiresAt: EpochMs;
  romFilename: string;
  sizeBytes: number;
  /** Expected file hash for client-side verification; null if unknown. */
  sha256: string | null;
  /** Where the client drops the ROM and how to launch it (SPEC §7.1). */
  retrobatFolder: string;
  defaultCore: string | null;
}

/* ------------------------------ play ------------------------------ */

/** POST /play/event — session. Analytics (SPEC §11). */
export interface PlayEventRequest {
  gameId: string;
  action: PlayAction;
  /** Seconds played; sent with action="end". */
  durationSec?: number;
}
export interface PlayEventResponse {
  ok: true;
  eventId: string;
}

/* ----------------------------- billing ---------------------------- */

/** POST /billing/checkout — session. Starts a payment session (SPEC §9). */
export interface BillingCheckoutRequest {
  plan: string;
}
export interface BillingCheckoutResponse {
  checkoutUrl: string;
}

/**
 * POST /billing/webhook — public (provider signature). Provider is TBD
 * (SPEC §12), so the body stays opaque in the shared contract and is
 * validated against the provider's signature server-side.
 */
export type BillingWebhookRequest = unknown;
export interface BillingWebhookResponse {
  received: true;
}

/* ----------------------------- client ----------------------------- */

/**
 * GET /client/version — public. Latest desktop client build, for the
 * auto-updater. No request body. The client compares its own build to
 * `latestVersion` (offer update) and `minVersion` (force update).
 */
export interface ClientVersionResponse {
  /** Latest published client version (semver, e.g. "0.1.0"). */
  latestVersion: string;
  /** Minimum supported version; clients below this must update to run. */
  minVersion: string;
  /** Download URL for the latest installer. */
  downloadUrl: string;
  /** Human-readable release notes, or null. */
  notes: string | null;
}
