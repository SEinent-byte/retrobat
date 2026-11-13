/**
 * API contract version. Bumped when a frozen contract changes.
 * Client and backend compare this to detect drift.
 * Sent by the client in the `X-Api-Version` header; the backend may reject
 * a mismatching MAJOR.
 */
export const API_VERSION = "0.2.0" as const;

/** Header carrying {@link API_VERSION} on every client request. */
export const API_VERSION_HEADER = "X-Api-Version" as const;
