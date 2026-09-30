# First competitive round fixture

Source is `fixtures/faze-vs-vitality-m2-dust2.dem`, the supplied 2024 BLAST Premier
Spring Final Dust II recording. Source SHA-256 is
`0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4`.

`dust2-first-round.dem.gz` contains records through tick 8282. It preserves the
recorded header, serializers, classes, string-table snapshots and playback footer.
Network packets retain the exact original payload bytes for tick, server info,
string-table create/update/clear, entity updates and legacy game events/descriptors.
Other network messages are removed, packet envelopes are re-encoded uncompressed,
and the footer offset is relocated. The runtime importer still accepts raw demos;
tests decompress this fixture before importing it.

The compressed fixture is 2,354,411 bytes and expands to 3,696,761 bytes. SHA-256 is
`28f722f2c30e659d147eda9a52f00acfeb092f44d62eaf5268ba9e33c85633c7`.

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
go run . ../../fixtures/faze-vs-vitality-m2-dust2.dem > /tmp/roundtable-reference.json
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
