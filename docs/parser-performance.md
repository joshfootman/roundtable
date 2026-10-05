# Parser performance measurements

The parser retains the existing replay output and public decoder methods. Three changes reduce work during local `.dem` imports.

- `BitReader.float()` reuses a reader-owned DataView. Unaligned `bytes()` fills one output array directly.
- `resolveField()` caches successful static bindings in a numeric path trie keyed by serializer identity. Polymorphic selectors and their descendants remain uncached.
- The entity decoder classifies entities once after a packet changes them. Player, bomb, projectile, fire, smoke, and game-rule queries reuse those collections.

The projection preserves entity insertion order, active filtering, full pawn-handle checks, and query-specific validation. It expires before the next accepted entity packet mutates state. The smoke Set belongs to that projection. Its replay tracker consumer only reads it.

## Measurement method

`scripts/benchmark-parser.ts` runs the actual Effect replay stream in Node. Each fixture receives one warmup per parser version. Three paired runs alternate version order. The report contains every observation, median durations, selected parser source hashes, and replay output fingerprints.

The compact Dust II fixture stops after four completed rounds. The recent Anubis fixture stops after one. Both fixtures end during the next partial round. Full raw recordings run to the end of the stream.

Gzip fixtures expand before timing. Round serialization and hashing time is subtracted from the durations. Those operations still allocate memory and can affect garbage collection. Node measurements describe this harness, rather than browser import latency.

Every baseline and candidate run must produce the same SHA-256 over replay events and encoded rounds. A changed fingerprint or round count fails the command.

The command accepts these options.

| Option                    | Meaning                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ |
| `--baseline <directory>`  | Saved parser directory containing `round.ts`.                                  |
| `--candidate <directory>` | Candidate parser directory. The default is `src/demo`.                         |
| `--runs <count>`          | Paired measured repetitions. The default is three.                             |
| `--output <path>`         | JSON report path.                                                              |
| `--verify-only`           | One full output comparison per version without warmup. Timings are diagnostic. |
| Positional paths          | Raw `.dem` recordings or the known compact gzip fixtures.                      |

Saved parser directories retain their relative generated-schema and replay imports. Node must be able to resolve the project dependencies from those directories.

The default command uses the committed compact fixtures.

```sh
node --experimental-transform-types scripts/benchmark-parser.ts
```

The baseline and intermediate parser snapshots for this run remain under the ignored `test-results/parser-performance/` directory.

```sh
node --experimental-transform-types scripts/benchmark-parser.ts \
	--baseline test-results/parser-performance/baseline/src/demo \
	--output test-results/parser-performance/combined.json
```

## Recorded comparison

Measured on 2 October 2026 with Apple M2, 16 GiB RAM, Darwin 25.3.0, and Node v24.21.0. Each value is the median of three observations. All Node version pairs produced identical replay fingerprints.

| Compact Node fixture     | Original parser, ms | Optimized parser, ms | Parse-time reduction |
| ------------------------ | ------------------: | -------------------: | -------------------: |
| Dust II, four rounds     |             3,126.1 |              1,868.8 |                40.2% |
| Recent Anubis, one round |             1,332.7 |                944.0 |                29.2% |

Separate checkpoints measured the reader change at 18.6% and 8.2% lower parse time. Static binding caching reduced the reader-only durations by 9.0% and 18.2%. The shared projection reduced the cache-only durations by 13.6% and 8.2%. These checkpoints used separate paired runs. Their percentages do not add to the combined result.

The production-browser comparison used headless Chromium 153.0.8010.12 at 1440 × 900. The full Dust II source was 598,102,502 bytes. Its SHA-256 was `0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4`.

| Production-browser measure                             | Before, ms | After, ms | Time reduction |
| ------------------------------------------------------ | ---------: | --------: | -------------: |
| Local import to first playable round                   |    1,040.1 |     864.2 |          16.9% |
| Live example download finished to first playable round |    1,113.8 |     888.5 |          20.2% |
| Live example download finished to all 23 rounds        |   20,624.7 |  11,959.3 |          42.0% |

The loading benchmark used fresh browser contexts and alternated pre-parsed and live-parsed observations. Its pre-parsed example control reached all rounds in 822.5 ms before and 812.4 ms after. The compressed example implementation did not change.

All local-import playback observations ran while parsing remained active. Frame-gap p95 stayed at 16.7 to 16.8 ms. These measure browser scheduling and DOM readiness on this laptop. They do not measure GPU completion or physical-phone performance.

[Recorded results](parser-performance-results.json) retain observations, source hashes, and verification counts. Full logs and parser snapshots remain under `test-results/parser-performance/`.

## Output verification

All 83 unit tests pass. The seven new entity packet-sequence tests also pass against the original decoder. They cover deletion, reactivation, serial replacement, staged packets, insertion order, smoke visibility, and query-specific errors.

All 281 completed rounds from twelve full recordings produce identical replay-event and round-buffer fingerprints. The recordings cover ten maps, older and recent demos, and overtime.

Independent map references pass for all 281 rounds. Dust II's detailed event references and the 23 shipped compressed rounds also pass. All ten production-browser regressions pass, including import cancellation, replacement, progressive selection, playback, and example loading. Lint, formatting, and TypeScript checks pass.

The post-change full Dust II verification CPU profile is saved as `test-results/parser-performance/post-fix.cpuprofile`. Its sampled durations include verification work. The paired Node and browser observations above provide the performance comparison.

## Design choices

Model the Domain shaped the numeric path trie and explicit entity collections. Foundational Thinking kept scratch storage with its reader and projection state with its decoder. Laziness Protocol and Minimize Reader Load kept decoder APIs unchanged and avoided persistent entity indexes. Boundary Discipline preserved wire-data validation at its existing boundaries. Sequence Work into Verifiable Units required a measured checkpoint after each change. Test Behavior, Not Implementation required literal scalar values and public packet sequences. Prove It Works required complete recording comparisons and production-browser measurements.

Independent design and code reviews used GPT-6.1-Sol, the same model as the implementation. They are independent attempts, rather than reviews from a different model family.
