# Sustained laptop playback

Run `npm run benchmark:sustained` on the laptop being assessed. Set `BENCHMARK_CONTEXT` to describe other workloads. The opt-in Chromium benchmark builds the production app and serves it on port 4188. It imports the complete 23-round example before sampling. It selects Dust II round 2, whose live interval exceeds a minute, then plays at normal speed for at least 60 seconds without fake clocks or CPU/network throttling.

The attached `sustained-playback.json` records source SHA-256, application commit, hardware, browser, viewport, native requestAnimationFrame gaps, recorded tick advancement and memory samples. The check also requires changed recorded player positions, working forward/backward seeks and all utility overlay checkboxes responding after playback. Control response timings include Playwright transport and polling overhead. They are observations, not frame-render latency.

Memory is sampled through Chromium CDP `Runtime.getHeapUsage` every five seconds. A forced collection precedes the baseline and follows the control checks. Reported backing storage and embedder memory are retained when Chromium supplies those fields. These measurements cover the main renderer, not workers, GPU allocations or whole-browser/process memory. Forced collection changes normal GC behaviour. A minute of playback does not prove absence of long-session leaks.

This benchmark records observations rather than imposing hardware-dependent thresholds. Run with other benchmark processes stopped when collecting an isolated baseline. Headless desktop Chromium on a laptop does not establish physical phone or other-browser performance.

## Recorded laptop check

On 1 October 2026, the Apple M2 laptop with 16 GiB RAM and Chromium
153.0.8010.12 played round 2 for 60,008.2 ms. The observer recorded 3,550 frames.
Frame-gap p50 was 16.7 ms, p95 was 16.8 ms and the maximum was 199.9 ms.
The maximum is retained and does not support an uninterrupted 60 fps claim.
Recorded ticks advanced from 9562 to 13414. Player coordinates changed.
Forward and backward controls responded in 35.7 ms and 7.6 ms, and all six
utility switches responded after playback.

Renderer V8 heap was 12.64 MB after the initial forced collection, peaked at
20.58 MB in the five-second samples and was 13.97 MB after the final collection
and control checks. Reported backing storage changed from 50.63 MB to 50.76 MB.
No other application benchmarks were active. Ordinary desktop activity was not
controlled. [The complete report](sustained-playback-results.json) retains all
samples, source and build identities. These observations do not establish a
whole-browser memory budget or prove that every resource is released.
