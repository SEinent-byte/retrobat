# STATUS — next-session quickstart

_Last update: 2026-11-13. Operational state tracker (not design; design = `SPEC.md`)._

---
## ▶ RESUME HERE (read first)

**MVP progress ≈ 80%.** Functional core DONE + deployed to prod. Remaining = monetization + distribution.

**What works right now (prod):**
- Backend Worker live, all user + admin endpoints + ROM upload. Prod Version `c197a131` (redeploy `cd backend && npx wrangler deploy` after pulls).
- Client WPF: Google login, fingerprint, trial, anti-tamper, catalog sync. Email now persisted (DPAPI).
- Admin panel live: https://retrobat-admin-7nj.pages.dev (login needs web-client, see Pending USER). ROM upload UI added.
- ES-native: games show inside RetroBat; proxy downloads ROM on launch (HTTPS direct). "Mi Cuenta" native entry (avatar + live trial status + login/trial/logout menu). Proxy INSTALLED on this machine.
- Distro Phase 1: proxy can launch RetroArch DIRECTLY per core (no RetroBat emulatorLauncher). Verified: `-core fceumm -rom test.nes` launched RetroArch.

**Progress breakdown:**
| Area | % |
|---|---|
| Infra / auth / license / trial / anti-farm / anti-tamper | 100 |
| Catalog / R2 download / play analytics | 100 |
| Admin API + panel + ROM upload (deployed `c197a131`) | 95 (login needs web-client) |
| ES-native integration (sync + proxy + Mi Cuenta) | 90 (real-ROM emulation untested) |
| Billing (step 9) | 0 — BLOCKED on provider |
| Domain (step 10) | 0 — user, NON-blocking (loopback OAuth needs no domain) |
| Standalone distro (own MIT/GPL frontend) | ~35 (Phase 1 launch DONE; Phase 0 cores DONE; ES binary BLOCKED) |

**▶ ACTIVE TRACK: standalone commercial distro (replaces RetroBat).**
Decision (see memory `retrobat-licensing-distribution`): CANNOT bundle RetroBat (CC BY-NC-SA NonCommercial). Build our own Windows distro from MIT (batocera-emulationstation) + GPL (RetroArch) + our branding. **Full plan: `C:\Users\a\.claude\plans\fuzzy-leaping-fiddle.md`.**
- **DONE Phase 1** (commit `08dc783`): launcher runs `retroarch.exe -L cores\<core>_libretro.dll <rom>` (distro mode) with fallback to RetroBat launcher; CatalogSync generates own `es_systems.cfg.dist` from catalog (DefaultCore baked into command). NOT yet: live-test of es_systems.cfg.dist (needs a sync), real-ROM emulation.
- **DONE Phase 0 — core licenses** (this session): web-audited all 8 cores. Non-commercial confirmed: `snes9x`, `genesis_plus_gx`, `picodrive` (MAME). Swapped to GPL: `snes9x`→`bsnes`, `genesis_plus_gx`→`blastem` (MD) + `gearsystem` (MS). Commercial-OK kept: fceumm GPLv2, gambatte GPLv2, mgba MPL2, mupen64plus_next GPLv3, pcsx_rearmed GPLv2, desmume GPLv2. Edited `backend/seeds/0001_systems.sql` + added `0002_core_licenses.sql` (idempotent UPDATE); applied to D1 **local + remote**. All 9 commercial-safe core DLLs staged on disk (`emulators/retroarch/cores`); downloaded missing 4 (mgba, blastem, mupen64plus_next, pcsx_rearmed) from libretro buildbot. GPL obligation: ship source offer for GPLv3/MPL2 cores at distribution.
- **BLOCKED Phase 0 — ES binary** (decision needed): NO clean standalone Windows MIT ES build exists. `batocera-emulationstation` = build-from-source only (no official Win release); ES-DE recent versions moved to custom freeware-ish license (MIT ref is a 2023 fork mirror, not confirmed commercial-clean). Options: (A) build batocera-ES from source for Windows [MIT engine, high effort], (B) verify + use a specific prebuilt fork + its license, (C) confirm current ES-DE license terms. **Until resolved, cannot stage `dist/` ES frontend (Phase 0 items 3-4: RetroArch staging into dist/ + theme).**
- **Phase 2**: Inno Setup installer, self-contained publish, assemble dist/ tree. **Phase 3**: auto-update (`GET /client/version` on Worker + R2 bundles). **Phase 4**: rebrand (pick product NAME — pending user) + own theme.

**Other pending (non-distro):**
- Step 9 billing — BLOCKED on payment provider choice (Stripe recommended).
- Step 10 domain — user buys domain (non-blocking for MVP).
- Admin web OAuth client — user (see Pending USER below).

