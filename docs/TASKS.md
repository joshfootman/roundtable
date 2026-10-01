- [x] Import a local CS2 demo and display match metadata
- [x] Reject unsupported files with actionable errors
- [x] Display the imported match’s player roster
- [x] Display starting player positions for one real competitive round
- [x] Play and pause player movement on a calibrated tactical map
- [x] Scrub player positions forwards and backwards
- [x] Measure first-round load, playback smoothness and seek latency
- [x] Play the first completed round while remaining rounds parse
- [x] Display pending rounds from available metadata
- [x] Discover round boundaries during sequential parsing
- [x] Select any completed round without restarting parsing
- [x] Exclude warmup, knife rounds and abandoned restarts
- [x] Include overtime, freeze time and post-round playback
- [x] Inspect player names, teams, facing and health at the current time
- [x] Show deaths and kills in sync with playback and scrubbing
- [x] Inspect current weapons and ammunition
- [x] Inspect armour and carried grenades
- [x] Inspect player money throughout a round
- [x] Track dropped, carried and planted bomb positions
- [x] Replay bomb plants, defuses and explosions
- [x] Replay grenade trajectories and detonations
- [x] Display approximate smoke areas over time
- [x] Display approximate fire areas over time
- [x] Display bullet traces
- [x] Display flashed-player indicators
- [x] Filter visible players and teams
- [x] Toggle utility overlays
- [x] Replay Dust II fixtures on a calibrated map
- [x] Replay Ancient fixtures on a calibrated map
- [x] Replay Anubis fixtures on a calibrated map
- [x] Replay Cache fixtures on a calibrated map
- [x] Replay Inferno fixtures on a calibrated map with correct rotation
- [x] Replay Mirage fixtures on a calibrated map
- [x] Replay Nuke fixtures with selectable floors while preserving playback position
- [x] Replay Overpass fixtures on a calibrated map
- [x] Replay Train fixtures on a calibrated map
- [x] Replay Vertigo fixtures with selectable floors while preserving playback position
- [x] Explain unsupported maps and unavailable replay data
- [x] Cancel an import and immediately open another demo
- [x] Retry recoverable file reads up to three total attempts
- [x] Retain completed rounds after parsing fails
- [x] Recover gracefully from insufficient browser memory
- [x] Verify playback against older and recent tournament demos

<!-- - [ ] Control playback and inspect players on a phone -->
<!-- - [ ] Scrub the timeline accurately with touch -->
<!-- - [ ] Complete import and replay controls using only a keyboard -->
<!-- - [ ] Expose meaningful replay information to screen readers -->
<!-- - [ ] Keep replay controls usable with zoom and narrow layouts -->
<!-- - [ ] Meet contrast, non-colour cues and flashing requirements -->

- [x] Offer an example match without requiring a local demo
- [x] Benchmark pre-parsed versus live-parsed example loading
- [x] Benchmark optional cached replay loading with Dexie
- [x] Prevent performance regressions with Playwright benchmarks
- [x] Verify sustained playback and memory usage on laptop
- [ ] Verify repeated imports release previous replay resources

<!-- - [ ] Audit the complete replay flow against WCAG 2.1 AA -->

- [ ] Open and refresh replay routes on static hosting
