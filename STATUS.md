# STATUS — next-session quickstart

_Last update: 2026-11-13. Operational state tracker (not design; design = `SPEC.md`)._

---
## ▶ RESUME HERE (read first)

**MVP progress ≈ 80%.** Functional core DONE + deployed to prod. Remaining = monetization + distribution.

**What works right now (prod):**
- Backend Worker live, all user + admin endpoints. Latest prod Version `45976e2` era (redeploy `cd backend && npx wrangler deploy` after pulls).
- Client WPF: Google login, fingerprint, trial, anti-tamper, catalog sync into RetroBat.
- Admin panel live: https://retrobat-admin-7nj.pages.dev (login needs web-client, see Pending USER).
- ES-native: games show inside RetroBat; proxy launcher downloads ROM on launch (HTTPS direct). Proxy INSTALLED on this machine.

**Progress breakdown:**
| Area | % |
|---|---|
| Infra / auth / license / trial / anti-farm / anti-tamper | 100 |
| Catalog / R2 download / play analytics | 100 |
| Admin API + panel | 95 (login needs web-client) |
| ES-native integration (sync + proxy) | 90 (real-ROM emulation untested) |
| Billing (step 9) | 0 — BLOCKED on provider |
| Domain (step 10) | 0 — user |
| Admin ROM upload to R2 + distribution installer/auto-update | ~10 |

**Next session should tackle (in order):**
1. Admin login web-client (user action) → then test panel live.
2. Admin ROM **upload** endpoint (`POST /admin/games/:id/rom` → R2) + panel upload UI. (Today admin only registers the row; ROM is uploaded out-of-band.)
3. Step 9 billing once provider chosen (Stripe recommended): `/billing/checkout` + `/billing/webhook` + subscriptions.
4. Step 10 domain + Google redirect update.
5. Distribution: single installer bundling .NET runtime + proxy install + auto-update.

**Repo:** `SEinent-byte/retrobat` (private), branch `main`, clean. Push works (PAT in Credential Manager). `.NET` via `C:\Program Files\dotnet\dotnet.exe`.

**Rollback proxy if needed:** `client/scripts/uninstall-launcher.ps1`.

---

## Phase 0: COMPLETE (infra). Disk C: blocker RESOLVED (14G free).

## §14 step 1: DONE — `/shared` contracts FROZEN at `API_VERSION` 0.1.0.
- `@retrobat/shared` type-only package on `main` (commit `d050579`). `tsc --noEmit` passes.
- Files: version / enums / models / errors / api / admin / routes. See `shared/README.md`.
- Fan-out is now UNBLOCKED. Rule: module agents never edit `/shared`; a contract change re-freezes here + bumps `API_VERSION`.

### Cloudflare (account `anthoniogarciareyes25@gmail.com`, id `2263e816c670f9c372ddd4db453bc458`)
- **D1** `retrobat-db` → id `4ffd9d56-de6d-4a89-b61b-60d2193a072f` (binding `DB`)
- **R2** bucket `retrobat-roms` (binding `ROMS`); S3 endpoint `https://2263e816c670f9c372ddd4db453bc458.r2.cloudflarestorage.com`
- **Pages** `retrobat-admin` → https://retrobat-admin-7nj.pages.dev/ (admin panel DEPLOYED)
- **Worker** `retrobat-api`: DEPLOYED → https://retrobat-api.anthoniogarciareyes25.workers.dev
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
## Prod DEPLOYED (2026-11-13)
- Worker live: **https://retrobat-api.anthoniogarciareyes25.workers.dev** (`/health` ok, apiVersion 0.1.0).
- All 8 secrets set via `wrangler secret put` (from `.dev.vars`).
- Remote D1 migrated (`0000` applied, 22 commands).
- **.NET 8 SDK installed**: 8.0.428 at `C:\Program Files\dotnet`. New shells get it on PATH (winget machine PATH); this bash session may still miss it — call full path if needed.

## §14 step 3: DONE — client WPF login + fingerprint + status (commit `757249b`).
- .NET 8 WPF, 3 projects (SPEC §2.1): RetroBat.Core / .Services / .App. `dotnet build` green, 0 warnings.
- Core: C# mirror of shared contracts, DeviceFingerprintProvider (MachineGuid+WMI, SHA-256), PKCE S256.
- Services: GoogleOAuthFlow (loopback+PKCE), ApiClient (X-Api-Version, typed errors), TokenStore (DPAPI), SessionManager (auto-refresh on 401).
- App points at prod Worker by default (`ClientConfig.Default`).
- Build client: `cd client && "C:\Program Files\dotnet\dotnet.exe" build RetroBat.sln`. Run: `... run --project RetroBat.App`.
- Step 4 (anti-farm) folded into step 2.

