/**
 * License + trial business logic (SPEC §5, §3 anti-farm rule). No HTTP here.
 * The server clock is the single source of truth (SPEC §6); callers pass
 * `now` so this stays deterministic and testable.
 */
import { and, desc, eq } from "drizzle-orm";
import {
  type ActivateTrialResponse,
  AbuseState,
  type DeviceIdentity,
  LicenseStatus,
  type LicenseState,
  SubscriptionStatus,
} from "@retrobat/shared";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { uuid } from "../lib/crypto.js";
import { fail } from "../lib/http.js";

/** Trial length: 7 days. */
export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/** GET /license/status — effective state for the user. */
export async function getStatus(
  dbc: Db,
  userId: string,
  now = Date.now(),
): Promise<LicenseState> {
  const abuseState = await resolveAbuseState(dbc, userId);

  // Active subscription wins.
  const sub = await dbc
    .select()
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, SubscriptionStatus.Active),
      ),
    )
    .get();

  if (sub) {
    return {
      status: LicenseStatus.Subscribed,
      expiresAt: null,
      currentPeriodEnd: sub.currentPeriodEnd,
      serverTime: now,
      abuseState,
    };
  }

  // Otherwise the user's latest trial decides.
  const trial = await dbc
    .select()
    .from(schema.trials)
    .where(eq(schema.trials.userId, userId))
    .orderBy(desc(schema.trials.expiresAt))
    .get();

  if (!trial) {
    return {
      status: LicenseStatus.None,
      expiresAt: null,
      currentPeriodEnd: null,
      serverTime: now,
      abuseState,
    };
  }

  return {
    status:
      now < trial.expiresAt
        ? LicenseStatus.TrialActive
        : LicenseStatus.TrialExpired,
    expiresAt: trial.expiresAt,
    currentPeriodEnd: null,
    serverTime: now,
    abuseState,
  };
}

/**
 * POST /license/activate-trial — anti-farm rule: one trial per hardware
 * (SPEC §3). Denied if the device already has a trial, whatever the account.
 */
export async function activateTrial(
  dbc: Db,
  userId: string,
  device: DeviceIdentity,
  now = Date.now(),
): Promise<ActivateTrialResponse> {
  // Device must be known and not blocked.
  const dev = await dbc
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
      set: { lastSeenAt: now },
    })
    .returning({ blocked: schema.devices.blocked })
    .get();

  if (dev.blocked) throw fail.blocked("device blocked");

  // Hard anti-farm check.
  const prior = await dbc
    .select({ id: schema.trials.id })
    .from(schema.trials)
    .where(eq(schema.trials.deviceFingerprint, device.fingerprint))
    .get();
  if (prior) throw fail.trialAlreadyUsed();

  const expiresAt = now + TRIAL_MS;
  try {
    await dbc.insert(schema.trials).values({
      id: uuid(),
      userId,
      deviceFingerprint: device.fingerprint,
      startedAt: now,
      expiresAt,
    });
  } catch {
    // UNIQUE(device_fingerprint) race — treat as already used.
    throw fail.trialAlreadyUsed();
  }

  return { status: LicenseStatus.TrialActive, expiresAt };
}

async function resolveAbuseState(dbc: Db, userId: string): Promise<AbuseState> {
  const u = await dbc
    .select({ underReview: schema.users.underReview })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  return u?.underReview ? AbuseState.UnderReview : AbuseState.Clear;
}
