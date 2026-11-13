# STATUS — next-session quickstart

_Last update: 2026-11-13. Operational state tracker (not design; design = `SPEC.md`)._

---
## ▶ RESUME HERE (read first)

**TOTAL PRODUCT ≈ 82%.** (Backend ~100 + client ~95 + distro ~88 + billing 0 + polish ~25, weighted.) Functional core DONE + deployed to prod; standalone distro now INSTALLS + emulates + auto-updates (pristine RetroArch, own theme, RGS rebrand, Inno installer, `/client/version` live). Remaining = monetization (billing 0%, BLOCKED on provider) + distro finishing (license-doc placeholders, vcredist, installer rebuild + clean-dir test) + domain.

### ▶▶ NEXT SESSION — pick ONE (menu given to user last session)
1. ~~**First-run bootstrap**~~ **DONE** (commit `bb58667`). Fresh install now seeds a pre-login "Mi Cuenta — Sin sesion" entry in the first console; selecting it opens the account menu, first login re-syncs the full catalog. See block F below.
2. **Test the real installer** (recommended; autonomous). REBUILD the installer first (dist changed: dummies dropped, seed added — see block F), then run `RGS-Setup-*.exe` in a clean dir; validate install → ES boot → Mi Cuenta login → licensed-ROM download → play.
3. **Billing** (step 9; BLOCKED — needs USER to choose a payment provider, Stripe recommended, + per-country methods). Can't start without that decision.
4. **Finalize license docs** (needs USER contact email + product domain). Fill `<CONTACT>`/`<PRODUCT-DOMAIN>`, pin per-core source commits, mirror source tarballs to R2.

**What works right now (prod):**
- Backend Worker live, all user + admin endpoints + ROM upload + `/client/version`. Prod Version `f3dd3e06`, apiVersion 0.4.0 (redeploy: `cd backend; npx wrangler deploy` — PowerShell uses `;` not `&&`).
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
| ES-native integration (sync + proxy + Mi Cuenta) | 95 (real-ROM emulation PASSED via launcher→RetroArch) |
| Billing (step 9) | 0 — BLOCKED on provider |
| Domain (step 10) | 0 — user, NON-blocking (loopback OAuth needs no domain) |
| Standalone distro (own MIT/GPL frontend) | ~85 (ES boots; real-ROM emulation PASSED; es_systems emitted at login; pristine RetroArch + source offer; installer builds; own theme; rebrand to RGS; auto-update code-complete; first-run bootstrap done. Missing: license-doc placeholders, vcredist, installer rebuild + clean-dir test) |

