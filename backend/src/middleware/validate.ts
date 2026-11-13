/** zod body validator that emits errors in the shared ApiError shape. */
import { zValidator } from "@hono/zod-validator";
import type { ZodSchema } from "zod";
import { fail } from "../lib/http.js";

export function jsonBody<T extends ZodSchema>(schema: T) {
  return zValidator("json", schema, (result) => {
    if (!result.success) {
      const details: Record<string, string> = {};
      for (const issue of result.error.issues) {
        details[issue.path.join(".") || "_"] = issue.message;
      }
      throw fail.badRequest("request validation failed", details);
    }
  });
}
