# First competitive round fixture

`nuke-ladder.json` records movement-state changes between ticks 7900 and 8500 in
`fixtures/local/astralis-vs-mouz-m2-nuke.dem`. It was independently extracted with
demoinfocs-golang v4.5.1 at FrameDone from the player pawn's `m_MoveType`, with 9
identifying ladder movement. Initial states and subsequent transitions verify
ladder entry and exit in the bundled Nuke replay. Source identity and SHA-256 are
recorded in `src/demo/examples.ts`.

Source is `fixtures/local/faze-vs-vitality-m2-dust2.dem`, the supplied 2024 BLAST Premier
Spring Final Dust II recording. Source SHA-256 is
`0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4`.

`dust2-first-round.dem.gz` contains records through tick 8282. It preserves the
recorded header, serializers, classes, string-table snapshots and playback footer.
Network packets retain the exact original payload bytes for tick, server info,
string-table create/update/clear, entity updates and legacy game events/descriptors.
Other network messages are removed, packet envelopes are re-encoded uncompressed,
and the footer offset is relocated. The runtime importer still accepts raw demos;
tests decompress this fixture before importing it.

The compressed fixture is 2,360,114 bytes and expands to 3,703,496 bytes. SHA-256 is
`32927b83ed3fa5f22f41bf1d74534ea5ae935dd52faf6a680aa6d182cdfa4983`.

Regenerate from the full source with Node 24:

```sh
node --experimental-transform-types scripts/extract-replay-fixture.ts
```

`oracle.json` contains literal reference output from demoinfocs-golang v4.5.1 for
round start 537, freeze end 5732, live samples 5796 and 6400, round end 7834, and the
last post-round sample 8281. The round completes at 8282, before the next round's
new spawn positions. The discarded restart begins at 449. Tick interval is 1/64
second. The reference recorded each player's Steam ID, name, team, XYZ and alive
state at FrameDone; the last frame for each sampled tick was retained.

The reference parser is only a verification oracle. All runtime positions come
from the project's custom TypeScript entity decoder. `npm run verify:round` checks
these samples against the full source demo, independently of fixture compaction.

## Full-match boundary oracle

`round-boundaries.json` records all 23 competitive rounds from the same source
demo, independently decoded with demoinfocs-golang v4.5.1. Start, freeze-end,
result and completion ticks come from recorded game events and game-rule
transitions. The final round completes at the last recorded packet, tick 197008,
following its result at 194674. Every overtime value is zero in this fixture.

Run `npm run verify:rounds` with the full local demo present to compare the custom
stream's retained competitive round numbers, overtime counts and all four phase boundaries without retaining all buffers.
The separate discovery assertion includes the abandoned start at 449; a reset
clears completed summaries before final comparison.
This complements the compact coordinate fixture and requires the original file.

The generated lifecycle tests additionally cover overtime rounds 25 and 31,
including freeze, recorded result, and final postmatch samples. These are explicit
state inputs, not a captured overtime demo. The supplied full-match oracle has
no overtime and cannot establish historical overtime compatibility.

## Player inspection reference

The six first-round samples also contain independently decoded health and yaw.
Yaw is the recorded eye-angle Y component in degrees. Health remains the recorded
signed integer. Current teams are sampled beside health and facing, independently
of the player identity catalogue.

Regenerate the independent inspection and event reference from the full local demo
with Go and the pinned demoinfocs v4.5.1 module:

```sh
cd scripts/replay-reference
go run . ../../fixtures/local/faze-vs-vitality-m2-dust2.dem > /tmp/roundtable-reference.json
```

The production parser reads no reference data. `npm run verify:round` compares
all six samples through the custom parser. `npm run verify:rounds` reports total
completed typed-buffer bytes. With health, yaw and current teams, all 23 rounds
publish 44,008,608 bytes. This excludes browser and structured-object overhead.

Weapon names and gun ammunition in `oracle.json` come from the independent
reference parser. Knife, bomb and grenade convenience ammunition values are
excluded. Unarmed is a recorded state. Item definition IDs use the local wire
serializer field `m_iItemDefinitionIndex`.

Armour and carried grenades use independent player and inventory samples.
Flash quantities use `FlashbangCount()` rather than inventory entity count or
reserve ammunition. Broky carries two flashes at 5732, 5796, 6400 and 7443, then
one at 7444. The existing parser regression checks that recorded transition.

`dust2-through-round-4.dem.gz` preserves contiguous network history from the
recording start through tick 32413. It completes four rounds and retains the
original metadata footer. Regenerate with `node --experimental-transform-types
scripts/extract-replay-fixture.ts fixtures/local/faze-vs-vitality-m2-dust2.dem 32413
fixtures/replay/dust2-through-round-4.dem.gz`. It is 14,411,094 bytes compressed.
SHA-256 is `e8bc614d7039d65d4c47243ff4baf0cbad76b32dbc8a10a73dea16da2e7efbf9`.
The independent parser matches the original recording at all 20 selected player
and bomb samples and all 337 event counts through this boundary. Sparse full
packet segments lacked equipment history and are not used as fixtures.

