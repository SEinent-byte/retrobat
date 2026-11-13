/**
 * Closed sets of string values shared across the API. Declared as `const`
 * objects + union types (not TS `enum`) so they survive `isolatedModules`,
 * serialize as plain strings, and translate cleanly to C# on the client.
 */

/** Effective license state for a user on a device (see SPEC §5). */
export const LicenseStatus = {
  /** Trial running; `expiresAt` in the future. */
  TrialActive: "trial_active",
  /** Trial consumed/expired; no active subscription. */
  TrialExpired: "trial_expired",
  /** Active paid subscription. */
  Subscribed: "subscribed",
  /** No trial and no subscription (e.g. anti-farm denial, fresh device). */
  None: "none",
} as const;
export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus];

/** Paid subscription lifecycle (see SPEC §3 `subscriptions.status`). */
export const SubscriptionStatus = {
  Active: "active",
  Canceled: "canceled",
  Expired: "expired",
} as const;
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

/** Play-event boundary reported by the client for analytics (SPEC §11). */
export const PlayAction = {
  Start: "start",
  End: "end",
} as const;
export type PlayAction = (typeof PlayAction)[keyof typeof PlayAction];

/**
 * Soft anti-abuse review state (SPEC §8.2). Degradation, never an instant
 * block. The hard block is the separate `blocked` flag on users/devices.
 */
export const AbuseState = {
  /** Normal. */
  Clear: "clear",
  /** Flagged by silent scoring; service may be degraded. */
  UnderReview: "under_review",
} as const;
export type AbuseState = (typeof AbuseState)[keyof typeof AbuseState];
