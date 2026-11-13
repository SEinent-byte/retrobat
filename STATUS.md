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

## NEXT STEP — §14 step 2 (backend)
1. `pnpm install` (root). D: has 77G free; prefer pnpm store on D: if C: gets tight.
2. Backend: D1 schema + migrations (drizzle) for SPEC §3 tables.
3. Backend endpoints `/auth/exchange`, `/auth/refresh`, `/license/status` against frozen `@retrobat/shared` contracts.
4. Then client (§14 step 3) can start in parallel (separate worktree, `/client` scope only).

## Pending user actions
- [ ] Verify `dotnet` on PATH (needed only for client, §14 step 3). `dotnet --version` in a NEW shell; still not found in this session.
- [ ] (Optional) Rotate GitHub PAT, then re-store via the `git credential approve` one-liner above.
