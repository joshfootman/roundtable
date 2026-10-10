# Tactical replay

`ReplayRound` contains synchronized recorded samples in stable player order. The per-player
tracks are listed once in `tracks.ts` and indexed `(sample * players.length + player) * width`.
A player who joins mid-round is appended to the roster; `present` is 0 for samples before
they joined and after they disconnect, and consumers hide them there.

`scenePlayers(round, tick)` in `scene.ts` is the renderer-independent view of the players at a
fractional tick: world-space position, facing, team, life, flash and bomb role. Position and
facing blend toward the next sample, with yaw taking the shorter arc. The earlier sample holds
across a death, respawn, team change, disconnect, or a jump of more than 128 units. The map
markers and player cards both read it.

Pixi owns the playback clock and marker updates. React receives snapshots at most four
times per second and when playback changes. `DemoWorkspace` renders the home and replay
routes. `DemoMap` keeps one Pixi scene per map and swaps a round layer from
`round-layer.ts` on each round switch. Timeline UI subscribes to drawn frames through the
playback controller. `DemoPlayerCards` shows player health, equipment, and match statistics.

Recorded round outcomes retain the winning side, reason, team name when available,
and MVP name when awarded in the demo. MVP comes from a recorded event or an increase
in the player's recorded MVP count, rather than a kill-count estimate. The score
updates at `resultTick`. A natural playback crossing shows the winner for two wall-clock
seconds; seeking only updates the score, and seeking backward clears the celebration.

The centred HUD retains both clan names per round, including side swaps. Bundled
matches use their curated team logos; local imports keep recorded names without
guessing logos. Missing names fall back to CT/T. Its centre shows the elapsed round
clock and opens a round picker with recorded winners and final scores. Previous/next
chevrons remain available. A naturally played outcome gives the enabled next-round
button five soft blue border pulses over three seconds. Reduced motion uses a static
border during the same three-second cue window. Seeking does not trigger this cue. The picker uses Base UI Popover for dismissal and focus
management. Round cards form a single scrollable column, with the current round
visible when opened. A Halftime divider marks a recorded regulation side swap between
consecutive rounds. Local demos without clan names use matching players' live-start
sides. Overtime side swaps do not add halftime dividers. Selecting a round closes it
and focuses the new round's centre control.
HUD and picker layout use Tailwind, including container queries for compact widths.

Five consecutive recorded wins activate animated blue CT or orange T flames inside
that team's score tile. The streak follows player rosters across side swaps, with
unique clan names as a fallback when roster evidence is unavailable. Seeking derives
it from the visible round history and includes the current result only at resultTick.
A loss, missing result or round gap stops the streak. The bounded WebGL layer draws
at most 30 frames per second, suspends while the page is hidden, and releases its
resources on removal. Reduced motion keeps a static flame frame. WebGL failure uses
static SVG flames instead. Score geometry, keyboard order and rolling digits stay intact.

The native Round timeline range seeks directly into the recorded buffers. Seeking
updates the canvas immediately and preserves playback or pause. Seeking to the end
pauses. Arrow keys, Home and End work without custom keyboard handlers.

## Player indicators

Player colour, number and facing remain the marker's core. A 10px carried C4 occupies
the fixed top-right slot. Planting turns the 12px C4 orange. Defusing uses a blue
defuse icon in that same slot. Flash occupies bottom-left.
Ladders occupy bottom-right while the recorded pawn movement type is `MOVETYPE_LADDER`
(9), as defined by the [CS2 movement enum](https://github.com/SteamTracking/GameTracking-CS2/blob/master/DumpSource2/schemas/client/MoveType_t.h).
Active indicators disappear on death and derive from the current tick when seeking.

Split-floor maps show a single stacked-floors icon in a compact row of map controls.
The highlighted layer shows the current floor; clicking toggles Upper and Lower.
Its tooltip and accessible label name the current floor and the next action.
Switching keeps the current tick and playback state. The icon uses the same
translucent surface as the player cards and playback controls.

Other-floor players remain visible as quieter, hollow markers behind players on the
selected floor. Double chevrons above them point up or down relative to that floor.
Dropped and planted bombs retain their 18px world marker on the selected floor.
The planted C4 stays orange and pulses gently from replay time, turning blue while
defusing and orange again if the defuse is aborted. A recorded explosion consumes
the icon and shows an 850ms core flash, shockwave and sparks at its planted position.
Pausing freezes these effects; seeking reconstructs their state at the requested tick.
Reduced motion keeps the planted icon steady and replaces the expanding blast with
a stationary fading ring. No countdown duration is inferred from a defused round.

The outer rim is reserved for fire exposure. This future indicator needs recorded state
or a separately agreed geometric approximation; it is not currently inferred from
proximity to a rendered fire area.

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
scales for the ten maps listed in `docs/map-coverage.md`. Those values come
from the same extracted overview directory. The supplied images are native 1024-pixel
radars; game radar inset/zoom settings do not crop these textures.

Every registered map is verified against real demos; see `docs/map-coverage.md`. Split-floor maps show the selected radar image
and distinguish players on the other floor with hollow markers and chevrons. Utility
areas and world bomb markers follow the selected floor. Missing map definitions
produce an explicit unavailable-map message.

This first completed round includes recorded freeze time and post-round activity.
The initial view shows starting positions. Play begins at `liveStartTick`, taken from
the recorded freeze-end event, so a long freeze does not conceal movement. The clock
measures time since freeze end. Playback continues through post-round activity and
stops before the next round.

## Dropped equipment

`ReplayRound.droppedItems` stores one placement per resting ground item: the recorded
entity, serial, equipment definition and XYZ position, visible for
`from <= tick < to`. A pickup, removal or move closes the placement, and a move opens
a new one. Placements still on the ground close at the round's end tick. Seeking
tests each placement's range, so rewinding restores earlier drops.

`createRoundLayer` loads SVG textures only for definitions present in that round. The renderer
keeps one sprite per placement and draws beneath utility effects
and players. Items follow the selected floor. Guns fit within 18 × 8 screen pixels,
and utility fits within 10 × 10 pixels. Both preserve their SVG proportions and use
the existing foreground colour at 55% opacity, without labels or backgrounds.
C4 keeps its separate bomb marker and recorded bomb state.

## Manual map camera

The top-left Zoom in, Zoom out and Focus map controls operate independently of playback.
Drag the radar to pan. The scroll wheel zooms around the cursor. Touch supports dragging
and two-finger pinch. With the map focused, Shift+arrow keys pan, plus and minus zoom, and Home
restores the default view. The opening view starts at 90% of the map's default framing, with zoom bounded from 60% to 400%.
Panning allows a gutter of 10% of the shorter viewport dimension beyond the image edges.
This gives every map room to move in all four directions immediately, including on square and phone viewports.
Camera position survives round and floor changes. Loading another map or example resets
it. Player markers and equipment retain their screen sizes while the radar scales.

Default camera framing uses a visually tuned `focusCenter` in the oriented radar coordinates. Both floors share this point; Focus restores it within the camera bounds. World coordinates and radar origins are independent of this framing.

## Replay shortcuts

K or Space toggles playback. J/L seek by ten seconds. Left/right select adjacent rounds. F switches floors, R recentres, and +/- zoom. Digits 0–9 seek to evenly spaced positions from 0% to 90% of the playable round, beginning at live start. Shift+arrows pan the focused map; Home also resets it. The keyboard button or ? opens shortcut help. Typing, sliders, open popovers and modified browser shortcuts keep their native behaviour. Space on a focused button activates that button.
