-- Seed of RetroBat systems (closed list, SPEC §3/§7.1). Idempotent.
-- retrobat_folder = folder under RetroBat roms\<folder>; default_core = libretro core.
INSERT OR IGNORE INTO systems (id, name, retrobat_folder, default_core, extensions, sort_order) VALUES
  ('nes',          'Nintendo Entertainment System', 'nes',          'fceumm',           '.nes,.zip,.7z',              0),
  ('snes',         'Super Nintendo',                'snes',         'bsnes',            '.sfc,.smc,.zip,.7z',         1),
  ('gb',           'Game Boy',                      'gb',           'gambatte',         '.gb,.zip,.7z',               2),
  ('gbc',          'Game Boy Color',                'gbc',          'gambatte',         '.gbc,.zip,.7z',              3),
  ('gba',          'Game Boy Advance',              'gba',          'mgba',             '.gba,.zip,.7z',              4),
  ('megadrive',    'Sega Mega Drive / Genesis',     'megadrive',    'blastem',          '.md,.bin,.gen,.smd,.zip,.7z', 5),
  ('mastersystem', 'Sega Master System',            'mastersystem', 'gearsystem',       '.sms,.zip,.7z',              6),
  ('n64',          'Nintendo 64',                   'n64',          'mupen64plus_next', '.n64,.z64,.v64,.zip,.7z',    7),
  ('psx',          'Sony PlayStation',              'psx',          'pcsx_rearmed',     '.cue,.bin,.chd,.pbp,.m3u',   8),
  ('nds',          'Nintendo DS',                   'nds',          'desmume',          '.nds,.zip,.7z',              9);