**Repo:** `SEinent-byte/retrobat` (private), branch `main`, clean. Push works (PAT in Credential Manager). `.NET` via `C:\Program Files\dotnet\dotnet.exe`. Build client: `cd client && "C:\Program Files\dotnet\dotnet.exe" build RetroBat.sln`.

**Rollback proxy if needed:** `client/scripts/uninstall-launcher.ps1`. Reinstall proxy after client changes: `client/scripts/install-launcher.ps1` (kill `emulatorLauncher`/`retroarch` procs first if locked).

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

## ES-native "Mi Cuenta" entry: DONE + validated (commit `0c1ca62`, client-only).
- `CatalogSync` writes `_mi_cuenta.<ext>` (`RBACCT:` marker, reuses console extension) as first entry of each synced console; name = live status `Mi Cuenta — Prueba: Xd Yh`, desc = email + status.
- Launch proxy detects `RBACCT:` → opens `AccountMenuWindow` (Google sign-in / activate trial / sign out) instead of a game, then re-syncs.
- `AccountStatusText` (Spanish, end-user facing). No backend/contract change.
- Verified live on this machine: WPF login → sync wrote entry (nes/gamelist.xml + `_mi_cuenta.nes`); proxy invoked with account rom opened the menu, exit 0, no RetroArch.
- Proxy on this machine REINSTALLED with this build.
- Polish DONE: SVG avatar `<image>` per entry; email persisted (DPAPI) so the entry/menu show it on resumed sessions (`SessionManager.Email` + `TokenStore.SaveEmail`).
- TODO polish (optional, not done): dedup to one console instead of every console.
- NOTE: email only appears after the NEXT login (pre-existing persisted session had no stored email).

## Admin ROM upload: DONE + DEPLOYED (commit `5dc7ef9`, shared 0.3.0, prod Version `c197a131`).
- `POST /admin/games/:id/rom` (admin-gated): raw body → `env.ROMS.put(r2Key)`, updates `size_bytes`, audit `upload_rom`. Returns `{gameId, romFilename, sizeBytes, etag}`.
- Panel: "Upload ROM" form (prefilled with just-created game id).
- Smoke-tested on `wrangler dev --local`: create game → upload 30B NES → size_bytes=30, etag returned. Verified, then cleaned up.
- `API_VERSION` 0.2.0 → 0.3.0 (minor; MAJOR unchanged, no client break). WPF client still sends 0.2.0 — fine (backend rejects MAJOR mismatch only).
- **Not deployed:** run `cd backend && npx wrangler deploy` to push to prod Worker.

## Distribution (step 5): LICENSE-GATED. Bundle of RetroBat REJECTED.
- RetroBat content = CC BY-NC-SA 4.0 (NonCommercial): cannot bundle/sell in this paid product. Official terms forbid commercial use + selling pre-installed + shipping copyrighted content.
- CLEAN PATH: ES engine is permissive — batocera-emulationstation = MIT, ES-DE = MIT, RetroArch = GPLv3 (commercial OK w/ source offer). Build OUR OWN Windows frontend from MIT/GPL upstreams under our branding, no RetroBat NC assets, no BIOS. Proxy already speaks batocera `emulatorLauncher.exe -rom` → low port effort.
- Options: (A) own distro from batocera-ES MIT [high effort, recommended for commercial], (B) ES-DE MIT [medium, no emulator auto-download], (C) add-on over user's RetroBat [low, NC gray-area → internal/MVP only].
- Decision PENDING user. See memory `retrobat-licensing-distribution`.

## NEXT: step 9 (billing) BLOCKED — payment provider TBD (SPEC §12). Step 10 (domain) — user.

## Pending USER
- [ ] **Google WEB OAuth client** for admin login: create a "Web application" OAuth client in Google Cloud, add origin `https://retrobat-admin-7nj.pages.dev` (and `http://localhost:5173` for dev) to Authorized JavaScript origins. Then:
      - set Pages build var `VITE_ADMIN_GOOGLE_CLIENT_ID` = that id (and redeploy), AND
      - `cd backend && npx wrangler secret put ADMIN_GOOGLE_CLIENT_ID` = same id.
      Until then the panel shows setup instructions instead of a login button.
- [ ] **Payment provider** decision to unblock step 9 (Stripe or other).
- [ ] (optional) **Test client Google sign-in**: `cd client && "C:\Program Files\dotnet\dotnet.exe" run --project RetroBat.App`.
- [ ] (Optional) Rotate GitHub PAT, then re-store via the `git credential approve` one-liner above.
