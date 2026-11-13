/**
 * Canonical route paths and methods (SPEC §11). Single source of truth so
 * the backend router and the client API layer cannot drift on a URL.
 * `:param` segments are path parameters.
 */

export const HttpMethod = {
  GET: "GET",
  POST: "POST",
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

/** Auth requirement per route, for documentation and middleware wiring. */
export const AuthKind = {
  /** No auth: trust carried by PKCE or provider signature. */
  Public: "public",
  /** Bearer session JWT. */
  Session: "session",
  /** Refresh token in body. */
  Refresh: "refresh",
  /** Admin session. */
  Admin: "admin",
} as const;
export type AuthKind = (typeof AuthKind)[keyof typeof AuthKind];

export interface RouteDef {
  method: HttpMethod;
  path: string;
  auth: AuthKind;
}

export const ROUTES = {
  authExchange: { method: "POST", path: "/auth/exchange", auth: "public" },
  authRefresh: { method: "POST", path: "/auth/refresh", auth: "refresh" },
  authLogout: { method: "POST", path: "/auth/logout", auth: "session" },

  activateTrial: {
    method: "POST",
    path: "/license/activate-trial",
    auth: "session",
  },
  licenseStatus: { method: "GET", path: "/license/status", auth: "session" },

  catalog: { method: "GET", path: "/catalog", auth: "session" },
  downloadUrl: { method: "POST", path: "/download/url", auth: "session" },
  playEvent: { method: "POST", path: "/play/event", auth: "session" },

  billingCheckout: {
    method: "POST",
    path: "/billing/checkout",
    auth: "session",
  },
  billingWebhook: { method: "POST", path: "/billing/webhook", auth: "public" },

  adminAuthGoogle: {
    method: "POST",
    path: "/admin/auth/google",
    auth: "public",
  },
  adminUsers: { method: "GET", path: "/admin/users", auth: "admin" },
  adminGrant: {
    method: "POST",
    path: "/admin/users/:id/grant",
    auth: "admin",
  },
  adminTopGames: {
    method: "GET",
    path: "/admin/analytics/top-games",
    auth: "admin",
  },
  adminNowPlaying: {
    method: "GET",
    path: "/admin/analytics/now-playing",
    auth: "admin",
  },
  adminListSystems: { method: "GET", path: "/admin/systems", auth: "admin" },
  adminUpsertSystem: { method: "POST", path: "/admin/systems", auth: "admin" },
  adminCreateGame: { method: "POST", path: "/admin/games", auth: "admin" },
  adminFreeWindow: {
    method: "POST",
    path: "/admin/games/:id/free-window",
    auth: "admin",
  },
  adminPromote: { method: "POST", path: "/admin/admins", auth: "admin" },
} as const satisfies Record<string, RouteDef>;

export type RouteName = keyof typeof ROUTES;
