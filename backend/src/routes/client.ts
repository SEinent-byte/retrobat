/** /client routes: desktop client auto-update metadata (public). */
import type { ClientVersionResponse } from "@retrobat/shared";
import { Hono } from "hono";
import type { AppBindings } from "../env.js";

export const clientRoutes = new Hono<AppBindings>();

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
