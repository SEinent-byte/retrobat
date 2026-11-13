/**
 * D1 (SQLite) schema — SPEC §3, plus backend-internal `refresh_tokens` and
 * `admin_audit` not exposed in the shared contract.
 *
 * Timestamps are epoch milliseconds (UTC). Booleans are stored as 0/1.
 */
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Users (Google identity). */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // internal uuid
  googleSub: text("google_sub").notNull().unique(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
  abuseScore: integer("abuse_score").notNull().default(0),
  underReview: integer("under_review", { mode: "boolean" })
    .notNull()
    .default(false),
});

/** Devices (multilayer hardware fingerprint, SPEC §8.1). */
export const devices = sqliteTable("devices", {
  fingerprint: text("fingerprint").primaryKey(),
  machineGuid: text("machine_guid"),
  signalsJson: text("signals_json"), // raw combo: cpu, ram, disk, mac, screen
  firstSeenAt: integer("first_seen_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
  abuseScore: integer("abuse_score").notNull().default(0),
});

/** Trial activations — anti-farm rule: one trial per hardware (SPEC §3, §5). */
export const trials = sqliteTable(
  "trials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    deviceFingerprint: text("device_fingerprint")
      .notNull()
      .references(() => devices.fingerprint),
    startedAt: integer("started_at").notNull(), // first login, not signup
    expiresAt: integer("expires_at").notNull(), // started_at + 7 days
  },
  (t) => ({
    // 1 trial per hardware, regardless of google_sub.
    deviceUnique: uniqueIndex("trials_device_unique").on(t.deviceFingerprint),
    userIdx: index("trials_user_idx").on(t.userId),
  }),
);

/** Paid subscriptions (SPEC §3, §9). */
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    plan: text("plan").notNull(),
    status: text("status").notNull(), // active | canceled | expired
    providerRef: text("provider_ref"),
    startedAt: integer("started_at").notNull(),
    currentPeriodEnd: integer("current_period_end"),
    canceledAt: integer("canceled_at"),
  },
  (t) => ({
    userIdx: index("subscriptions_user_idx").on(t.userId),
  }),
);

/** Consoles / systems — closed list, first-class entity (SPEC §3, §7.1). */
export const systems = sqliteTable("systems", {
  id: text("id").primaryKey(), // e.g. 'nes', 'snes'
  name: text("name").notNull(),
  retrobatFolder: text("retrobat_folder").notNull(),
  defaultCore: text("default_core"),
  extensions: text("extensions").notNull(), // CSV: '.nes,.zip'
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Catalog games — always tied to a valid system (SPEC §3, §7.1). */
export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id),
    title: text("title").notNull(),
    r2Key: text("r2_key").notNull(), // never exposed to client
    romFilename: text("rom_filename").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    trialEligible: integer("trial_eligible", { mode: "boolean" })
      .notNull()
      .default(false),
    freeFrom: integer("free_from"),
    freeUntil: integer("free_until"),
  },
  (t) => ({
    systemIdx: index("games_system_idx").on(t.systemId),
  }),
);

/** Play analytics (SPEC §3). */
export const playEvents = sqliteTable(
  "play_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    startedAt: integer("started_at").notNull(),
    durationSec: integer("duration_sec"),
  },
  (t) => ({
    gameIdx: index("play_events_game_idx").on(t.gameId),
    userIdx: index("play_events_user_idx").on(t.userId),
  }),
);

/** Panel admins (seeded by hand, SPEC §10). */
export const admins = sqliteTable("admins", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

/* --------------- backend-internal (not in shared §3) --------------- */

/**
 * Refresh tokens for session renewal/revocation (SPEC §4). Stored hashed;
 * the raw token never touches D1. Revoked on logout; rotated on refresh.
 */
export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(), // SHA-256 of raw token
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (t) => ({
    userIdx: index("refresh_tokens_user_idx").on(t.userId),
  }),
);

/** Admin action audit log (SPEC §10). */
export const adminAudit = sqliteTable(
  "admin_audit",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    detailsJson: text("details_json"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    adminIdx: index("admin_audit_admin_idx").on(t.adminId),
  }),
);
