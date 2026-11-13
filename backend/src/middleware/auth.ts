/** Session auth middleware: verifies the Bearer JWT, rejects blocked users. */
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { db, schema } from "../db/client.js";
import type { AppBindings } from "../env.js";
import { fail } from "../lib/http.js";
import { verifySession } from "../lib/jwt.js";

export const requireSession = createMiddleware<AppBindings>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw fail.unauthorized("missing bearer token");

  let userId: string;
  try {
    userId = await verifySession(match[1]!, c.env.JWT_SECRET);
  } catch {
    throw fail.unauthorized("invalid or expired session");
  }

  const user = await db(c.env.DB)
    .select({ blocked: schema.users.blocked })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!user) throw fail.unauthorized("unknown user");
  if (user.blocked) throw fail.blocked();

  c.set("userId", userId);
  await next();
});
