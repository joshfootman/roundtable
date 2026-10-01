# CS2 icons

Unmodified SVG assets from
[Juknum/counter-strike-icons](https://github.com/Juknum/counter-strike-icons),
used locally by Roundtable's replay UI. Roundtable is a non-commercial
CV/portfolio project.

- Source commit: `85ec43bd170d0622db8eadf160e666c161976375`
- Upstream CS2 build (`cs2_version.txt`): `25640462`
- Retrieved: 2026-10-01
- `equipment/`: all SVGs from `cs2/panorama/images/icons/equipment/`.
- `deathnotice/`: all SVGs from `cs2/panorama/images/hud/deathnotice/`.

Original filenames are preserved. The headshot icon is
`deathnotice/icon_headshot.svg`. Weapon filenames use internal game names:
`equipment/m4a1.svg` is the M4A4, `equipment/m4a1_silencer.svg` is the M4A1-S,
and `equipment/hkp2000.svg` / `equipment/p2000.svg` are P2000 variants.

The replay UI uses these assets for recorded weapons, kill weapons, headshots, armour, helmets, grenades, flash indicators and bomb interactions. Death-event weapon identifiers select kill icons. Unknown causes keep their recorded text. Empty upstream world and trigger-hurt SVGs are not rendered.

## Attribution

Counter-Strike artwork belongs to Valve Corporation. The upstream repository's
MIT licence applies to its code/tooling, not these game assets. The original
asset terms and licence are preserved in [LICENSE.upstream.txt](LICENSE.upstream.txt).
