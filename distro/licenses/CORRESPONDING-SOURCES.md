# Corresponding source manifest

The GPL/MPL binaries in this release were built by the libretro buildbot
(stable channel, RetroArch 1.22.2, Windows x86_64). The complete
corresponding source for each is its upstream repository at the commit the
buildbot built. Before each public release, pin the exact commit/tag per
component below and mirror a source archive at the published URL.

| Component | License | Upstream source | Pinned commit/tag | Mirror |
|---|---|---|---|---|
| RetroArch | GPLv3 | https://github.com/libretro/RetroArch | `v1.22.2` (Git 69a4f0e) | TODO |
| fceumm | GPLv2 | https://github.com/libretro/libretro-fceumm | TODO | TODO |
| bsnes | GPLv3 | https://github.com/libretro/bsnes-libretro | TODO | TODO |
| gambatte | GPLv2 | https://github.com/libretro/gambatte-libretro | TODO | TODO |
| mgba | MPL-2.0 | https://github.com/libretro/mgba | TODO | TODO |
| blastem | GPLv3 | https://github.com/libretro/blastem | TODO | TODO |
| gearsystem | GPLv3 | https://github.com/libretro/Gearsystem | TODO | TODO |
| mupen64plus_next | GPLv2 | https://github.com/libretro/mupen64plus-libretro-nx | TODO | TODO |
| pcsx_rearmed | GPLv2 | https://github.com/libretro/pcsx_rearmed | TODO | TODO |
| desmume | GPLv2 | https://github.com/libretro/desmume | TODO | TODO |

## How to pin a commit (per release)

The buildbot does not expose per-DLL commits directly. Options, cleanest
first:

1. Build the cores yourself from a tagged libretro snapshot and record the
   commit — then the DLL and the source match by construction.
2. Record the buildbot build timestamp for stable 1.22.2 and capture each
   upstream repo at that date; archive the tarballs to the mirror.

We ship the binaries **unmodified**; no local patches apply to the
GPL/MPL components. (The only patched source in this project is our own
EmulationStation build — see the project STATUS/build recipe — which is
MIT and carries no copyleft source obligation.)
