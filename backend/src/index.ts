/** Cloudflare Worker entry: Hono app wiring routes + uniform error envelope. */
import { API_VERSION, type ApiError } from "@retrobat/shared";
import { Hono } from "hono";
import type { AppBindings } from "./env.js";
import { ApiException, fail } from "./lib/http.js";
import { authRoutes } from "./routes/auth.js";
import { catalogRoutes, downloadRoutes } from "./routes/catalog.js";
import { licenseRoutes } from "./routes/license.js";
import { playRoutes } from "./routes/play.js";

const app = new Hono<AppBindings>();

app.get("/health", (c) => c.json({ ok: true, apiVersion: API_VERSION }));

app.route("/auth", authRoutes);
app.route("/license", licenseRoutes);
app.route("/catalog", catalogRoutes);
app.route("/download", downloadRoutes);
app.route("/play", playRoutes);

app.notFound(() => {
  throw fail.notFound("no such route");
});

app.onError((err, c) => {
  if (err instanceof ApiException) {
    return c.json<ApiError>(err.toBody(), err.status);
  }
  console.error("unhandled error", err);
  const internal = fail.internal();
  return c.json<ApiError>(internal.toBody(), internal.status);
});

export default app;
