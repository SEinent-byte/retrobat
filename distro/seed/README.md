# First-run seed

Pre-login content shipped inside the standalone distro so a **fresh install** can
reach sign-in. A new install ships `es_systems.cfg` (the consoles) but no
gamelists — those are written by `CatalogSync` only *after* login, which the user
cannot reach without an entry to select. This seeds one welcome console (`nes`)
with a single **"Mi Cuenta"** entry (`RBACCT:` marker). Selecting it opens the
account menu (`AccountMenuWindow`); the first successful login re-syncs the real
catalog over the seed, revealing every console and game.

## Contents

```
roms/nes/_mi_cuenta.nes        RBACCT: marker pseudo-ROM (launch proxy -> account menu)
roms/nes/_mi_cuenta.svg        avatar icon
roms/nes/gamelist.xml          single "Mi Cuenta — Sin sesion" entry (pre-login strings)
.emulationstation/es_input.cfg default keyboard mapping so ES does not force the
                               first-run "CONFIGURE INPUT / NO GAMEPADS DETECTED"
                               prompt (keyboard-only; no gamepad required)
```

## Assembling a shippable dist

When building the standalone tree (`D:\es-build\dist`):

1. Do **not** bundle dummy test ROMs. Empty console folders are hidden by ES
   (`System "<x>" has no games! Ignoring it.`), so only the seeded `nes` shows.
2. Copy `distro/seed/roms/*` into `dist/roms/`.
3. Copy `distro/seed/.emulationstation/es_input.cfg` into `dist/.emulationstation/`.

The Inno installer then packages `dist/*` as-is (no installer logic needed).

## Regenerating the seed

Single source of truth is code: `RetroBat.Services.Games.FirstRunSeed.Seed`
reuses the same marker, icon and status strings as a logged-in sync
(`CatalogSync.WriteAccountOnly`, status = null -> "Sin sesion"). It reads the
install's `es_systems.cfg` and seeds the **first** declared console. To
regenerate, run `FirstRunSeed.Seed(new RetrobatPaths(<home>))` against an ES
home holding `emulationstation.exe` + `.emulationstation/es_systems.cfg`, then
copy the produced `roms/<folder>/` here.
