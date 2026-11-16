# STATUS — next-session quickstart

_Last update: 2026-11-15. Operational tracker (design = `SPEC.md`). Compacted; older step-by-step logs dropped (git history has them)._

---
## ▶ RESUME HERE

**TOTAL ≈ 85%.** Core + distro validated end-to-end on a real clean install (install → login → trial → sync → license → R2 download → RetroArch launch, keyboard playable). Remaining = **billing 0% (BLOCKED on provider)** + content/UX polish + domain.

**Live install `C:\PlayVault` is fully current via direct staging** (ES exe, launcher, cfgs, resources/locale, batocera.conf). **⚠ Installer artifact is STALE — rebuild before shipping** (dist changed a lot this session).

### ▶▶ THIS SESSION (2026-11-15, controls/keyboard/account UX) — committed `1c01464`, pushed `feat/distro-gpl-cores`
Keyboard + controls UX for the distro, all **global** (one scheme every game/system; only the game's own meaning of a button varies, as on real hardware):
- **Global keyboard scheme** (`distro/retroarch/playvault.cfg`): key letter = on-screen button label → A=`A`, B=`B`, X=`X`, Y=`Y`, N64 Z-trigger=`Z`, L/R=`Q`/`W`, Start=`Enter`, Select=`RShift`, N64 C-buttons=`I/J/K/L`. One key per RetroPad button, no dups. Replaces confusing RetroArch default (A=x,B=z).
- **Movement overlays** (`playvault-analog.cfg` / `playvault-dpad.cfg`): arrows ALWAYS move. analog (n64,psx) frees d-pad → arrows=left stick; 2D clears analog binds → arrows=d-pad. Launcher layers base + per-system overlay via `--appendconfig "base,overlay"` (`AnalogSystems={n64,psx}` in `App.xaml.cs`).
- **Controls card** (`ControlsCard.cs`): one-time per-system help before launch (ES "basic" view hides desc). HKCU flag `Software\PlayVault\ControlsShown`.
- **In-game overlay (press `H`)** (`GameControlsOverlay.cs`): global `WH_KEYBOARD_LL` hook on STA thread; `H` toggles non-activating top-most window (RetroArch keeps focus, no pause); `H` swallowed + unmapped in our cores. Launcher stays alive during play (`waitForExit`).
- **Gamepad**: plug-and-play (autoconfig/ shipped, 30 xinput profiles, `input_autodetect_enable=true`). NOTE test machine is a **QEMU VM** → USB pad needs host passthrough; bare-metal works.

### ▶▶ THIS SESSION — external ES-source fixes (NOT in git; re-apply on fresh clone / when vendoring) at `D:\es-build\emulationstation`
- `es-core/src/Window.cpp`:
  - Account widget **icon-only** (toro, no text): render only `mAccountIcon`; hitbox shrunk to icon square.
  - **Click → account menu**: `processMouseButton` gate now MATCHES render gate `mGuiStack.size()<2 || !Renderer::ScreenSettings::fullScreenMenus()` (old `size<2` blocked windowed gamelists → click launched a game).
  - **Launcher path fix**: `Paths::getExePath()` is already the exe DIR → use `getExePath()+"/launcher.exe"`, NOT `getParent(getExePath())` (that resolved `C:/launcher.exe`, exists=0 → fell through to game).
- `es-app/src/guis/GuiMenu.cpp:141`: same launcher-path fix (`getExePath()+"/launcher.exe"`).
- **Spanish locale**: ES WIN32 `setLocale` forces `en_US` and never calls `EsLocale::init`, BUT `EsLocale::checkLocalisationLoaded` loads `.po` from `SystemConf "system.language"` via `ResourceManager :/locale/...` (= `resources/`). Fix without source edit: ship `resources/locale/lang/<lang>/LC_MESSAGES/emulationstation2.po` (copied from build-source `locale/lang`) + `batocera.conf` `system.language=es_ES`. `es_settings.cfg Language` is the OTHER (unused by loader) setting.
- Prior patches still required: `es-core/src/Log.cpp` add `#include <chrono>`; `es-core/src/Splash.h` WIN32 `DEFAULT_SPLASH_IMAGE` `:/splash.svg`→`:/logo.png` (toro splash).

### ▶▶ TEST CHECKLIST (relaunch `C:\PlayVault\emulationstation.exe --home C:\PlayVault --windowed`)
1. Top-left = **toro icon only** (no text). Click it → **Mi Cuenta** window (login/trial/logout). ES menus in **Spanish**.
2. Launch Army Men (n64) → first time a controls card; **press `H` in-game** → controls overlay.
3. "press A"→`A`, "press Z"→`Z`; move with arrows; shoot `Z`.

---
## ▶ BUILD / DEPLOY RECIPES
- **Client**: `cd client && "C:\Program Files\dotnet\dotnet.exe" build RetroBat.sln`.
- **Launcher (self-contained single-file, ship to dist/live)**: `cd client && dotnet publish RetroBat.Launcher -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true` → copy `...\publish\RetroBat.Launcher.exe` to `dist\launcher.exe` + `C:\PlayVault\launcher.exe` (kill running `launcher`/`retroarch` first; file locks while a game runs).
- **ES rebuild** (external `D:\es-build\emulationstation`): CMake at `C:\Program Files\CMake\bin\cmake.exe`. **Gotcha: MSBuild treats changed files as up-to-date (exit 0, no recompile)** → delete stale objs first: `build/es-core/es-core.dir/Release/Window.obj`, `build/es-app/emulationstation.dir/Release/GuiMenu.obj`, `bin/Win32/Release/emulationstation.exe`, then `cmake --build build --config Release --parallel`. Verify: `grep -ac account_status bin/Win32/Release/emulationstation.exe ≥1` + fresh mtime. (Full first-build toolchain recipe in git history of this file @ `2b26e0e`.)
- **ES exe icon (rcedit, build step — ES is prebuilt, re-run after staging)**: `rcedit-x64.exe <es.exe> --set-icon distro\brand\toro.ico` on dist + live. rcedit at `...\scratchpad\logo\rcedit-x64.exe` (electron/rcedit v2.0.0; re-fetch if scratchpad cleared).
- **Backend deploy**: `cd backend; npx wrangler deploy` (PowerShell `;` not `&&`). Prod Worker apiVersion 0.5.0.
- **Admin web** (direct-upload, NOT CF build): `pnpm --filter @retrobat/admin-web build` (needs `admin-web/.env.production` `VITE_ADMIN_GOOGLE_CLIENT_ID`, gitignored) → `wrangler pages deploy dist --project-name=retrobat-admin --branch=main`.
- **Installer** (PowerShell, native paths — ISCC via git-bash mangles backslash args): `& "C:\Users\a\AppData\Local\Programs\Inno Setup 6\ISCC.exe" "/DDistDir=D:\es-build\dist" "/DAppVersion=0.1.0" "/OD:\es-build\installer_out" "D:\RetroBat\distro\installer\playvault.iss"` → `PlayVault-Setup-0.1.0.exe`. Excludes preserve user data (roms, account_status.txt, retroarch.cfg, gamelists, *.es-bak). Silent reinstall from automation → Inno exit 2 (needs interactive UAC; installs to `{sd}\PlayVault`).

### ▶▶ DIST ASSEMBLY (external `D:\es-build\dist`, 150M, not in git) — rebuild rules after any change
- `emulationstation.exe` (staged from ES build) + rcedit toro icon.
- `resources/window_icon_256.png` = toro 256 (runtime window/taskbar icon; separate from rcedit).
- `resources/locale/lang/` = copied from ES build-source `locale/lang/` (Spanish + all langs).
- `.emulationstation/batocera.conf` `system.language=es_ES` (git seed: `distro/seed/.emulationstation/batocera.conf`).
- `launcher.exe` (self-contained publish).
- `emulators/retroarch/` pristine RA 1.22.2 (libretro buildbot) + 9 GPL cores + `playvault.cfg` + `playvault-analog.cfg` + `playvault-dpad.cfg` + toro icon via rcedit on retroarch.exe.
- `roms/` = `distro/seed/roms/*` (nes welcome entry; NO dummy ROMs).
- `.emulationstation/es_input.cfg` (keyboard default), `es_settings.cfg` (GamelistViewStyle=basic, ThemeSet=elementerial, Language=es_ES), `es_systems.cfg`.

---
## ▶ INFRA / IDs
- **Cloudflare** (acct `anthoniogarciareyes25@gmail.com`, id `2263e816c670f9c372ddd4db453bc458`): D1 `retrobat-db` (`4ffd9d56-de6d-4a89-b61b-60d2193a072f`, binding `DB`); R2 `retrobat-roms` (binding `ROMS`, S3 `https://2263e816c670f9c372ddd4db453bc458.r2.cloudflarestorage.com`); Pages `retrobat-admin` → https://retrobat-admin-7nj.pages.dev; Worker `retrobat-api` → https://retrobat-api.anthoniogarciareyes25.workers.dev. wrangler via `npx -y wrangler@latest`.
- **Google OAuth**: Desktop client (id+secret in `backend/.dev.vars`, loopback RFC 8252). Admin WEB client `1046162067802-9jgcu8nl2fdt0haroq9opr6fe2p31cgl.apps.googleusercontent.com` (backend secret `ADMIN_GOOGLE_CLIENT_ID` set; baked into admin build). **Admin panel confirmed e2e** (login + games CRUD + ROM upload).
- **Secrets**: local `backend/.dev.vars` (gitignored); prod via `wrangler secret put`.
- **Repo**: `SEinent-byte/retrobat` (private), work branch `feat/distro-gpl-cores`. PAT in Windows Credential Manager (no inline token; push works). `.NET 8` at `C:\Program Files\dotnet`.
- **Update channel wired**: `GET /client/version` + `GET /client/download` (302→presigned R2). Installer uploaded to R2 `releases/`. To ship a fix: rebuild installer w/ bumped `BrandInfo.AppVersion`+installer `AppVersion`; `wrangler r2 object put ...`; edit `wrangler.toml` `CLIENT_LATEST_VERSION`(+`CLIENT_MIN_VERSION`)+`CLIENT_INSTALLER_KEY`+notes; deploy. No silent apply (user re-runs installer).
- **Admin game mgmt** (API_VERSION 0.5.0): `GET/PATCH/DELETE /admin/games` — per-console view, rename, trial toggle, console move (+R2 object move), delete, 24h free-window. Army Men trial flag flippable from panel.

---
## ▶ PENDING
- **Billing (step 9)** — BLOCKED on USER choosing payment provider (Stripe recommended) + per-country methods.
- **License docs finalization** — fill `<CONTACT>`/`<PRODUCT-DOMAIN>` in `distro/licenses/` (WRITTEN-OFFER, CORRESPONDING-SOURCES), pin per-core source commits, mirror source tarballs to R2.
- **Installer rebuild** (dist changed this session) + bundle `vc_redist.x86`.
- **Domain** — USER buys (non-blocking; loopback OAuth needs none).
- **Thumbnails/boxart** — not supported (feature gap): GameDto has no image field; needs contract bump + admin artwork upload→R2 + client writes `<image>` to gamelist. Medium.
- **First-run with 0 ROMs** — `FirstRunSeed.Seed` has no caller + `roms\*` installer-excluded → fresh machine may show empty carousel; verify or wire seed at startup. Seed `distro/seed/roms/nes` ships a welcome entry.
- **Elementerial theme** bundles console brand logos (owners' property) → review/replace with neutral art before commercial release.
- **RetroArch internal menu** (F1/Ozone) still shows RetroArch name/logo — deep rebrand needs GPL asset edits/recompile. Window title + taskbar already "PlayVault" (borderless, no title bar in play).

---
## ▶ PROGRESS
| Area | % |
|---|---|
| Infra / auth / license / trial / anti-farm / anti-tamper | 100 |
| Catalog / R2 download / play analytics | 100 |
| Admin API + panel + ROM upload + game mgmt | 100 |
| ES-native integration (sync + proxy + Mi Cuenta widget + click) | 100 |
| Standalone distro (own MIT/GPL frontend, rebrand PlayVault, theme, keyboard/controls UX, locale) | ~92 (missing: installer rebuild, license placeholders, vcredist) |
| Billing (step 9) | 0 — BLOCKED on provider |
| Domain (step 10) | 0 — user, non-blocking |

**Licensing basis**: cannot bundle RetroBat (CC BY-NC-SA). Own distro from batocera-emulationstation (MIT) + RetroArch (GPLv3, source offer) + GPL cores. See memory `retrobat-licensing-distribution`.
