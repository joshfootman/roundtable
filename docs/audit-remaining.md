# Audit leftovers

Steps 1–5 done. These remain. Short words.

## Load (first round matter most)

`npm run benchmark:first-round` (Fast 4G, cold, Nuke example; `FIRST_ROUND=12` for mid-match link).

Done 2026-10-10: round-1 link 6.7 s → 1.7 s. Round-12 link 7.5 s → 1.6 s. Bytes before Play 7.0 MB → 0.9 MB.
Shared link show loading state, not catalog. Thumbnails AVIF (5.4 MB → 368 kB). Linked round fetched first, rest wait until it plays. Radar, bomb icons, Pixi modules preload while round 1 downloads.

Still left:

- **Round file smaller (done).** RPL4 packs positions, angles, ticks as fixed-point deltas. Round 1 448 → 158 kB. All shipped rounds 173 → 61 MB. Round-1 link 1.7 → 1.4 s. Decode 10 → 12 ms.
- **Work after round lands.** ~0.5–1 s after round 1 arrives: decode ~40 ms, then first GPU composite (~290 ms in headless software GPU), then React render. Measure on real phone before fixing. Possible fix: mount map scene before round arrives, keep it for the round view.
- **Entry bundle big.** Entry chunk 541 kB (171 kB gzip). Effect loads before first paint, because session built in router context. Workspace chunk 458 kB (144 kB gzip) holds Pixi, loads on catalog page that draw no map. Fix: lazy session, lazy `DemoMap`/Pixi. Helps catalog more than first round.
- **Decode on main thread.** Each later round gunzip + SHA-256 + decode ~30–60 ms on main thread. Steals frames while first round plays. Fix: decode in worker, or idle time.
- **Test server no compress.** `serve-static.ts` send JS raw. Real host gzip it.

## Speed

- **Utility redraw every frame.** All utility Graphics cleared, rebuilt each frame. Trajectories rebuilt from sample 0. Colour string parsed per shot per frame. `worldToMap` makes object per point. Fix: benchmark execute window first. Cache geometry by (active ids, floor, scale). Grow trajectory lines, no rebuild. Parse colours once.
- **Cards recount kills every render.** `playerCardsAtTick` walk all earlier rounds' deaths each publish. Two card trees render, one hidden by CSS. Fix: count K/D per round once (`useMemo` on rounds). Render only visible variant.
- **Keydown listener churn.** Window listener removed, added every render (4 Hz playing), because handlers new each render. Fix: `useEffectEvent`.
- **Drawing strokes O(n²).** Each new stroke rebuild every SVG path. `getBoundingClientRect` per pointer sample. Fix: append new stroke only. Cache rect on pointerdown.
- **Parser inventory string keys.** Some per-tick string-keyed lookups remain in CS2 layer. Small now. Look again if parse matter.

## Correct / UX

- **Scores no name for screen reader.** `aria-label` on plain `div`/`span` ignored, digits `aria-hidden`. Fix: sr-only text with number, or `role="group"`.
- **Shortcuts dead on timeline.** Slider focused → K, J, L stop. Scrub leave focus there. Fix: allow non-arrow shortcuts when target is timeline.
- **Canvas keys duplicate.** Canvas handler copies pan/zoom (48 px, ×1.25). Adds `Home` key help not list; help say `R`. Fix: delete canvas handler, keep window shortcuts, fix description. Move constants to `map-camera.ts`.
- **Canvas font not awaited.** Pixi Text made before Geist loads. Cold load may show fallback font forever. Fix: `await document.fonts.load(...)` before renderers.

## Code tidy

- **Same constants many places.** Desktop media query three times (JS twice, CSS once). 2000/3000 ms timeouts must match CSS animation lengths. Fix: share constants, or end on `animationend`.
- **Overlay layout hand-tuned.** Absolute overlays with magic offsets (`top-28`, `calc(100%-200px)`, odd breakpoints). Likely cause of flaky overlap test. Fix: CSS grid with named areas, or shared CSS variables.
- **Dead code.** `setMinimum` only used by tests. `hiddenPlayers`/`hiddenTeams` and utility overlay labels have no UI. Unreachable branches in `DemoWorkspace` (camera reset on map change, `!map`, `<DemoMap>` without round). Fix: delete, or bring filter UI back and fix PROJECT.md.
- **Header schema twice.** Replay header described in Effect Schema and in TypeScript types. Fix: derive one from other.
- **Flaky drawing tests.** `drawing-lifecycle` and `drawing-rendering` fail sometimes under parallel load. Pass alone. Fix: find timing wait.

## Repo

- **`.rpl` in git.** Each regenerate adds ~170 MB history. Fix: host assets outside git (your call).
- **Local junk.** `fixtures/local` (6.7 GB) and `.audit` (214 MB) untracked. Delete if not needed.
