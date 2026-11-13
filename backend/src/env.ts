/** Worker bindings + secrets (wrangler.toml bindings, .dev.vars / secrets). */
export interface Env {
  /** D1 database (binding `DB`). */
  DB: D1Database;
  /** R2 bucket for ROMs (binding `ROMS`). */
  ROMS: R2Bucket;

  /* secrets (wrangler secret put / .dev.vars) */
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ENDPOINT: string;
  R2_BUCKET: string;
}

/** Hono generics for this app: typed bindings + per-request variables. */
export interface AppBindings {
  Bindings: Env;
  Variables: {
    /** Authenticated user id, set by the session middleware. */
    userId: string;
  };
}
