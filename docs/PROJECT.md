# CS2 replay viewer

Status: local import, progressive round discovery and selection, competitive eligibility, and tactical playback with freeze and post-round phases implemented with Effect and PixiJS. Player inspection, kills, bomb interactions, recorded grenade trajectories, approximate smoke/fire areas, shot-direction traces and flash indicators are implemented. Player/team filters and utility toggles have renderer support but no UI yet. All 23 supplied Dust2 rounds match independent boundary and event oracles. Real overtime fixtures cover Ancient, Cache and Inferno. Ten-map calibration and selectable floors are documented in docs/map-coverage.md; knife fixtures remain compatibility checks.
Requirements below settled unless marked **proposed**, **optional** or **open**.

## Product

- Portfolio: product/design engineering; small, polished, end-to-end.
- Custom TypeScript parser mandatory; existing parsers = references/test oracles.
- Browser-only processing; static hosting; no parsing server.
- Import = local `.dem` selection; no demo upload to backend.
- No timebox. Performance critical from first implementation.
- Desktop + tablet + phone. Touch + mouse/keyboard. Layout iterated in code.
- Accessibility release target: WCAG 2.1 Level AA; applicable A + AA criteria across complete import/replay flows.

## Release scope

- User-provided example match + local import.
- Current example: FaZe vs Vitality, Dust2 (map 2), from the supplied BLAST Premier Spring Final 2024 archive. Local file: `fixtures/local/faze-vs-vitality-m2-dust2.dem`; provenance in [fixtures/README.md](../fixtures/README.md).
- Example: prefer pre-parsed static data; confirm after download-size/load-time versus live-parse benchmarks. Same replay contract/viewer; custom parser benchmarked separately.
- Flat tactical map; one active round; every parsed round selectable.
- Selectable rounds: competitive + overtime; freeze time + post-round activity included.
- Exclude warmup, knife rounds, abandoned restart attempts. Terms: [CONTEXT.md](CONTEXT.md).
- Play/pause, bidirectional scrubbing, player inspection.
- Desktop white freehand drawing with subtle pressure variation and clear-all, scoped to the current round and floor. Drawings follow the map camera and stay in memory for the current demo.
- Playback speed/event jumps: proposed controls.
- Players: identity, name, team, XYZ, facing, health, alive/dead.
- Initial roster: human identities with recorded pawn positions in the first completed competitive round. Exclude TV clients, fake players and clients who only spectate. Preserve Steam IDs as exact decimal strings; do not infer team names from the download source.
- Equipment: weapon, ammo, armour, carried grenades, **money**.
- Combat: kills, deaths, kill feed.
- Bomb: position, carrier, plant/defuse state.
- Utility: recorded trajectories/detonations, flashed-player indicators.
- Smoke/fire: approximate tactical areas; no exact visibility claims.
- Filters: players, teams, utility. Display only; no player-knowledge simulation.
- Maps: current competitive pool + established tournament staples; CS2 versions only. Nuke included; pivot if floor handling disproportionate.
- Progressive import: metadata → pending round slots → completed playable rounds.

Excluded: CS:GO, 3D, heatmaps, advanced economy/pattern analysis, live broadcasts, exact smoke/fire reconstruction.

## Compatibility

- CS2 demos regardless of download source; no FACEIT/HLTV restrictions.
- Raw `.dem` imports only; validate file signature. Archives → “extract first”; no archive decompression.
- Older user demo + recent tournament fixtures; fix incompatibilities encountered.
- No universal historical guarantee; no arbitrary rejection of working older files.
- POV: coverage unresolved; missing information explicit, never invented.
- Missing values ≠ zero. Stable player identity ≠ recyclable entity slot.
- Returned metadata fields are required product values. Optional wire fields with no product consumer, such as `server_start_tick`, are excluded from `DemoMetadata`; their omission does not make a recording incomplete.
- Map imagery/calibration versioned; verify against demo layout. Fixture coverage and current blockers: [map-coverage.md](map-coverage.md).
- Working map inventory (2026-09-28): Ancient, Anubis, Cache, Dust II, Inferno, Mirage, Nuke, Overpass, Train, Vertigo.
- Additional tournament staples: add with relevant CS2 demos + matching radar/calibration; no blanket Workshop support or CS:GO parsing.

