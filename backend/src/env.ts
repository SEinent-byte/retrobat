/** Worker bindings + secrets (wrangler.toml bindings, .dev.vars / secrets). */
export interface Env {
  /** D1 database (binding `DB`). */
  DB: D1Database;
  /** R2 bucket for ROMs (binding `ROMS`). */
  ROMS: R2Bucket;

  /* secrets (wrangler secret put / .dev.vars) */
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Google WEB OAuth client id for the admin panel (GIS). */
  ADMIN_GOOGLE_CLIENT_ID: string;
  JWT_SECRET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ENDPOINT: string;
  R2_BUCKET: string;

  /* client auto-update (non-secret vars, wrangler.toml [vars]; optional) */
  /** Latest published desktop client version (semver). */
  CLIENT_LATEST_VERSION?: string;
  /** Minimum supported client version; older clients must update. */
  CLIENT_MIN_VERSION?: string;
  /** Installer download URL for the latest client. */
  CLIENT_DOWNLOAD_URL?: string;
  /** Optional release notes for the latest client. */
  CLIENT_RELEASE_NOTES?: string;
}

/** Hono generics for this app: typed bindings + per-request variables. */
export interface AppBindings {
  Bindings: Env;
  Variables: {
    /** Authenticated user id, set by the session middleware. */
    userId: string;
    /** Authenticated admin, set by the admin middleware. */
    adminId: string;
    adminEmail: string;
  };
}
