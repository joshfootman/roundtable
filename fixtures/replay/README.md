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
