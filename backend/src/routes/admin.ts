/** /admin/* routes (SPEC §10, §11). Google-gated admin sessions. */
import type {
  AdminAuthResponse,
  AdminCreateGameResponse,
  AdminFreeWindowResponse,
  AdminGrantTimeResponse,
  AdminListSystemsResponse,
  AdminListUsersResponse,
  AdminNowPlayingResponse,
  AdminPromoteResponse,
  AdminTopGamesResponse,
  AdminUpsertSystemResponse,
} from "@retrobat/shared";
import { Hono } from "hono";
import { db } from "../db/client.js";
import type { AppBindings } from "../env.js";
import {
  adminAuthSchema,
  createGameSchema,
  freeWindowSchema,
  grantTimeSchema,
  promoteAdminSchema,
  upsertSystemSchema,
} from "../lib/validation.js";
import { requireAdmin } from "../middleware/admin.js";
import { jsonBody } from "../middleware/validate.js";
import {
  adminAuthGoogle,
  createGame,
  grantTime,
  listSystems,
  listUsers,
  nowPlaying,
  promoteAdmin,
  setFreeWindow,
  topGames,
  upsertSystem,
} from "../services/admin.js";

export const adminRoutes = new Hono<AppBindings>();

// Public: Google login gated by the admins table.
adminRoutes.post("/auth/google", jsonBody(adminAuthSchema), async (c) => {
  const { idToken } = c.req.valid("json");
  const res: AdminAuthResponse = await adminAuthGoogle(
    db(c.env.DB),
    c.env,
    idToken,
  );
  return c.json(res);
});

// Everything below requires an admin session.
adminRoutes.use("*", requireAdmin);

adminRoutes.get("/users", async (c) => {
  const res: AdminListUsersResponse = await listUsers(db(c.env.DB), {
    q: c.req.query("q"),
    limit: numParam(c.req.query("limit")),
    offset: numParam(c.req.query("offset")),
  });
  return c.json(res);
});

adminRoutes.post("/users/:id/grant", jsonBody(grantTimeSchema), async (c) => {
  const res: AdminGrantTimeResponse = await grantTime(
    db(c.env.DB),
    c.get("adminId"),
    c.req.param("id"),
    c.req.valid("json"),
  );
  return c.json(res);
});

adminRoutes.get("/analytics/top-games", async (c) => {
  const res: AdminTopGamesResponse = await topGames(db(c.env.DB));
  return c.json(res);
});

adminRoutes.get("/analytics/now-playing", async (c) => {
  const res: AdminNowPlayingResponse = await nowPlaying(db(c.env.DB));
  return c.json(res);
});

adminRoutes.get("/systems", async (c) => {
  const res: AdminListSystemsResponse = { systems: await listSystems(db(c.env.DB)) };
  return c.json(res);
});

adminRoutes.post("/systems", jsonBody(upsertSystemSchema), async (c) => {
  const res: AdminUpsertSystemResponse = await upsertSystem(
    db(c.env.DB),
    c.get("adminId"),
    c.req.valid("json"),
  );
  return c.json(res);
});

adminRoutes.post("/games", jsonBody(createGameSchema), async (c) => {
  const res: AdminCreateGameResponse = await createGame(
    db(c.env.DB),
    c.get("adminId"),
    c.req.valid("json"),
  );
  return c.json(res, 201);
});

adminRoutes.post("/games/:id/free-window", jsonBody(freeWindowSchema), async (c) => {
  const res: AdminFreeWindowResponse = await setFreeWindow(
    db(c.env.DB),
    c.get("adminId"),
    c.req.param("id"),
    c.req.valid("json"),
  );
  return c.json(res);
});

adminRoutes.post("/admins", jsonBody(promoteAdminSchema), async (c) => {
  const res: AdminPromoteResponse = await promoteAdmin(
    db(c.env.DB),
    c.get("adminId"),
    c.req.valid("json").email,
  );
  return c.json(res, 201);
});

function numParam(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