**▶ ACTIVE TRACK: standalone commercial distro (replaces RetroBat).**
Decision (see memory `retrobat-licensing-distribution`): CANNOT bundle RetroBat (CC BY-NC-SA NonCommercial). Build our own Windows distro from MIT (batocera-emulationstation) + GPL (RetroArch) + our branding. **Full plan: `C:\Users\a\.claude\plans\fuzzy-leaping-fiddle.md`.**
- **DONE Phase 1** (commit `08dc783`): launcher runs `retroarch.exe -L cores\<core>_libretro.dll <rom>` (distro mode) with fallback to RetroBat launcher; CatalogSync generates own `es_systems.cfg.dist` from catalog (DefaultCore baked into command). NOT yet: live-test of es_systems.cfg.dist (needs a sync), real-ROM emulation.
- **DONE Phase 0 — core licenses** (this session): web-audited all 8 cores. Non-commercial confirmed: `snes9x`, `genesis_plus_gx`, `picodrive` (MAME). Swapped to GPL: `snes9x`→`bsnes`, `genesis_plus_gx`→`blastem` (MD) + `gearsystem` (MS). Commercial-OK kept: fceumm GPLv2, gambatte GPLv2, mgba MPL2, mupen64plus_next GPLv3, pcsx_rearmed GPLv2, desmume GPLv2. Edited `backend/seeds/0001_systems.sql` + added `0002_core_licenses.sql` (idempotent UPDATE); applied to D1 **local + remote**. All 9 commercial-safe core DLLs staged on disk (`emulators/retroarch/cores`); downloaded missing 4 (mgba, blastem, mupen64plus_next, pcsx_rearmed) from libretro buildbot. GPL obligation: ship source offer for GPLv3/MPL2 cores at distribution.
- **DONE Phase 0 — ES binary** (this session, Option A chosen = build from source): `emulationstation.exe` **compiled + boots standalone on Windows** from MIT source. License settled: both `batocera-linux/batocera-emulationstation` and the Windows-maintained fork `RetroBat-Official/emulationstation` carry identical `LICENSE.md` = **MIT** (Alec Lofquist 2014). RetroBat's NC (CC BY-NC-SA) covers only its bundle/assets, NOT the ES engine source. So a from-source build is a clean MIT frontend.
  - **Validated (scratch-home boot, `--debug` log)**: `Window::init` → OpenGL context (RTX 3050) → `Loading system config file es_systems.cfg` (6ms) → `SystemView` → `fireEvent: system-selected nes`. Engine renders + loads our es_systems.cfg + shows a system. (GUI subsystem app: stdout not on console; verified via `es_log.txt`.)
  - **BUILD RECIPE (reproducible, next session):**
    - Source: `RetroBat-Official/emulationstation` branch **master** (NOTE default branch `autopull` is an empty mirror — must `git fetch --depth 1 origin master && git checkout -B master FETCH_HEAD`). Cloned at **`D:\es-build\emulationstation`** (outside git repo; external). pugixml submodule init'd.
    - Toolchain: VS **Build Tools 2022** + MSVC 14.44 + Windows SDK 10.0.22621 + **ATL component** `Microsoft.VisualStudio.Component.VC.ATL` (required — `TextToSpeech.cpp` includes `<sphelper.h>`→`atlbase.h` unconditionally even with TTS off; installed elevated via `setup.exe modify --installPath ... --add ... --quiet --norestart --force`) + **CMake 4.4.4** (winget `Kitware.CMake`, at `C:\Program Files\CMake\bin\cmake.exe`, not on PATH).
    - Required source patch (MSVC 14.44 strictness): `es-core/src/Log.cpp` add `#include <chrono>` (uses `std::chrono::system_clock` without the include). UNCOMMITTED in the external clone — re-apply on fresh clone; carry as a patch file when we vendor the build.
    - Configure: `cmake -S . -B build -G "Visual Studio 17 2022" -A Win32 -DRETROBAT=OFF -DBATOCERA=OFF` → win32 deps auto-download via FetchContent from `batocera-linux/batocera-emulationstation-win32-dependencies` into `win32-libs/` (276M: SDL2, freetype[static], FreeImage, SDL2_mixer, curl 8.1.2, libvlc, rapidjson).
    - Build: `cmake --build build --config Release --parallel` → **`bin/Win32/Release/emulationstation.exe`** (7.4MB, x86). (Kill stale `MSBuild.exe`/`vctip.exe` before any VS-installer modify, else pre-check `VSProcessesRunning` 8006.)
    - Runtime staging (beside exe): copy x86 DLLs `FreeImage, SDL2, SDL2_mixer (+optional/*), libcurl, libvlc, libvlccore` + `libvlc/x86/plugins/` dir + `resources/` dir. freetype is static (no DLL).
  - **OPEN decisions**: (1) `-DRETROBAT` ON vs OFF — built OFF (generic MIT, no RetroBat code/marks), boots fine; ON enables RetroBat-specific paths/branding. (2) x86 vs x64 — built Win32/x86; `-A x64` supported (CUSTOM_PLATFORM x64). (3) theme: ran on ES built-in fallback (ES-Carbon default); ship own/open theme at Phase 4.