## Stack

| Area         | Choice                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| App/routing  | React + TanStack Router; static SPA                                       |
| Build        | Vite integration; versions pinned at scaffold                             |
| Coordination | Effect: parser API, file reads, typed errors, import lifecycle, resources |
| Map          | PixiJS; direct frame-loop integration                                     |
| UI           | shadcn/ui; custom visual design                                           |
| Styling      | Tailwind + CSS variables proposed; one primitive family                   |
| Protobuf     | Protobuf-ES; validate schema generation                                   |
| Compression  | snappyjs initial choice; verify block compatibility/perf                  |
| Tests        | Vitest + Playwright; real-phone checks                                    |
| Persistence  | None; HTTP caching for the pre-parsed example                             |

Versions are pinned in `package.json`. WASM only if profiling justifies specific work.

## Architecture

```text
Local file → parsing worker → completed round buffers → replay store
                                                        ↓
                                                 playback engine
                                                   ↙         ↘
                                              PixiJS        React UI
```

Source layout:

```text
src/demo/     byte decoding, CS2 state, round extraction, worker, import session
src/replay/   output contract, indexes, playback, Pixi renderers
src/components/, src/routes/   UI
```

- Parser core: Effect API with typed failures and effectful file reads; no React/Pixi/DOM dependencies; usable in CLI benchmarks.
- Decode: framing → Snappy → protobuf → tables/serializers/baselines → field paths/entities → CS2 state → rounds.
- Retain required decoder state; discard unwanted values after consuming encoding.
- Protobuf `entity_data` = opaque bytes; custom inner decoder still required.
- Generated schemas separate; compatibility fixes backed by fixtures.
- Effect scope owns worker/listeners/reads. Replacement/cancel cleans resources.
- Hot decoding loops: synchronous functions; bounded batches/yield points.
- Effect interruption cannot pre-empt synchronous loop; hard cancel may terminate worker.
- Round navigation preserves import session; no worker restart.
- Replay buffers outside React state; UI subscribes to small state changes.
- PixiJS clock drives frames; no global React rerender per frame.
- Seek from indexed replay state; no demo reparsing.
- Reverse seek restores equipment, money, bomb, health, active utility.
- Preserve event timing + Z. No interpolation across deaths/teleports/missing data.
- URL: selected view only; no per-frame history updates. Refresh needs cache or reimport.
- Static host: SPA route fallback; browser-only initialisation after client startup.

## Progressive delivery

- Read metadata early; populate pending slots where possible.
- `CDemoFileHeader`: no round count.
- `CDemoFileInfo.game_info.cs.round_start_ticks`: optional round-start list.
- Validate outer-header file-info offset; reconcile metadata with actual events.
- Metadata import requires every field in `DemoMetadata`. Missing fields, blank strings, or invalid numeric values fail with a parsing error; successful metadata contains no nullable values.
- Discover and stream completed rounds during sequential decoding. An optional round-start index does not replace round parsing.
- Publish completed rounds: initial state + tracks + events + referenced metadata.
- Continue sequential decoding; maintain current entity state after publishing.
- New round arrival never resets playback/selection.
- One stream: metadata + N round payloads; progress/errors/completion additional.

Protocol:

```text
UI → worker: the selected File
worker → UI: metadata, progress, round-ready, complete, error
```

- One worker per import; the Effect scope terminates it on cancel or replacement, so abandoned results never arrive.
- Transfer ArrayBuffers; bounded delivery queue; cheap UI handlers.
- Published buffers independent of mutable parser state.
- Validate round finalisation against fixtures; metadata count not authoritative.

Failure policy:

- Recoverable file-read failures: up to 3 total attempts (initial + 2 retries).
- Retry same read without advancing decoder state or duplicating output.
- Corrupt/truncated data, unsupported encoding, parser bugs: stop; no automatic retry.
- Memory exhaustion: stop; explain limit; no identical automatic retry.
- Failure after completed rounds: retain playable rounds, discard unfinished round, mark import incomplete, show reason.

## Performance + storage

