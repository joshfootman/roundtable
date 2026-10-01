# Static hosting

Build with `npm run build` and publish `dist/`. Replay URLs use `/replay?source=example&round=23`; playback ticks stay out of browser history. Opening or refreshing that URL downloads the example progressively and selects round 23 when it arrives.

A local replay URL records the selected round, not the original File. Refreshing asks for the demo again because local files are neither uploaded nor persisted. Selecting the original recording restores the requested round as parsing reaches it.

The host must serve `index.html` for application routes. `public/_redirects` rewrites `/replay` and `/replay/` for hosts that support Netlify-style redirects. Other hosts need their equivalent rewrite. Serve existing assets directly and return 404 for missing assets; returning HTML for missing scripts hides deployment errors.

The correctness suite runs the production build through `scripts/serve-static.ts`, which explicitly implements that fallback. It verifies a nested example replay refresh and missing asset response. Run `node --experimental-transform-types scripts/serve-static.ts` after building to inspect the same local static server; `PORT` defaults to 4173. This script is a verification server, not a production hosting service.
