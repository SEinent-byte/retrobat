/** /client routes: desktop client auto-update metadata (public). */
import type { ClientVersionResponse } from "@retrobat/shared";
import { Hono } from "hono";
import type { AppBindings } from "../env.js";
import { presignDownload } from "../lib/r2.js";

export const clientRoutes = new Hono<AppBindings>();

/** Default R2 key for the latest installer when CLIENT_INSTALLER_KEY is unset. */
function installerKey(env: AppBindings["Bindings"]): string {
  const latest = env.CLIENT_LATEST_VERSION ?? "0.1.0";
  return env.CLIENT_INSTALLER_KEY ?? `releases/PlayVault-Setup-${latest}.exe`;
}

/**
 * GET /client/version — public. Returns the latest client build info from
 * config vars. Served without auth so the updater can run before sign-in.
 * Falls back to conservative defaults when the vars are unset.
 */
clientRoutes.get("/version", (c) => {
  const latest = c.env.CLIENT_LATEST_VERSION ?? "0.1.0";
  const res: ClientVersionResponse = {
    latestVersion: latest,
    minVersion: c.env.CLIENT_MIN_VERSION ?? latest,
    downloadUrl: c.env.CLIENT_DOWNLOAD_URL ?? "",
    notes: c.env.CLIENT_RELEASE_NOTES ?? null,
  };
  return c.json(res);
});

/**
 * GET /client/download — public. 302-redirects to a short-lived presigned R2
 * URL for the latest installer. Keeps the bucket private while exposing a
 * stable public link (set CLIENT_DOWNLOAD_URL to this route). The object key
 * defaults to releases/PlayVault-Setup-<latest>.exe; override with
 * CLIENT_INSTALLER_KEY. 404 if the installer object is missing.
 */
clientRoutes.get("/download", async (c) => {
  const key = installerKey(c.env);
  const head = await c.env.ROMS.head(key);
  if (!head) return c.json({ error: { code: "not_found", message: "no installer published" } }, 404);
  const { url } = await presignDownload(c.env, key);
  return c.redirect(url, 302);
});
