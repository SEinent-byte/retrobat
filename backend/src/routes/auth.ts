/** /auth/* routes (SPEC §4, §11). */
import type {
  AuthExchangeResponse,
  AuthLogoutResponse,
  AuthRefreshResponse,
} from "@retrobat/shared";
import { Hono } from "hono";
import { db } from "../db/client.js";
import type { AppBindings } from "../env.js";
import { jsonBody } from "../middleware/validate.js";
import {
  authExchangeSchema,
  authLogoutSchema,
  authRefreshSchema,
} from "../lib/validation.js";
import { exchangeAndIssue, logout, refreshSession } from "../services/auth.js";

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/exchange", jsonBody(authExchangeSchema), async (c) => {
  const input = c.req.valid("json");
  const res: AuthExchangeResponse = await exchangeAndIssue(
    db(c.env.DB),
    {
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      jwtSecret: c.env.JWT_SECRET,
    },
    input,
  );
  return c.json(res, 201);
});

authRoutes.post("/refresh", jsonBody(authRefreshSchema), async (c) => {
  const { refreshToken } = c.req.valid("json");
  const res: AuthRefreshResponse = await refreshSession(
    db(c.env.DB),
    c.env.JWT_SECRET,
    refreshToken,
  );
  return c.json(res);
});

authRoutes.post("/logout", jsonBody(authLogoutSchema), async (c) => {
  const { refreshToken } = c.req.valid("json");
  await logout(db(c.env.DB), refreshToken);
  const res: AuthLogoutResponse = { ok: true };
  return c.json(res);
});
