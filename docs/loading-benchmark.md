# Example loading benchmark

`npm run benchmark:loading` compares the shipped pre-parsed example with live parsing of the same complete Dust II recording. Keep the original demo at `fixtures/local/faze-vs-vitality-m2-dust2.dem`, or set `DEMO_PATH` to that recording. The benchmark checks its SHA-256 against the example manifest before running.

The production build runs on port 4176. A separate fixture server streams the ignored raw demo from disk on port 4177. It never copies the raw file into the build. Both servers stop when Playwright exits.

Three pairs alternate loading order. Each observation uses a fresh browser context with empty browser caches and a desktop viewport. The pre-parsed observation opens `/replay?source=example&round=1`. The live observation downloads the raw file, constructs a browser `File`, and changes the file chooser to begin automatic import. Both must finish with a successful import indicator and a playable canvas. After capturing timings, the benchmark uses **Next round** to visit all 23 rounds and checks that navigation stops at round 23. No worker or parser is mocked.

`test-results/loading/` contains `loading-comparison.json` with every observation, hardware, browser, source hash, source bytes, archive compressed bytes and build mode. The file is also attached to the Playwright result.

First playable measures from example document initialization or the start of the raw download until **Play round** is enabled. All rounds measures until the production import indicator reports success. Example timing includes application startup after document initialization. Live timing begins after the home page is ready. Live measurements also report download duration and both durations after the download finishes. Pre-parsed download and decode overlap, so its download duration is not reported separately. Resource bytes count encoded response bodies for the manifest, round archives or raw recording. They exclude HTTP headers and map imagery.

The browser observer records DOM readiness, not GPU completion. The fixture server permits Resource Timing measurements across origins. There is no CPU or network throttling. Local loopback download speed does not represent an internet connection, and these observations do not establish a CI performance budget.

## Historical comparison

These results use the earlier home interface and its example-button timing. The current benchmark uses route loading and automatic file import, so its timing boundaries differ.

Measured on 1 October 2026 with Apple M2, 16 GiB RAM, Darwin 25.3.0, Node v24.11.0 and headless Chromium 153.0.8010.12 at 1440 × 900. Each value below is the median of three fresh contexts.

| Loading mode | First playable, ms | All 23 rounds, ms | Raw download, ms | First after download, ms | All after download, ms | Encoded response bodies, bytes |
| ------------ | -----------------: | ----------------: | ---------------: | -----------------------: | ---------------------: | -----------------------------: |
| Pre-parsed   |              355.3 |             799.3 |              N/A |                      N/A |                    N/A |                     12,227,000 |
| Live-parsed  |            1,571.0 |          20,315.2 |            399.7 |                  1,126.8 |               19,804.8 |                    598,102,502 |

The raw source SHA-256 is `0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4`. The stored compressed round archives total 12,461,681 bytes. Resource Timing records 12,467,747 decoded response-body bytes for all 23 archives and the manifest, and 12,227,000 encoded bytes after HTTP compression. The artifact keeps each response's encoded and decoded sizes so transport compression remains visible.

The tested production index SHA-256 is `ded8253c7f5fec28aa9da2d625d78923c35f35a72a9e69a966ebbc3048ab276d`. These local measurements support shipping the pre-parsed example. They do not predict downloads over a customer's network.
