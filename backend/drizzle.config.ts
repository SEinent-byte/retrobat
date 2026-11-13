import { defineConfig } from "drizzle-kit";

// Generates SQL migrations into ./migrations, which `wrangler d1 migrations
// apply retrobat-db` runs against D1 (local and remote). The drizzle meta/
// subfolder is ignored by wrangler (it only executes .sql files).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});
