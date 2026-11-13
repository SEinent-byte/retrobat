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
