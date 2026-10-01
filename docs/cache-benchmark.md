# Optional replay caching benchmark

Keep the shipped example on HTTP caching. This measurement does not justify adding a production Dexie cache. The whole-match median improved from 570.5 ms on warm HTTP to 521.9 ms on IndexedDB, an 8.5% saving. The first-round median worsened from 6.8 ms to 16.9 ms. The initial database write took 49.8 ms and used 12.6 MB of storage. A 48.6 ms whole-match saving does not earn cache invalidation and quota handling for this example.

Run `npm run benchmark:cache`. It builds the actual application and a separate benchmark module into ignored `dist-cache/`. The normal production entry does not import this module or Dexie. Playwright imports the module identified by Vite's build manifest on the playing application page. The script writes only a unique benchmark database and deletes it in `finally`.

The input is the complete 23-round FaZe versus Vitality Dust II recording from the 2024 Spring Final. Both paths retrieve the same 12,461,681 bytes of gzip round payloads, decompress them and use the production binary decoder. Every decoded number and start tick must match its descriptor. The opening live and end ticks must match the independent reference, 5732 and 8282. This measures retrieval plus decoding. It excludes the production SHA-256 integrity check from both paths.

Three pairs alternate ordering after warming all HTTP assets. Vite preview revalidates cached responses. This is a local warm-cache comparison, not a simulation of an internet download or an immutable CDN cache.

| Pair   | HTTP first round | IndexedDB first round | HTTP all 23 | IndexedDB all 23 |
| ------ | ---------------- | --------------------- | ----------- | ---------------- |
| 1      | 22.5 ms          | 19.9 ms               | 592.5 ms    | 521.3 ms         |
| 2      | 6.8 ms           | 16.9 ms               | 570.5 ms    | 521.9 ms         |
| 3      | 6.7 ms           | 5.6 ms                | 556.2 ms    | 526.8 ms         |
| Median | 6.8 ms           | 16.9 ms               | 570.5 ms    | 521.9 ms         |

The 2026-10-01 run used headless Chromium 153.0.8010.12 on an Apple M2 macOS laptop. This final run had no other application benchmarks active. Results remain exploratory measurements, not performance budgets. An earlier concurrent run produced substantially slower and less consistent timings, so it was not used for this decision. [The complete report](cache-benchmark-results.json) records resource timing, browser identity and browser storage estimates. Each warm HTTP read transferred 6,900 bytes of revalidation overhead. IndexedDB required no HTTP transfer. Browser storage usage rose from zero to 12,566,528 bytes. The estimate is an origin estimate, not a browser memory measurement.

Playback kept one canvas and advanced its recorded position during writes and all paired reads. The requestAnimationFrame observer recorded 214 frames and a maximum 16.8 ms gap over the combined operation. This does not isolate storage cost from decoding, rendering or other laptop activity.

The harness deliberately aborts a real Dexie transaction. Dexie reports `PrematureCommitError` for this transaction callback. The existing replay continues afterward. This verifies isolation from a failed benchmark storage operation. It does not simulate quota exhaustion or establish a production cache recovery policy.

A cache would add eviction, invalidation, quota handling and another integrity boundary. Reconsider it only when a measured offline or repeated local-demo use case warrants that work. A larger cold network saving alone does not establish an advantage over ordinary HTTP caching of the shipped example.
