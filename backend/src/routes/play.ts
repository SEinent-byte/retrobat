/** /play route (SPEC §11). Session-protected analytics. */
import type { PlayAction, PlayEventResponse } from "@retrobat/shared";
import { Hono } from "hono";
import { db } from "../db/client.js";
import type { AppBindings } from "../env.js";
import { playEventSchema } from "../lib/validation.js";
import { requireSession } from "../middleware/auth.js";
import { jsonBody } from "../middleware/validate.js";
import { recordPlayEvent } from "../services/play.js";

export const playRoutes = new Hono<AppBindings>();

playRoutes.use("*", requireSession);

playRoutes.post("/event", jsonBody(playEventSchema), async (c) => {
  const body = c.req.valid("json");
  const res: PlayEventResponse = await recordPlayEvent(
    db(c.env.DB),
    c.get("userId"),
    {
      gameId: body.gameId,
      action: body.action as PlayAction,
      ...(body.durationSec != null ? { durationSec: body.durationSec } : {}),
    },
  );
  return c.json(res, 201);
});
