# Tactical replay

`ReplayRound` contains synchronized recorded samples in stable player order. Positions
are XYZ floats indexed by `(sample * players.length + player) * 3`. Alive flags use
`sample * players.length + player`. The parser constructs synchronized buffers in this order before
publishing them. Playback holds the preceding sample. It does not interpolate through
deaths or gaps.

Pixi owns the playback clock and marker updates. React receives snapshots at most four
times per second and when playback changes. The HTML player list exposes the recorded
coordinates, teams and alive state without relying on canvas or colour.

The native Replay position range seeks directly into the recorded buffers. Seeking
updates the canvas immediately and preserves playback or pause. Seeking to the end
pauses. Arrow keys, Home and End work without custom keyboard handlers.

## Radar calibration

The supplied `src/assets/de_dust2_radar_psd.png` is 1024 × 1024. Its SHA-256 is
`4549e4e49fdb34bf28cc820b7b7b9f9c47cf3a1743caec2a67f2435ca6e8398c`.

The [extracted Valve overview](https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_dust2.txt)
records origin `(-2476, 3239)`, scale `4.4` world units per native image pixel and zero
insets. The supplied image's bomb sites and spawn areas visually match the extracted
radar geometry. The images are not byte-identical. The supplied version has transparent
space outside the playable layout.

World X maps to `(x + 2476) / 4.4`. World Y maps to `(3239 - y) / 4.4`. The overview's
rotation and zoom settings configure the game's radar presentation. They do not change
this transform into the raw image.

The renderer and parser are map-agnostic. `maps.ts` owns image URLs, world origins and
scales for Dust II, Mirage, Ancient, Anubis, Inferno and Overpass. Those values come
from the same extracted overview directory. The supplied images are native 1024-pixel
radars; game radar inset/zoom settings do not crop these textures.

Dust II is verified against the supplied 2024 demo and independent world-coordinate
samples. Other registered maps have overview-based calibration, but no real demo
verification in this repository yet. Nuke and Vertigo imagery is retained for the
later floor-selection tasks rather than drawing lower-floor players on an upper-floor
image. Missing map definitions produce an explicit unavailable-map message.

This first completed round includes recorded freeze time and post-round activity.
The initial view shows starting positions. Play begins at `liveStartTick`, taken from
the recorded freeze-end event, so a long freeze does not conceal movement. The clock
measures time since freeze end. Playback continues through post-round activity and
stops before the next round.
