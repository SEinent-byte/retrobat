/** HTTP helpers: typed error exceptions mapped to the shared ApiError body. */
import type { ApiError, ApiErrorCode } from "@retrobat/shared";
import type { StatusCode } from "hono/utils/http-status";

const STATUS: Record<ApiErrorCode, StatusCode> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  blocked: 403,
  trial_already_used: 409,
  license_required: 402,
  version_mismatch: 409,
  auth_exchange_failed: 502,
  internal: 500,
};

/** Throwable API error; the app's onError handler renders it as ApiError. */
export class ApiException extends Error {
  readonly code: ApiErrorCode;
  readonly details: Record<string, string> | undefined;
  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, string>,
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }
  get status(): StatusCode {
    return STATUS[this.code];
  }
  toBody(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

/** Shorthand constructors. */
export const fail = {
  badRequest: (m = "bad request", d?: Record<string, string>) =>
    new ApiException("bad_request", m, d),
  unauthorized: (m = "unauthorized") => new ApiException("unauthorized", m),
  forbidden: (m = "forbidden") => new ApiException("forbidden", m),
  notFound: (m = "not found") => new ApiException("not_found", m),
  blocked: (m = "account or device blocked") =>
    new ApiException("blocked", m),
  trialAlreadyUsed: (m = "device already used its trial") =>
    new ApiException("trial_already_used", m),
  licenseRequired: (m = "active license required") =>
    new ApiException("license_required", m),
  versionMismatch: (m = "incompatible api version") =>
    new ApiException("version_mismatch", m),
  authExchangeFailed: (m = "oauth exchange failed") =>
    new ApiException("auth_exchange_failed", m),
  internal: (m = "internal error") => new ApiException("internal", m),
};
