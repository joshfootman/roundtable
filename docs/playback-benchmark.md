# Playback baseline

The playback benchmark and its CI gate were removed on 5 October 2026 because frame-image equality was flaky across CI rendering. The measurements below are retained as historical results. Current CI covers lint, types, unit tests and production-browser regression tests.

## Measurement definitions

- First round measures the native form submit event until the canvas exists, Play is enabled, and the next animation-frame callback runs. File chooser time is excluded. This includes worker startup, parsing, buffer transfer, image loading, and scene initialization. It does not measure GPU completion.
- Playback records animation-frame callback gaps for two seconds of actual playback with the canvas scrolled into view. Player coordinates must change. These gaps measure browser presentation scheduling, not GPU frame timings.
- Seek measures a native timeline keydown until two animation-frame callbacks. End and Home update the recorded tick, and Home restores the initial player state. The extra frame allows the previous rendering opportunity to complete. This is a browser-observable estimate, not a display scanout measurement.

No fake clock, CPU throttling, or network throttling is used. These results do not establish CI performance budgets.

## Recorded baseline

Measured on 2026-09-30 with Apple M2, 16 GiB RAM, macOS Darwin 25.3.0, Node v24.11.0, and headless Chromium 153.0.8010.12. The production build used Vite preview.

The original FaZe versus Vitality Dust2 demo is 598,102,502 bytes. Its SHA-256 is `0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4`.

| Viewport        | Run | First round ms | Frame gap p50 ms | Frame gap p95 ms | Maximum gap ms | End seek ms | Home seek ms |
| --------------- | --- | -------------- | ---------------- | ---------------- | -------------- | ----------- | ------------ |
| desktop         | 1   | 1047.8         | 16.7             | 16.7             | 16.8           | 21.4        | 22.3         |
| desktop         | 2   | 881.4          | 16.7             | 16.8             | 16.8           | 20.5        | 28.8         |
| desktop         | 3   | 882.6          | 16.7             | 16.8             | 16.8           | 23.4        | 29.1         |
| mobile-viewport | 1   | 945.6          | 16.7             | 16.7             | 16.8           | 26.0        | 22.2         |
| mobile-viewport | 2   | 865.1          | 16.7             | 16.7             | 16.8           | 25.4        | 21.8         |
| mobile-viewport | 3   | 867.7          | 16.7             | 16.7             | 16.8           | 22.4        | 21.2         |

Desktop uses 1440 × 900 pixels. Mobile viewport uses 375 × 812 pixels with touch and mobile browser emulation on the same laptop. It is not a physical-phone measurement.

The first import in each project starts a fresh browser context. Later imports reuse that context and its browser caches. Every import starts a new parser worker. These measurements cover first-round playback after parsing has stopped. Concurrent parsing and playback need a new baseline after progressive import exists.

## Progressive playback check

After progressive import, all six full-demo benchmark runs began playback while parsing was still active. First-round availability was 839.0–1034.3 ms. Frame-gap p95 remained 16.7–16.8 ms on this laptop. The JSON records `parsingDuringPlayback` for each run. These remain browser scheduling measurements.

## Final sequential-task check

After round selection, eligibility and phase controls, six full-demo imports were
measured again on 30 September 2026 with the same laptop and browser configuration.
All six began playback while parsing remained active.

| Viewport        | First round range, ms | Frame-gap p95 range, ms | Seek range, ms |
| --------------- | --------------------- | ----------------------- | -------------- |
| desktop         | 865.8–1034.7          | 16.7–16.8               | 19.6–33.2      |
| mobile-viewport | 840.5–913.5           | 16.7–16.8               | 19.5–29.3      |

One desktop run had a maximum frame gap of 33.3 ms. All other maximum gaps were
16.8 ms. These are scheduling observations, not physical-phone or GPU frame-rate
claims. Freeze time was disabled for this movement benchmark, matching the initial
baseline. The regression suite separately verifies enabled freeze-time playback.

## Player and utility slice

After utility toggles, six original-demo imports were measured on the same Apple
M2 laptop and Chromium 153 production build on 30 September 2026. Parsing remained
active during every measured playback interval.

| Viewport        | First round range, ms | Frame-gap p95 range, ms | Seek range, ms |
| --------------- | --------------------- | ----------------------- | -------------- |
| desktop         | 1036.8–1165.1         | 16.7–33.4               | 16.8–48.3      |
| mobile-viewport | 1023.5–1063.8         | 16.7                    | 21.1–28.8      |

One desktop run had a maximum frame gap of 83.3 ms. This outlier is retained;
these measurements do not establish a sustained 60 fps guarantee. The benchmark
plays the first two live seconds, before the first grenade flight. Recorded
utility visibility is separately checked through canvas hide/restore assertions
in the regression suite. Mobile emulation remains a viewport check on this
laptop, not a physical-phone performance measurement.

## Retired CI regression gate

The removed gate used three imports of the committed compact Dust II recording at
1440 × 900. It required median first-round availability below 5,000 ms, median
frame-gap p95 below 100 ms and each median seek direction below 250 ms.

On 1 October 2026, the initial Apple M2 run measured a 921.8 ms median first round,
16.8 ms median frame-gap p95 and 20.6 ms forward and 26.2 ms backward median seeks.
A temporary six-second delay on real parser-worker requests made the gate fail;
the delay was then removed. These are historical observations, not current CI checks.
