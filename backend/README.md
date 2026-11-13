# backend

Cloudflare Workers API. Business logic for auth, licensing, trial, anti-abuse, catalog, downloads.

Layout (see SPEC §2.1): `/routes`, `/services`, `/db`, `/lib`.

- DB: Cloudflare D1 (SQLite) via drizzle-kit.
- Storage: Cloudflare R2 (presigned URLs).
- Scheduled jobs: Cron Triggers.

Business logic never knows about HTTP or UI. Scope: `agente-backend` edits only this folder.
