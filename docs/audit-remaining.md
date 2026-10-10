# Audit leftovers

Steps 1–5 done. These remain. Short words.

## Load (first round matter most)

Measured 2026-10-10, Nuke example, round 1, headless Chromium.

- **First round slow on 4G.** Fast 4G (9 Mbps, 60 ms): Play ready 5.8 s. Round 1 file done at 1.8 s. Rest is waiting on stuff that not round 1.
- **Catalog images load on replay page.** While replay loads, page shows example catalog. Catalog pull map thumbnails (5.4 MB folder, ~0.5 MB each). They fight round 1 for bandwidth. Biggest waste. Fix: no catalog while replay loads, `loading="lazy"`, smaller WebP/AVIF thumbs.
- **Later rounds start too soon.** Round 2+ download right after round 1, before Play ready. Fight radar and icons. Fix: wait until first round playable, or low fetch priority.
- **Pixi waits for round 1.** Pixi init and radar texture start only after round 1 decoded. Could start same time as manifest fetch. Saves round-1 fetch time.
- **Entry bundle big.** Entry chunk 541 kB (171 kB gzip). Effect loads before first paint, because session built in router context. Workspace chunk 458 kB (144 kB gzip) holds Pixi, loads on catalog page that draw no map. Fix: lazy session, lazy `DemoMap`/Pixi.
- **Decode on main thread.** Each round gunzip + SHA-256 + decode ~30–60 ms, main thread, one after other. Fine for round 1. Rounds 2+ steal frames from first playback. Fix: decode in worker, or idle time.
- **GPU wait in test is fake-ish.** Trace show 287 ms `ReadPixels` GPU wait at first draw. Headless uses software GPU (SwiftShader). Measure on real browser before fixing.
- **Test server no compress.** `serve-static.ts` send JS raw (1.3 MB). Real host gzip it. Throttled numbers here worse than prod for JS.

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
