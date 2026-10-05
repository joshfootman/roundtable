# Map fixture coverage

Collected and validated on 1 October 2026. The renderer supports the ten-map inventory through map calibration data and a shared rotation/floor model. Full recordings stay in ignored `fixtures/local/`; Dust II remains at `fixtures/local/faze-vs-vitality-m2-dust2.dem`. Raw recordings are development inputs, not CI dependencies. [The manifest](../fixtures/maps.json) records source URLs, byte sizes and SHA-256 hashes.

## Accepted recordings

| Map      | Fixture                                  | Completed rounds |
| -------- | ---------------------------------------- | ---------------: |
| Ancient  | `natus-vincere-vs-spirit-m2-ancient.dem` |               42 |
| Ancient  | `faze-vs-natus-vincere-m1-ancient.dem`   |               22 |
| Anubis   | `vitality-vs-inner-circle-m1-anubis.dem` |               21 |
| Cache    | `vitality-vs-inner-circle-m2-cache.dem`  |               29 |
| Dust II  | `faze-vs-vitality-m2-dust2.dem`          |               23 |
| Inferno  | `faze-vs-vitality-m1-inferno.dem`        |               17 |
| Inferno  | `vitality-vs-g2-m4-inferno.dem`          |               28 |
| Mirage   | `faze-vs-vitality-m3-mirage.dem`         |               19 |
| Nuke     | `astralis-vs-mouz-m2-nuke.dem`           |               22 |
| Overpass | `vitality-vs-g2-m3-overpass.dem`         |               19 |
| Train    | `vitality-vs-g2-m5-train.dem`            |               19 |
| Vertigo  | `astralis-vs-mouz-m1-vertigo.dem`        |               20 |

Ancient includes triple overtime; Cache and the newer Inferno include overtime. NAVI–Spirit at BLAST Bounty 2025 provides a match between HLTV #3 and #1, satisfying HLTV’s published five-star criterion. Astralis–MOUZ at World Final 2024 supplies compatible Nuke and Vertigo recordings; it is not claimed as five-star. The manifest links every match. Downloads retain the original archives.

The earlier Copenhagen recordings omit the optional wire field `server_start_tick`, independently confirmed with `protoc`. The app previously rejected them because its metadata contract unnecessarily required that unused field. `DemoMetadata` now contains only required product values. It does not expose a nullable or invented server tick. The Copenhagen Ancient recording now includes pistol round. Its opening checkpoint records an active competitive freeze at tick 0. The tracker captures that state even without a `round_start` event. The recorded freeze ends at tick 1681, the result is at 9451, and round 2 starts at 9899. All 22 rounds match the independent reference. Opening checkpoints during live play remain excluded. Recent recordings required explicit entity wire types and correct handling of player user ID zero versus the world-kill sentinel.

## Calibration and imagery

Positions, facing, shots, bomb and utility share the same transform. All maps now use native game radar PNGs with transparent backgrounds. The index replay and `/demo` use the shared `createMapScene` implementation for texture loading, image orientation, floor selection, viewport sizing and cleanup. Both views add players, facing, deaths, flash indicators, bomb, shots and recorded utility overlays. Both map renderers apply `rotation` to the radar image. `origin` and `scale` calibrate world coordinates against the radar PNG; `imageSize` defines the image coordinate space. `defaultZoom` controls each map's opening viewport size independently of world calibration. Rotation is applied to the radar sprite; overlays already contain transformed coordinates and are not rotated twice. Floor changes reapply the image transform. `name` supplies labels, `image` / `images` select textures, `initialFloor` selects the opening texture, and `boundaryZ` filters recorded objects by floor in both views.

The radars and overview calibration values come from [cs2-map-icons](https://github.com/MurkyYT/cs2-map-icons/tree/ae7ed6ac9bdebf7782c71ee2454f20738595e57e), pinned to `ae7ed6ac9bdebf7782c71ee2454f20738595e57e`. Each image retains its 1024 × 1024 canvas so transparent margins do not change coordinate alignment. Nuke’s upper and lower floors share the same orientation. Their stray one-pixel canvas borders are fully transparent; all interior RGBA pixels are unchanged. The built-in image tool was prompted to remove only the outer border and preserve the interior, and only the transparent edge treatment was applied to the original radars.

Nuke uses the pinned overview scale of **7 world units per radar pixel**. The earlier value of 5 projected CT spawn beyond the native 1024px canvas and displaced movement throughout both floors. A regression check anchors the independently recorded CT and T spawn coordinates at (851, 461.571) and (235, 558.857) radar pixels. This corrects the shared transform for players, bomb, shots and utility; playback timing and the floor boundary are unchanged.

Split floors use overview height boundaries: Nuke −495, Vertigo 11700, Train −50. Train opens on its lower floor, where the recorded starting players stand. Floor changes retain the scene, playback tick and play/pause state, and filter players, bomb, shots and utility consistently. Hidden trajectory segments are not joined across floors.

Browser checks use ignored compact first-round extracts of the real recordings. They establish import, visual spawn alignment and shared renderer behavior; they do not replace full-recording parser checks. Regression tests exercise rotation/facing, height boundaries, recent entity compatibility and floor changes with actual canvas output. Utility areas remain approximate.

## Independent verification

The custom parser matches all 281 completed rounds across 12 recordings, including Copenhagen Ancient: round boundaries, kill identities and planted-bomb positions. Lint, formatting, TypeScript, 35 unit tests, nine browser tests and the production build pass. Real compact first-round browser imports, play/pause and backward seeks passed for each added map; Nuke, Vertigo and Train also retained the tick through floor changes.

Committed reports in `fixtures/maps-reference/` come from demoinfocs-golang v5.2.0, not the production parser. The reference generator excludes events outside accepted competitive round intervals. It records full round boundaries, kills and planted-bomb XYZ, plus the first round’s start/live player XYZ and facing. Player samples are not an assertion of every movement frame or exact utility reconstruction.

```sh
cd scripts/replay-reference/maps
go run . /absolute/path/to/recording.dem > ../../../fixtures/maps-reference/recording.json
cd ../../..
npm run verify:maps -- fixtures/local/recording.dem
```

The Effect verifier closes files through a scope and fails on differences. Pass recordings with matching committed references. Copenhagen Ancient is now accepted and included. The other Copenhagen recordings have no committed full-round reference, so they are not inputs to this gate. `npm run inspect:maps -- fixtures/local/*.dem` provides a first-round compatibility inspection.

## Older and recent playback verification

On 1 October 2026, the full-file differential gate was rerun for 2024 Dust II
(23 rounds), Copenhagen Ancient (22), recent Anubis (21) and Cache (29). All 95
rounds matched the independent boundaries, death identities and planted-bomb
positions, with opening freeze/live player samples checked as well.

Three production-browser imports each of Copenhagen Ancient and recent Anubis
played recorded movement and sought forwards and backwards on this Apple M2
laptop with Chromium 153.0.8010.12. These checks used real full files. The playback
benchmark was retired on 5 October 2026; these results are retained as historical
verification. Current browser coverage lives in the regression suite.
