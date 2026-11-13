/**
 * Uniform error envelope. Every non-2xx API response has this body, so the
 * client can switch on a stable `code` instead of parsing prose or guessing
 * from the HTTP status.
 */

export const ApiErrorCode = {
  /** Malformed body / failed validation. */
  BadRequest: "bad_request",
  /** Missing/invalid/expired session token. */
  Unauthorized: "unauthorized",
  /** Authenticated but not allowed (e.g. non-admin on /admin/*). */
  Forbidden: "forbidden",
  /** Resource not found. */
  NotFound: "not_found",
  /** User or device is hard-blocked (SPEC §8). */
  Blocked: "blocked",
  /** Trial denied by the anti-farm rule (device already used a trial). */
  TrialAlreadyUsed: "trial_already_used",
  /** Action needs an active license the user does not have. */
  LicenseRequired: "license_required",
  /** Client API version incompatible with the server (see version.ts). */
  VersionMismatch: "version_mismatch",
  /** OAuth code exchange with Google failed. */
  AuthExchangeFailed: "auth_exchange_failed",
  /** Unexpected server error. */
  Internal: "internal",
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/** Body of any error response. */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    /** Human-readable, English, safe to log. Not for switching on. */
    message: string;
    /** Optional per-field validation details. */
    details?: Record<string, string>;
  };
}
