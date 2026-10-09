# Roundtable

Roundtable is a browser-based Counter-Strike 2 demo viewer. Open a local `.dem`
file, inspect its recording metadata and player roster, and replay recorded player
movement on a 2D tactical map. Demo files stay on your device; parsing runs locally
in a Web Worker, with no upload or parsing server.

The project combines a custom TypeScript Source 2 decoder with Effect for file
reads and import lifecycle management, PixiJS for tactical playback, and React,
TanStack Router, Vite and Tailwind CSS for the interface.

## Development

```bash
npm run check                    # Lint, formatting, route generation and TypeScript checks
npm test                         # Unit tests
npx playwright install chromium  # Install the test browser once
npm run test:e2e                 # Build and run Chromium browser tests
```

Playwright starts its own production preview server on port 4173. Full-demo
verification commands require the local reference recording described in the
[fixture guide](fixtures/README.md).

## Credits and inspiration

- [demoinfocs-golang](https://github.com/markus-wa/demoinfocs-golang): the TypeScript
  entity decoder adapts Source 2 bit encodings, field-path operations and
  quantized-float algorithms from its v4.5.1 `sendtables2` implementation. It also
  serves as an independent verification oracle. The upstream MIT copyright and
  licence are preserved in [the decoder notice](src/demo/entities/NOTICE.md).
  That implementation credits the earlier [dotabuff/manta](https://github.com/dotabuff/manta) decoder.
- [SteamTracking/Protobufs](https://github.com/SteamTracking/Protobufs): upstream
  demo and network-message schemas. Some replay schemas come from
  demoinfocs-golang; pinned sources and adaptations are documented in
  [the schema guide](schemas/README.md).
- [Valve](https://www.counter-strike.net/cs2): Counter-Strike 2 and its map/radar
  artwork. Map calibration uses extracted Valve overview data published by
  [MurkyYT/cs2-map-icons](https://github.com/MurkyYT/cs2-map-icons); see the
  [calibration notes](src/replay/README.md) for the supplied images and transforms.
- [Juknum/counter-strike-icons](https://github.com/Juknum/counter-strike-icons):
  extracted Valve CS2 equipment and kill-feed SVGs used by the kill feed and map.
  The pinned source and upstream asset terms are documented in
  [the icon asset guide](src/assets/cs2/README.md).
- [demoparser](https://github.com/LaihoE/demoparser),
  [demofile-net](https://github.com/saul/demofile-net) and
  [cs2parser](https://github.com/osztenkurden/cs2parser): additional parser
  references and inspiration documented in the project plan.

The application runs its own TypeScript parser. The reference parsers above are
used for research and verification.
