/** Admin auth middleware: verifies the admin JWT and confirms the admin row
/// still exists (revocation by removing from `admins`). */
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { db, schema } from "../db/client.js";
import type { AppBindings } from "../env.js";
import { fail } from "../lib/http.js";
import { verifyAdmin } from "../lib/jwt.js";

export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw fail.unauthorized("missing bearer token");

  let adminId: string;
  let email: string;
  try {
    ({ adminId, email } = await verifyAdmin(match[1]!, c.env.JWT_SECRET));
  } catch {
    throw fail.unauthorized("invalid or expired admin session");
  }

  const admin = await db(c.env.DB)
    .select({ id: schema.admins.id })
    .from(schema.admins)
    .where(eq(schema.admins.id, adminId))
    .get();
  if (!admin) throw fail.forbidden("not an admin");

  c.set("adminId", adminId);
  c.set("adminEmail", email);
  await next();
});
