/**
 * Entity DTOs: the shapes the API exchanges over the wire. These mirror the
 * D1 tables (SPEC §3) but are NOT the DB rows themselves — they expose only
 * what a client is allowed to see. Secret/internal columns (e.g. raw abuse
 * internals, google_sub) stay server-side.
 *
 * All timestamps are epoch milliseconds (UTC, server authority — SPEC §6).
 */

import type {
  AbuseState,
  LicenseStatus,
  SubscriptionStatus,
} from "./enums.js";

/** Epoch milliseconds, UTC. Server clock is the source of truth. */
export type EpochMs = number;

/** Public view of the authenticated user. */
export interface UserDto {
  id: string;
  email: string;
  createdAt: EpochMs;
}

/**
 * Multilayer hardware/OS signals collected by the client (SPEC §8.1).
 * Sent as a package, not just a hash, so the server can score combos.
 * Any field may be null when the client cannot read it.
 */
export interface DeviceSignals {
  /** HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid — primary anchor. */
  machineGuid: string | null;
  cpuModel: string | null;
  cpuCores: number | null;
  ramTotalBytes: number | null;
  /** Win32_DiskDrive serial of the system disk. */
  diskSerial: string | null;
  /** Win32_BaseBoard serial. */
  baseboardSerial: string | null;
  macAddress: string | null;
  /** e.g. "1920x1080". */
  screenResolution: string | null;
}

/**
 * Device identity sent by the client on trial/login flows.
 * `fingerprint` = SHA-256(machineGuid + stable combo) computed client-side;
 * `signals` is the raw package the server scores and stores (SPEC §8.1).
 */
export interface DeviceIdentity {
  fingerprint: string;
  signals: DeviceSignals;
}

/** A console/system (SPEC §3 `systems`). Closed list, first-class entity. */
export interface SystemDto {
  id: string;
  name: string;
  /** Folder under RetroBat `roms\<folder>`. */
  retrobatFolder: string;
  /** Default emulator core, or null to let RetroBat decide. */
  defaultCore: string | null;
  /** Valid ROM extensions for this system, e.g. [".nes", ".zip"]. */
  extensions: string[];
  sortOrder: number;
}

/**
 * A catalog game (SPEC §3 `games`). `r2Key` is never exposed to the client;
 * downloads go through a presigned URL from POST /download/url.
 */
export interface GameDto {
  id: string;
  systemId: string;
  title: string;
  romFilename: string;
  sizeBytes: number;
  /** Permanently playable during trial. */
  trialEligible: boolean;
  /** Optional admin free window (SPEC §10); null = no window. */
  freeFrom: EpochMs | null;
  freeUntil: EpochMs | null;
}

/** Subscription summary exposed to the owner's client. */
export interface SubscriptionDto {
  plan: string;
  status: SubscriptionStatus;
  startedAt: EpochMs;
  currentPeriodEnd: EpochMs | null;
  canceledAt: EpochMs | null;
}

/** Effective license snapshot returned by GET /license/status (SPEC §5). */
export interface LicenseState {
  status: LicenseStatus;
  /** Trial end, present when status is trial_active/trial_expired. */
  expiresAt: EpochMs | null;
  /** Subscription period end, present when subscribed. */
  currentPeriodEnd: EpochMs | null;
  /** Server clock at response time — client anti-tamper anchor (SPEC §6). */
  serverTime: EpochMs;
  /** Soft anti-abuse state; client may show reduced service. */
  abuseState: AbuseState;
}