## §14 step 5: DONE — client clock anti-tamper (commit in main).
- `ClockGuard` (Core): DPAPI forward-only high-water mark of server time in HKCU\Software\RetroBat; SessionManager advances it each `/license/status` and warns on local roll-back. Server stays authoritative.

## §14 step 6: DONE — backend catalog + R2 downloads + systems seed (commit `ae55605`).
- `GET /catalog` (license-filtered), `POST /download/url` (R2 presigned 300s via aws4fetch).
- `seeds/0001_systems.sql`: 10 RetroBat consoles, applied LOCAL + REMOTE.
- Deployed to prod (Worker Version `392f5a83`). Verified on dev: visibility, presign, license_required, not_found.

## §14 step 7: DONE — play events + download + launch (commit `3ab38e5`, prod Version `43110f29`).
- Backend `POST /play/event` (start opens row, end closes it).
- NOTE: step 7 client parts (GameService, aria2, in-app catalog/Play) were SUPERSEDED by the ES-native pivot below. aria2 removed; downloads are now direct HTTPS.

## Admin seeded
- `admins`: anthoniogarciareyes25@gmail.com (id `54936e54-...`), remote + local.

## §14 step 8: DONE — admin API + panel (shared 0.2.0, backend Version `86292d74`).
- Backend `/admin/*`: Google-gated admin sessions, users+grant, analytics (top-games/now-playing), systems upsert, game create (extension validation), free-window, promote; admin_audit on every mutation; CORS on /admin/*.
- Panel (Vite+React+TS) live: **https://retrobat-admin-7nj.pages.dev** — Users / Consoles&Games / Analytics tabs.
- Admin login = GIS (needs a Google WEB OAuth client; see below). Verified prod /admin/* with a signed admin token.

## ARCHITECTURE PIVOT (done): ES-native, aria2 dropped (commit `de06962`/`88c83a2`).
- Games live INSIDE RetroBat (EmulationStation), not a WPF storefront.
- `CatalogSync` (in WPF, post-login) writes per-game stub `RBSTUB:<gameId>` at `roms\<folder>\<rom>` + `gamelist.xml`. Real downloaded ROMs preserved.
- `RetroBat.Launcher` = proxy installed AS `emulationstation\emulatorLauncher.exe` (original kept as `emulatorLauncher_real.exe`). On launch: stub -> license check -> presigned R2 -> **direct HTTPS download** (HttpDownloadManager; aria2 removed) -> progress window -> play start -> real launcher -> play end.
- WPF = account panel only (sign-in, status, start trial, sign out).
- Install/uninstall: `client/scripts/install-launcher.ps1` / `uninstall-launcher.ps1`. **Proxy INSTALLED on this machine** (original backed up).
- Verified: isolated wrapper run downloaded real ROM over stub (43->528B, NES header); sync wrote gamelist+preserved ROM; play start/end hit prod.
- `.NET` note: proxy published framework-dependent single-file (needs .NET 8 Desktop runtime on target).

## NEXT: step 9 (billing) BLOCKED — payment provider TBD (SPEC §12). Step 10 (domain) — user.

## Pending USER
- [ ] **Google WEB OAuth client** for admin login: create a "Web application" OAuth client in Google Cloud, add origin `https://retrobat-admin-7nj.pages.dev` (and `http://localhost:5173` for dev) to Authorized JavaScript origins. Then:
      - set Pages build var `VITE_ADMIN_GOOGLE_CLIENT_ID` = that id (and redeploy), AND
      - `cd backend && npx wrangler secret put ADMIN_GOOGLE_CLIENT_ID` = same id.
      Until then the panel shows setup instructions instead of a login button.
- [ ] **Payment provider** decision to unblock step 9 (Stripe or other).
- [ ] (optional) **Test client Google sign-in**: `cd client && "C:\Program Files\dotnet\dotnet.exe" run --project RetroBat.App`.
- [ ] (Optional) Rotate GitHub PAT, then re-store via the `git credential approve` one-liner above.
