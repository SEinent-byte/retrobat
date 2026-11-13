import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";

/** Build a drizzle client bound to the request's D1 instance. */
export function db(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof db>;
export { schema };
