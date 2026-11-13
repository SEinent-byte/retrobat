# STATUS — next-session quickstart

_Last update: 2026-11-13. Operational state tracker (not design; design = `SPEC.md`)._

## Phase 0: COMPLETE (infra). Disk C: blocker RESOLVED (14G free).

## §14 step 1: DONE — `/shared` contracts FROZEN at `API_VERSION` 0.1.0.
- `@retrobat/shared` type-only package on `main` (commit `d050579`). `tsc --noEmit` passes.
- Files: version / enums / models / errors / api / admin / routes. See `shared/README.md`.
- Fan-out is now UNBLOCKED. Rule: module agents never edit `/shared`; a contract change re-freezes here + bumps `API_VERSION`.

### Cloudflare (account `anthoniogarciareyes25@gmail.com`, id `2263e816c670f9c372ddd4db453bc458`)
- **D1** `retrobat-db` → id `4ffd9d56-de6d-4a89-b61b-60d2193a072f` (binding `DB`)
- **R2** bucket `retrobat-roms` (binding `ROMS`); S3 endpoint `https://2263e816c670f9c372ddd4db453bc458.r2.cloudflarestorage.com`
- **Pages** `retrobat-admin` → https://retrobat-admin-7nj.pages.dev/
- **Worker** `retrobat-api`: NOT deployed yet (deploy with backend code)
- wrangler: logged in as anthonio (OAuth); run via `npx -y wrangler@latest ...`
- Config: `backend/wrangler.toml` (account_id + D1 + R2 bindings)

### Google OAuth
- Desktop app client created. id + secret stored in `backend/.dev.vars`.
- Loopback redirect needs no registration (RFC 8252, Desktop client).

### Secrets
- Local: `backend/.dev.vars` (gitignored) — `GOOGLE_CLIENT_ID/SECRET`, `JWT_SECRET`, `R2_ACCESS_KEY_ID/SECRET`, `R2_ENDPOINT`, `R2_BUCKET`.
- Prod: pending `wrangler secret put <NAME>` after first Worker deploy.

### Tooling
- node v26, pnpm 9.12.0 (global), git 2.55, wrangler via npx. OK.
- **.NET 8 SDK**: user installed via winget; NOT yet on PATH — verify `dotnet --version` in a NEW shell.

### GitHub
- Repo PRIVATE: `SEinent-byte/retrobat`, branch `main`.
- **PAT stored in Windows Credential Manager (GCM).** `git push origin main` works with NO inline token, and survives session clears. Do NOT pass tokens inline anymore.
- PAT was exposed in chat → rotating is still advised. If rotated, re-store once:
  ```
  printf "protocol=https\nhost=github.com\nusername=SEinent-byte\npassword=<NEW_PAT>\n\n" | git credential approve
  ```

## §14 step 2: DONE — backend auth + license (commit `afaa01c`).
- Stack: Hono + drizzle-orm/D1 + jose. `pnpm install` done (lockfile committed).
- D1 schema `migrations/0000` = all SPEC §3 tables + refresh_tokens + admin_audit. Applied LOCAL only.
- Endpoints live: `POST /auth/exchange|refresh|logout`, `GET /license/status`, `POST /license/activate-trial`.
- `tsc --noEmit` green. Trial flow verified e2e on `wrangler dev` (none -> trial_active -> trial_already_used).
- Worker NOT deployed to prod yet (needs secrets, see below).

## NEXT — §14 step 3 (client) can start in parallel
- Client scope `/client` (.NET WPF): Google OAuth loopback+PKCE, fingerprint, show license status.
- Backend step 4 (anti-farm) already folded into step 2; step 5 (clock anti-tamper) is client-side.
- Local backend run: `cd backend && pnpm dev` (uses `backend/.dev.vars`). Local D1 migrated.

## Pending USER actions (blockers for prod / client)
- [ ] **Deploy Worker to prod** needs: `cd backend && npx wrangler deploy`, then set secrets:
      `wrangler secret put GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|JWT_SECRET|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_ENDPOINT|R2_BUCKET`
      and `npm run db:migrate:remote` to apply schema to remote D1.
- [ ] **Seed first admin** in remote D1 (owner email) once deployed.
- [ ] Verify `dotnet` on PATH (needed for client, §14 step 3). Still not found in this session.
- [ ] (Optional) Rotate GitHub PAT, then re-store via the `git credential approve` one-liner above.
