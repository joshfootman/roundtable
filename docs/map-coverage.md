# Map fixture coverage

Collected on 1 October 2026. Every inventory map has a local CS2 demo; only Dust II has completed playback validation. Individual implementation tasks live in [TASKS.md](TASKS.md).

Full recordings live in `fixtures/local/`, which Git ignores. The existing Dust II recording remains at `fixtures/faze-vs-vitality-m2-dust2.dem`. These recordings are development inputs, not public example assets or CI dependencies. [The manifest](../fixtures/maps.json) records independently decoded map identifiers, byte sizes and SHA-256 hashes.

## Sources

- [FaZe–Vitality, Spring Final 2024](https://www.hltv.org/matches/2372742/faze-vs-vitality-blast-premier-spring-final-2024): reused the supplied archive for Inferno and Mirage. Dust II was already validated.
- [Spirit–FaZe, Copenhagen Major 2024](https://www.hltv.org/matches/2370722/spirit-vs-faze-pgl-cs2-major-copenhagen-2024): downloaded from HLTV, demo 86162; extracted Nuke and Vertigo. The match page identifies the teams as HLTV #2 and #1. Both satisfy HLTV's five-star filter criterion, “two top 3 teams”; this rating is inferred from that published criterion, not a displayed historical star badge. Both maps include overtime.
- [FaZe–Natus Vincere, Copenhagen Major 2024](https://www.hltv.org/matches/2370727/faze-vs-natus-vincere-pgl-cs2-major-copenhagen-2024): downloaded from HLTV; extracted Ancient.
- [Vitality–G2, London final 2025](https://www.hltv.org/matches/2384856/vitality-vs-g2-blast-open-london-2025-finals): downloaded from HLTV, demo 99751; extracted Overpass, Inferno and Train. Inferno finished 12–16, providing a real overtime recording.
- [Vitality–Inner Circle, Porto 2026](https://www.hltv.org/matches/2396927/vitality-vs-inner-circle-blast-open-porto-2026): downloaded from HLTV, demo 110627; extracted Anubis and Cache. Cache finished 13–16. This is CS2 Cache, not an old CS:GO fixture.

The downloaded archives remain in Downloads. Only the selected extracted recordings are stored inside the repository directory.

## Initial validation

`protoc` independently decoded the file headers for all newly collected recordings. The custom parser was then exercised against required metadata and the first completed competitive round:

| Map      | Fixture                                  | Parser result                                                | Map work remaining                                                                                                            |
| -------- | ---------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Ancient  | `faze-vs-natus-vincere-m1-ancient.dem`   | Rejected: absent `server_start_tick`                         | Obtain a recording satisfying the metadata contract; verify calibration and layout version.                                   |
| Anubis   | `vitality-vs-inner-circle-m1-anubis.dem` | Metadata succeeds; entity decoding fails                     | Support the recorded field types; verify calibration against this layout version.                                             |
| Cache    | `vitality-vs-inner-circle-m2-cache.dem`  | Metadata succeeds; entity decoding fails                     | Obtain matching CS2 radar/calibration and add the map definition.                                                             |
| Dust II  | Existing Spring Final fixture            | Previously validated across all 23 rounds                    | Complete; retain existing regression coverage.                                                                                |
| Inferno  | `faze-vs-vitality-m1-inferno.dem`        | First competitive round succeeds: ten players, 12,774 frames | Rotate coordinates and facing; verify utility, bomb and landmark alignment.                                                   |
| Inferno  | `vitality-vs-g2-m4-inferno.dem`          | Metadata succeeds; entity decoding fails                     | After compatibility work, verify layout version and real overtime playback.                                                   |
| Mirage   | `faze-vs-vitality-m3-mirage.dem`         | First competitive round succeeds                             | Verify landmarks, facing and utility alignment; do not equate parser success with calibration validation.                     |
| Nuke     | `spirit-vs-faze-m2-nuke.dem`             | Rejected: absent `server_start_tick`                         | Obtain a recording satisfying the metadata contract; add calibration and floor selection/filtering.                           |
| Overpass | `vitality-vs-g2-m3-overpass.dem`         | Metadata succeeds; entity decoding fails                     | Verify calibration against the 2025 layout.                                                                                   |
| Train    | `vitality-vs-g2-m5-train.dem`            | Metadata succeeds; entity decoding fails                     | Obtain matching CS2 radar/calibration and add the map definition.                                                             |
| Vertigo  | `spirit-vs-faze-m3-vertigo.dem`          | Rejected: absent `server_start_tick`                         | Obtain a recording satisfying the metadata contract; verify the radar version, add calibration and floor selection/filtering. |

All five newer recordings fail on `EntityPlatformTypes_t (m_nPlatformType)`. This is an entity decoder compatibility problem, independent of map calibration. Supporting that field may expose further differences; these fixtures have not yet passed replay parsing.

The three Copenhagen fixtures genuinely omit `server_start_tick` according to independent header decoding. They remain rejected under the required-metadata policy. Do not insert zero, return null or weaken that policy to make these fixtures pass.

For the supplied Inferno radar, current world-to-map coordinates place the recorded CT spawn near `(925, 384)` and T spawn near `(88, 707)`, away from the spawn areas. A 90° clockwise image-space rotation around the radar centre maps these to approximately `(640, 925)` and `(317, 88)`, matching the pictured spawn areas. This establishes the rotation direction; full calibration still needs independent landmark checks. Facing, shots, bomb positions and utility must share the same transform.

Nuke and Vertigo already have upper/lower radar images, but neither has a map definition or floor model. Floor selection must preserve the current round and playback tick and apply consistently to players, bomb and utility. Cache and Train have no radar images in `src/assets/`.

## Reproduce

```sh
npm run inspect:maps -- fixtures/local/*.dem
```

The command reports metadata followed by a first-round summary, continues to the next file after a failure, and exits nonzero if any fixture fails. It closes each file through an Effect scope. This is a local inspection tool, not an independent correctness oracle or an automated calibration test. It does not validate the entire recording.

Before completing a map task, verify accepted metadata, full competitive/overtime round discovery, independently checked landmark coordinates, facing, bomb/utility alignment, scrubbing and playback in the browser. Add compact fixtures and regression assertions for actual differences; do not duplicate the existing Dust II suite for every map.
