/**
 * Zod schemas for request bodies. Shapes mirror the frozen @retrobat/shared
 * types; `satisfies`-style parity is enforced by the route handlers typing
 * their output against the shared request interfaces.
 */
import { z } from "zod";

export const deviceSignalsSchema = z.object({
  machineGuid: z.string().nullable(),
  cpuModel: z.string().nullable(),
  cpuCores: z.number().int().nonnegative().nullable(),
  ramTotalBytes: z.number().int().nonnegative().nullable(),
  diskSerial: z.string().nullable(),
  baseboardSerial: z.string().nullable(),
  macAddress: z.string().nullable(),
  screenResolution: z.string().nullable(),
});

export const deviceIdentitySchema = z.object({
  fingerprint: z.string().min(1),
  signals: deviceSignalsSchema,
});

export const authExchangeSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
  redirectUri: z.string().url(),
  device: deviceIdentitySchema,
});

export const authRefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const authLogoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export const activateTrialSchema = z.object({
  device: deviceIdentitySchema,
});

export const downloadUrlSchema = z.object({
  gameId: z.string().min(1),
});

export const playEventSchema = z.object({
  gameId: z.string().min(1),
  action: z.enum(["start", "end"]),
  // nullish: client may send the key as null when it has no duration.
  durationSec: z.number().int().nonnegative().nullish(),
});

/* ------------------------------ admin ------------------------------ */

export const adminAuthSchema = z.object({
  idToken: z.string().min(1),
});

export const grantTimeSchema = z
  .object({
    setTrialExpiresAt: z.number().int().positive().optional(),
    extendTrialMs: z.number().int().optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => v.setTrialExpiresAt != null || v.extendTrialMs != null, {
    message: "setTrialExpiresAt or extendTrialMs required",
  });

export const upsertSystemSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  retrobatFolder: z.string().min(1),
  defaultCore: z.string().min(1).nullable(),
  extensions: z.array(z.string().min(1)).min(1),
  sortOrder: z.number().int().nonnegative(),
});

export const createGameSchema = z.object({
  systemId: z.string().min(1),
  title: z.string().min(1),
  romFilename: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  trialEligible: z.boolean(),
});

export const freeWindowSchema = z.object({
  freeFrom: z.number().int().positive().nullable(),
  freeUntil: z.number().int().positive().nullable(),
});

export const promoteAdminSchema = z.object({
  email: z.string().email(),
});
