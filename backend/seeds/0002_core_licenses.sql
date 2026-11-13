-- Swap non-commercial libretro cores for commercial-safe GPL ones (distro Phase 0).
-- snes9x / genesis_plus_gx / picodrive are Non-commercial (libretro license table).
-- Replacements: bsnes (GPLv3), blastem (GPLv3), gearsystem (GPLv3). Idempotent.
UPDATE systems SET default_core = 'bsnes'      WHERE id = 'snes'         AND default_core IN ('snes9x','mesen-s');
UPDATE systems SET default_core = 'blastem'    WHERE id = 'megadrive'    AND default_core = 'genesis_plus_gx';
UPDATE systems SET default_core = 'gearsystem' WHERE id = 'mastersystem' AND default_core = 'genesis_plus_gx';
