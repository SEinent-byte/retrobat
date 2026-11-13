# Third-party components and licenses

This product bundles unmodified third-party open-source software. Each
component keeps its own license; this file lists them and the overall
obligations. Full license texts are in `licenses/texts/`.

| Component | Version | License | Upstream |
|---|---|---|---|
| EmulationStation (frontend engine) | built from `RetroBat-Official/emulationstation` @ `master` | MIT | https://github.com/RetroBat-Official/emulationstation |
| RetroArch (emulator frontend) | 1.22.2 (Git 69a4f0e), Windows x86_64 buildbot | GPLv3 | https://github.com/libretro/RetroArch |
| libretro core: fceumm (NES) | libretro buildbot stable 1.22.2 | GPLv2 | https://github.com/libretro/libretro-fceumm |
| libretro core: bsnes (SNES) | libretro buildbot stable 1.22.2 | GPLv3 | https://github.com/libretro/bsnes-libretro |
| libretro core: gambatte (GB/GBC) | libretro buildbot stable 1.22.2 | GPLv2 | https://github.com/libretro/gambatte-libretro |
| libretro core: mgba (GBA) | libretro buildbot stable 1.22.2 | MPL-2.0 | https://github.com/libretro/mgba |
| libretro core: blastem (Mega Drive) | libretro buildbot stable 1.22.2 | GPLv3 | https://github.com/libretro/blastem |
| libretro core: gearsystem (Master System) | libretro buildbot stable 1.22.2 | GPLv3 | https://github.com/libretro/Gearsystem |
| libretro core: mupen64plus_next (N64) | libretro buildbot stable 1.22.2 | GPLv2 | https://github.com/libretro/mupen64plus-libretro-nx |
| libretro core: pcsx_rearmed (PlayStation) | libretro buildbot stable 1.22.2 | GPLv2 | https://github.com/libretro/pcsx_rearmed |
| libretro core: desmume (Nintendo DS) | libretro buildbot stable 1.22.2 | GPLv2 | https://github.com/libretro/desmume |

## What this means for distribution

- **MIT (EmulationStation):** keep the copyright notice and the MIT text
  (`licenses/texts/MIT-emulationstation.txt`). No further obligation.
- **GPLv2 / GPLv3 (RetroArch and most cores):** the corresponding source
  code must be made available to every recipient. We ship these binaries
  **unmodified** from the libretro buildbot. See `WRITTEN-OFFER.md` and
  `CORRESPONDING-SOURCES.md`.
- **MPL-2.0 (mgba):** source of the MPL-covered files must be available;
  satisfied by the same source offer. MPL is file-level copyleft and does
  not affect the rest of the product.

## What is NOT bundled

- **No BIOS / firmware files.** None are shipped. Cores that can require a
  BIOS (e.g. PlayStation) rely on files the user supplies or that are
  delivered under an appropriate license through the service.
- **No copyrighted game ROMs.** Game content is delivered per-user through
  the licensed service, never bundled in the installer.
- **No RetroBat assets, themes, bezels, or branding** (those are
  CC BY-NC-SA / NonCommercial). The RetroArch runtime and EmulationStation
  engine here are the upstream open-source binaries, not RetroBat's bundle.