- **DONE this session — dist/ tree ASSEMBLED + BOOTS** (external, at **`D:\es-build\dist`**, 150M, NOT in git repo). Standalone tree that runs with zero RetroBat dependency:
  ```
  emulationstation.exe + 10 runtime DLLs (FreeImage,SDL2,SDL2_mixer+4 optional,libcurl,libvlc,libvlccore) + plugins/ (vlc) + resources/
  emulators/retroarch/retroarch.exe + cores/ (9: fceumm,bsnes,gambatte,mgba,blastem,gearsystem,mupen64plus_next,pcsx_rearmed,desmume)
  launcher.exe            (= client RetroBat.Launcher Release win-x64 build, framework-dependent → needs .NET 8 Desktop runtime)
  .emulationstation/es_systems.cfg (10 systems; <command>="%HOME%\launcher.exe" -system <id> -core <core> -rom %ROM%) + es_settings.cfg
  roms/<10 folders>/      (dummy test ROMs, one per system)
  ```
  - **Validated**: `emulationstation.exe --home <dist> --windowed --debug` → log `Loading system config file D:/es-build/dist/.emulationstation/es_systems.cfg` (5ms) + `system-selected gb`, ran full, no errors. ES resolves `%HOME%`=dist root and `~`=home, so `~\roms\<folder>` + `%HOME%\launcher.exe` point inside dist. es_systems.cfg generated by `scratchpad/gen_es_systems.sh` (printf-based; heredoc backslash escaping failed, Python is a Store stub = unavailable — use bash printf or write files directly).
  - **NO theme bundled**: both on-disk themes are NonCommercial — `HyperMax-Plus-PixN` AND `es-theme-carbon` = **CC-BY-NC-SA** (verified carbon readme.txt). Runs on ES built-in fallback (plain look). Own/permissive theme = Phase 4; that theme is what gives the polished "look" (the Marvel/HyperMax screenshot the user saw is RetroBat's NC skin, NOT shippable).
  - To see it live: `D:\es-build\dist\emulationstation.exe` (plain fallback; real functional UI).
- **DONE this session — real-ROM emulation test (NEXT step 1) PASSED.** Real SNES ROM (Super Mario Kart `.sfc`, 512K) in `dist\roms\snes`, launched both directly and via the full `launcher.exe → RetroArch` chain. RetroArch 1.22.2 loaded `bsnes` core + content, GL/GLSL + WASAPI audio, process stayed alive (game running). Two fixes required:
  1. **launcher.exe must be self-contained single-file.** The dist tree only had the 148K apphost; it needs `RetroBat.Launcher.dll` beside it (framework-dependent) which was never copied → `exit 154`. Published self-contained single-file (`dotnet publish RetroBat.Launcher -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true`, ~162MB exe, no .NET prereq). **Code fix (commit `64fd97b`):** single-file extracts to a temp dir so `AppContext.BaseDirectory` was wrong → `RetrobatPaths` resolved the wrong root → Fatal dialog. Now uses `Environment.ProcessPath`; `FindRoot` also recognizes `emulationstation.exe` at root (distro layout).
  2. **dist RetroArch was exe-only** (`retroarch.exe` is a Qt build → needed `Qt5Widgets.dll` etc; bare run `exit 127`). Staged the full runtime: 65 top-level DLLs + `assets info shaders database autoconfig system filters overlays` dirs, copied from the local RetroBat install (`D:\RetroBat\emulators\retroarch`; same exe md5). These are RetroArch's own GPL/permissive binaries, NOT RetroBat NC assets. **⚠ For the shippable distro, pull a pristine RetroArch Windows x64 from the libretro buildbot** instead of the RetroBat copy, to keep the license audit unambiguous.
  - Test cfg (logging to `D:\es-build\ralog\retroarch.log`): `D:\es-build\ra_test.cfg`. Re-run direct: `cd D:\es-build\dist\emulators\retroarch && retroarch.exe --config D:\es-build\ra_test.cfg -v -L cores\bsnes_libretro.dll <rom>`.
- **DONE this session — es_systems runtime emission (NEXT step 2) PASSED** (commit `c0c76c4`). `CatalogSync.WriteEsSystems` now detects the distro layout (`IsDistro` = `emulationstation.exe` at root) and writes the real `es_systems.cfg` into `dist\.emulationstation` with `%HOME%\launcher.exe` + `~\roms\<folder>` (RetroBat dev install still gets the `.dist` sidecar + `emulatorLauncher` proxy command, never clobbered). `RetrobatPaths` gained `IsDistro`, `LauncherExeName`, distro-aware `EmulationStationHome`. Verified via reflection harness: generated config byte-identical (modulo trailing newline) to the hand-validated one; ES parsed it and built the SystemView (`Loading system config file ...es_systems.cfg` → `system-selected gb`). Harness: `scratchpad/es_test` (external, throwaway). Backup of hand file: `dist\.emulationstation\es_systems.cfg.validated`.
- **DONE this session — shippable distro blocks A–E (commits `5a8b7c9`, `f7cde1a`, `56cd994`, `5b64bdd`).**
  - **A — license-clean RetroArch + source offer.** Pristine RetroArch 1.22.2 Windows x86_64 pulled from the libretro buildbot (`buildbot.libretro.com/stable/1.22.2/windows/x86_64/RetroArch.7z`, 202MB) now backs `dist\emulators\retroarch` (retroarch.exe md5 identical to the RetroBat copy → provenance now unambiguous); our 9 GPL cores preserved; re-ran a real ROM OK. `distro/licenses/`: THIRD-PARTY-LICENSES (verified via libretro `.info`: fceumm/gambatte/mupen64plus_next/pcsx_rearmed/desmume GPLv2, bsnes/blastem/gearsystem GPLv3, mgba MPL-2.0, RetroArch GPLv3, ES MIT), WRITTEN-OFFER, CORRESPONDING-SOURCES, + canonical texts. Copied into `dist\licenses`. **TODO before release:** fill `<CONTACT>`/`<PRODUCT-DOMAIN>` + pin per-core source commits.
  - **B — installer.** `distro/installer/rgs.iss` (Inno Setup). Installs to `{sd}\RGS` (writable), Start Menu/desktop shortcut → `emulationstation.exe --home "{app}"`, excludes runtime state, uninstall cleanup. Built with ISCC (at `C:\Users\a\AppData\Local\Programs\Inno Setup 6\ISCC.exe`, installed via winget) → `D:\es-build\installer_out\RGS-Setup-0.1.0.exe`. **TODO:** bundle `vc_redist.x86.exe` (MSVC-built ES).
  - **C — own theme.** `distro/theme/rgs-dark` (MIT, colors over default layout, accent `#1f6feb`). Installed to `dist\.emulationstation\themes`, `es_settings.cfg` ThemeSet=rgs-dark. ES loads it with no theme errors. (Licensing already satisfied: distro ships no NC theme.)
  - **D — rebrand.** `RetroBat.Core.Branding.BrandInfo` (Name "RGS", FullName "Retro Games Saviour", AppVersion, HKCU key `Software\RGS`). All user-facing product strings route through it; internal namespaces keep the RetroBat prefix. (Registry key moved → existing persisted session dropped.)
  - **E — auto-update.** Public `GET /client/version` (backend `routes/client.ts`, `CLIENT_*` vars in `wrangler.toml`). Shared `ClientVersionResponse`, API_VERSION 0.3.0→**0.4.0**. Client `UpdateChecker` (best-effort semver, non-blocking on startup) surfaces an update notice in the account window. **DEPLOYED** to prod (Worker Version `f3dd3e06`, apiVersion 0.4.0); `GET /client/version` live → `{"latestVersion":"0.1.0","minVersion":"0.1.0","downloadUrl":"","notes":""}`. Bump `CLIENT_*` + `BrandInfo.AppVersion` per release.
-   - **F — first-run bootstrap** (commit `bb58667`). Closed the chicken-egg gap: a fresh install shipped `es_systems.cfg` + dummy ROMs but no "Mi Cuenta" (CatalogSync writes it only post-login) → user couldn't reach sign-in. Now a pre-login welcome entry is seeded. `CatalogSync.WriteAccountOnly(dir, ext, status, email)` (reusable, same marker/icon/strings); `FirstRunSeed.Seed(paths)` reads the install's `es_systems.cfg`, seeds the FIRST console (nes) with a single `Mi Cuenta — Sin sesion` entry. Committed static seed at `distro/seed/roms/nes/` (+ README). **Live dist updated: dropped all dummy `test.*` ROMs, copied seed into `dist\roms\nes`.** Validated: `emulationstation.exe --home dist --debug` parses `roms/nes/gamelist.xml`, ignores the 9 empty consoles, shows only the welcome console. Flow: select Mi Cuenta → `AccountMenuWindow` → Google login → `SyncAsync` (AccountMenuWindow.xaml.cs:85) populates all consoles + games.
    - **⚠ Installer must be rebuilt** — `dist\roms` changed. Assembly rule (distro/seed/README): copy `distro/seed/roms/*` into `dist/roms`, ship NO dummy ROMs.
**▶ NEXT (resume here):**
  1. ~~Deploy backend~~ **DONE** (Worker Version `f3dd3e06`, `/client/version` live).
  2. ~~First-run bootstrap~~ **DONE** (block F above).
  3. **License docs finalization**: fill `<CONTACT>`/`<PRODUCT-DOMAIN>`, pin per-core source commits, mirror source tarballs (R2).
  4. **Installer polish**: bundle `vc_redist.x86`, set `CLIENT_DOWNLOAD_URL` to the published installer URL.
  - Non-distro still open: **billing** (BLOCKED on provider), **domain** (user), **admin web OAuth client** (user, see Pending USER).
- **Phase 2**: Inno Setup installer, self-contained publish (ES + launcher, no .NET prereq), finalize dist/ tree. **Phase 3**: auto-update (`GET /client/version` on Worker + R2 bundles). **Phase 4**: rebrand (pick product NAME — pending user; user is trying "RGS — Retro Games Saviour") + own theme.

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
