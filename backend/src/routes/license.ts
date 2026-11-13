/** /license/* routes (SPEC §5, §11). All require a session. */
import type {
  ActivateTrialResponse,
  LicenseStatusResponse,
} from "@retrobat/shared";
import { Hono } from "hono";
import { db } from "../db/client.js";
import type { AppBindings } from "../env.js";
import { activateTrialSchema } from "../lib/validation.js";
import { requireSession } from "../middleware/auth.js";
import { jsonBody } from "../middleware/validate.js";
import { activateTrial, getStatus } from "../services/license.js";

export const licenseRoutes = new Hono<AppBindings>();

licenseRoutes.use("*", requireSession);

licenseRoutes.get("/status", async (c) => {
  const res: LicenseStatusResponse = await getStatus(
    db(c.env.DB),
    c.get("userId"),
  );
  return c.json(res);
});

licenseRoutes.post(
  "/activate-trial",
  jsonBody(activateTrialSchema),
  async (c) => {
    const { device } = c.req.valid("json");
    const res: ActivateTrialResponse = await activateTrial(
      db(c.env.DB),
      c.get("userId"),
      device,
    );
    return c.json(res, 201);
  },
);
