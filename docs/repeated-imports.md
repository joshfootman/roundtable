# Repeated import resources

Run `npx playwright test --config playwright.lifecycle.config.ts repeated-imports.spec.ts` without another benchmark running.

One page completes five cycles by default. Set `IMPORT_CYCLES=20 HEAP_SNAPSHOTS=1` to repeat the recorded investigation and capture cleared-state heap snapshots after cycles 5 and 20. Each cycle loads all 23 example rounds, replaces them with a recorded Dust II round parsed by a native worker, and cancels the next import before metadata arrives. The test checks that previous round controls and the canvas disappear after cancellation. It also checks that every created parser worker receives termination and that none remains active.

The worker observer delegates to the browser's native Worker. It stores primitive counts and a per-instance termination flag, without retaining workers or replacing their messages.

Chromium CDP captures main-renderer V8 heap and backing storage after forced garbage collection at the baseline and each loaded and cleared state. These measurements exclude worker processes, GPU memory, and browser process memory. The first cycle remains in the report because cached assets can affect later cycles. Repeated cycles do not establish that every long-session leak is absent.

The JSON artifact records the machine, browser, app commit, built index hash, source provenance, and every cycle observation. Deterministic ownership checks fail the test. Memory observations have no arbitrary pass threshold.

## Laptop observation

The recorded follow-up passed 20 cycles on an Apple M2 with 16 GiB RAM and Chromium 153.0.8010.12. The viewport was 1440 × 900. It ran serially, with no concurrent benchmark scheduled. See [the recorded observations](repeated-imports-results.json) for exact environment and build identifiers.

Forty parser workers were created and terminated. Every cleared state had zero active parser workers, no replay canvas, and no prior round controls. Pixi's separate workers are excluded from parser ownership counts.

| Cycle | Cleared V8 heap bytes | Cleared backing storage bytes |
| ----- | --------------------: | ----------------------------: |
| 1     |             8,025,848 |                     1,158,980 |
| 5     |             9,339,236 |                     1,158,980 |
| 10    |             9,716,372 |                     1,158,980 |
| 15    |            10,010,440 |                     1,158,980 |
| 20    |            10,146,256 |                     1,158,980 |

Backing storage stayed constant across all 20 cleared states. V8 heap increased by 2,120,408 bytes from the first cleared cycle to the twentieth. These results verify parser termination and removal of the prior replay view. They do not demonstrate a flat heap.

## Retaining-path investigation

Before the change, heap snapshots from cycles 5 and 20 showed 600 additional objects named `e`. Sampled objects were retained through `CanvasTextMetrics._measurementCache`, its `tiny-lru` items, and the cached measurement's `style`. Pixi's cache holds at most 1,000 measurements. Each new `TextStyle` gets a distinct `styleKey`, so identical inline player label styles produced new measurements on every scene mount.

Player labels now share one unchanged `TextStyle`. Scene teardown removes each label's update listener and releases the label without destroying the shared style. The same object census after the change counted 147 objects named `e` at both cycles 5 and 20. This removes the observed duplicate text measurement retention without clearing library caches.

Residual growth includes compiled code, CDP network bookkeeping, and shader source strings retained by Pixi's global `createIdFromString` table. The shader source strings include successive generated program names. Graphics adaptor teardown destroys its shader and program; retained source strings are distinct from live renderer programs. No private Pixi cache reset was added. The heap totals are separate runs with different JIT activity, so their difference is not a controlled measurement of bytes saved. These observations identify some remaining growth, but do not account for every heap byte or prove that every long-session leak is absent.