`bomb-events.json` contains the independent full-match bomb interaction facts.
Beginnings and cancellations come from the reference parser’s entity callbacks.
Plant, defuse and explosion completions also exist as raw recorded legacy events.
The full-round verifier checks all 36 facts, including five explosions.

## Grenade reference

`projectile-lifetimes.json` contains 421 independently decoded projectile
identities and visible flight intervals. `detonations.json` contains 418 raw
recorded detonation events. `first-flash.json` retains every position of the
first flash flight, using the last reference frame at each tick. Coordinates
are normalized to float32, matching the published buffers. The full-match
verifier compares every lifetime and detonation. The compact parser regression
compares the complete first flight and the first four rounds' utility events.

Detonation rings last one second as a presentation cue. They do not represent
recorded effect duration. Projectile buffers bring full-match published typed
arrays to 44,890,976 bytes, excluding object and browser overhead.

`smokes.json` contains 119 independently recorded smoke intervals, clipped to
round coverage. Recorded expiry or projectile destruction ends each interval.
Five smokes are removed without an expiry event. The viewer uses a 144 world-unit
radius as an approximate tactical symbol, without wall clipping or visibility
claims. Areas disappear at their exclusive end tick and restore on reverse seek.

`fires.json` contains 107 independently sampled geometry changes through round
four. Only currently burning cells appear, including empty extinction frames.
Absolute recorded XYZ values and entity serials are preserved. The viewer draws
60 world-unit circles as approximate patches. It does not fill a convex hull or
claim exact damage coverage. First fire extinction at 19554 precedes entity
deletion at 20490. The oracle generator emits this data as `fireFrames`.

`shots.json` contains all 2,568 independent competitive `CMsgTEFireBullets`
messages. Both compact fixtures retain network ID 452. Shot origin, pitch, yaw,
weapon and shooter handle are recorded. The tactical trace scales with the player markers
to remain visible on narrow maps and lasts 0.15 seconds. Its presentation length
and duration represent neither a collision endpoint nor bullet travel time. No impact endpoints exist in this source.

`flashes.json` contains 44 independent player flash-state frames through round
four. Positive durations retain their recorded update tick; remaining time is
computed from the replay tick. Baseline reads do not invent flash beginnings.
Subsequent full entity checkpoints are skipped during sequential parsing, as in
the reference decoder, so repeated snapshots cannot restart a flash timer.
Indicators are steady markers with text; they never flash the page.

## Newer protocol fixture

`anubis-2026-first-round.dem.gz` contains the first competitive round of
[Vitality–Inner Circle at BLAST Open Porto 2026](https://www.hltv.org/matches/2396927/vitality-vs-inner-circle-blast-open-porto-2026).
The full source is `fixtures/local/vitality-vs-inner-circle-m1-anubis.dem`, with
SHA-256 `f41e9f1e473b953434082238aa836b04437c4db70a8c0a0aca2e0f6cee1f150f`.
The same extraction process preserves records through tick 14584. The compressed
fixture is 5,479,977 bytes and expands to 9,370,761 bytes. Its SHA-256 is
`bbd76379c4455bcfa8f110d70a9e8da8d7e15ee503cff17520e4585db2c16b85`.

```sh
node --experimental-transform-types scripts/extract-replay-fixture.ts fixtures/local/vitality-vs-inner-circle-m1-anubis.dem 14584 fixtures/replay/anubis-2026-first-round.dem.gz
```

`compatibility.test.ts` imports this recording through `readDemo`. Its literal
movement, identity, facing and health assertions come from demoinfocs-golang
v5.2.0 at FrameDone tick 12000. That reference independently records the first
round beginning at 367, its result at 14136 and the next round beginning at 14584. It reports headtr1ck's death at 14525 with no killer. The recorded event
uses attacker 65535. The fixture exercises newer animation enums, 64-bit resource
identifiers, binary blocks and global symbols before the asserted movement.
The older v4.5.1 reference cannot decode these 2026 recordings reliably.

## Dropped equipment oracle

`dropped-items.json` records unowned equipment identities and XYZ positions at nine
sample ticks in the first four Dust II rounds. demoinfocs-golang v4.5.1 supplies the
reference through its equipment collection, independently of the TypeScript decoder.
C4 and knives are excluded. Team introduction and selection actors are not equipment.

Regenerate from the verified full source recording:

```sh
cd scripts/replay-reference
go run ./dropped-items > ../../fixtures/replay/dropped-items.json
```

Compare the replay capture from the repository root:

```sh
node --experimental-transform-types scripts/verify-dropped-items.ts
```