- Measure first-round availability **and** total parse time.
- Test playback/scrubbing during active parsing, especially phones.
- Track demo size/version, device/browser, build mode, asset load, transfer cost.
- Track peak memory where measurable, output size, repeated-import cleanup.
- Typed arrays for tracks; small objects for metadata. No whole-demo JSON.
- Reuse scratch buffers; bounded reads/queues; precompute field bindings where useful.
- Downsampling output ≠ skipping required entity updates.
- Final record layout/time precision/sample rate: open. Earlier byte examples illustrative only.

Performance testing:

- Playwright benchmarks: fixed demos, production builds, repeated runs, app timing markers.
- Measure import → first round rendered; import → all rounds ready; seek → updated frame.
- Track frame gaps during concurrent parsing/playback; repeated-import cleanup; memory where supported.
- CI: consistent hardware + recorded baseline; regression thresholds after initial measurements.
- Real devices: user's laptop + phone; periodic responsiveness, touch and memory checks.
- Mobile emulation ≠ phone CPU/GPU/memory. Record actual models/browsers when testing.
- Numerical budgets set after baseline; earlier 5 s/15 s suggestions not requirements.

Parser import measurements and output-equivalence checks are recorded in [parser performance measurements](parser-performance.md).

No IndexedDB cache. A measured Dexie cache saved 8.5% of whole-match load time for the example, made the first round slower, and did not justify invalidation and quota handling.

## Verification + first milestone

- Fixtures: older 2024 and recent 2025–2026 tournament recordings are available locally. Independent references and coverage are recorded in [map coverage](map-coverage.md).
- Differential checks: identities, rounds, positions, events; investigate disagreements.
- Test binary readers, malformed/truncated inputs, backward seeks.
- Test money/equipment, bomb/utility lifetimes, overtime, reconnects, Nuke floors.
- Test progressive availability, cancellation/replacement, repeated imports.
- First vertical slice: real round playable/scrubbable while remaining demo parses.
- Add full release data + map coverage; polish responsive UI; evaluate caching.

## Accessibility

- Keyboard-operable controls/timeline; visible focus; no keyboard traps.
- Labels, semantic controls, accessible errors/progress; no colour-only meaning.
- Contrast, text resizing/reflow, orientation and pointer alternatives per WCAG 2.1 AA.
- Canvas information: meaningful accessible alternatives; player/event HTML alone not assumed sufficient.
- Replay pause/control; avoid hazardous flashes. Criteria audit includes tactical view.
- Automated checks alongside Playwright + manual keyboard/screen-reader/zoom/touch evaluation.
- Passing automation ≠ conformance; verify complete workflows before claiming AA.

## Open decisions — review one at a time

1. POV limitations; graceful unsupported-map/data handling.

Implementation choices, not blockers: exact layout, package versions, primitive family, output schema, cache policy.

## References

- Map pool updates: [Anubis replaces Train](https://www.hltv.org/news/43600/anubis-replaces-train-in-active-duty-pool), [Cache replaces Overpass](https://www.hltv.org/news/44984/cache-replaces-overpass-in-active-duty-pool).

- [WCAG 2.1 conformance](https://www.w3.org/TR/WCAG21/#conformance-reqs), [accessibility evaluation](https://www.w3.org/WAI/test-evaluate/).

- Parsers: [demoinfocs](https://github.com/markus-wa/demoinfocs-golang), [demoparser](https://github.com/LaihoE/demoparser), [demofile-net](https://github.com/saul/demofile-net), [cs2parser](https://github.com/osztenkurden/cs2parser).
- Schemas: [SteamTracking](https://github.com/SteamTracking/Protobufs); extracted descriptors, not complete entity-decoding specification.
- Snapshot commit: `14db58bad6e6ac2cb794b441c7b3d0d2a6dd1752`; preserve upstream notices.
- Unresolved imports: `google/protobuf/descriptor.proto`, `s2/steammessages.proto`; snapshot not compile-ready.
- [Container metadata offsets](https://docs.rs/pbdems2/latest/pbdems2/guide/file_structure/index.html).
- [Map images/transforms](https://awpy.readthedocs.io/en/stable/visibility.html).
- [Start SPA deployment](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode).
- [Effect scopes](https://effect.website/docs/v3/resource-management/scope).
