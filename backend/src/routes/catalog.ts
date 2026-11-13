/** /catalog + /download routes (SPEC §7, §11). Session-protected. */
import type {
  CatalogResponse,
  DownloadUrlResponse,
} from "@retrobat/shared";
import { Hono } from "hono";
import { db } from "../db/client.js";
import type { AppBindings } from "../env.js";
import { downloadUrlSchema } from "../lib/validation.js";
import { requireSession } from "../middleware/auth.js";
import { jsonBody } from "../middleware/validate.js";
import { getCatalog, getDownloadUrl } from "../services/catalog.js";

export const catalogRoutes = new Hono<AppBindings>();

catalogRoutes.use("*", requireSession);

catalogRoutes.get("/", async (c) => {
  const res: CatalogResponse = await getCatalog(db(c.env.DB), c.get("userId"));
  return c.json(res);
});

export const downloadRoutes = new Hono<AppBindings>();

downloadRoutes.use("*", requireSession);

downloadRoutes.post("/url", jsonBody(downloadUrlSchema), async (c) => {
  const { gameId } = c.req.valid("json");
  const res: DownloadUrlResponse = await getDownloadUrl(
    db(c.env.DB),
    c.env,
    c.get("userId"),
    gameId,
  );
  return c.json(res);
});
