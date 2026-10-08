# Remaining work

## Checklist

- [x] Responsive phone experience, first pass.
- [x] Clear round outcomes.
- [x] Combined floor view.
- [x] Direct round selection.
- [x] Dropped weapons / utility
- [x] Team identity.
- [x] Change side / halftime UI
- [x] Manual zoom and pan.
- [x] Playback shortcuts.
- [x] Team winning streaks, optional polish.
- [ ] Rapid multi-kill feedback, optional polish.
- [x] Client-side drawing.
- [ ] Settings UI, conditional.
- [x] Reduce test maintenance burden.
- [ ] Shared viewing and drawing, deferred.
- [ ] Accurate player visibility, deferred.
- [ ] Optional colour palettes, conditional.
- [ ] Display filters.
- [ ] Player selection.
- [ ] Custom key remapping, deferred.

## Scope and priorities

Ranked by value to a frontend/design engineering portfolio. The primary visitor is a curious visitor or CS fan exploring a match without instructions. Interaction quality, visual craft, accessibility and responsive design lead. Items describe agreed scope; the checklist records implementation progress. [PROJECT.md](PROJECT.md) still defines release requirements.

The responsive first pass uses controls around the map and an initially expanded native Players disclosure on phones and tablets. Visitors can collapse the player details. Short landscape viewports place controls beside the map. Browser checks cover import, playback, disclosure and resizing; real-phone validation and further design review remain. The filter panel is separate outstanding work.

This is a value ranking, not an implementation sequence. Accessibility applies to the complete experience, including the tactical view; it is not conditional on adding a palette setting.

Floor switching now uses a compact map-controls row with a stacked-floors icon that shows the current floor and toggles Upper and Lower. Keep this action one click when adding the future filter panel. The combined floor task is complete with the current approach. Overlaying both radar textures is optional future polish; the other display filters remain outstanding.

## Core experience, ranked

1. **Responsive phone experience.** Build a map-first layout for quick watching and exploration. Keep player details and filters available on demand rather than permanently occupying map space. Preserve desktop, tablet and phone support across touch and keyboard-accessible controls. This has the broadest effect on the first impression.
2. **Clear round outcomes.** Briefly announce the winner in the centre at the recorded round result and immediately update the score. Use the recorded team name, such as "FAZE WON", when available; otherwise use "COUNTER-TERRORISTS WON" or "TERRORISTS WON". Show the recorded MVP below the headline when available. Seeking before the result restores the earlier score. This addresses the reported unclear outcome and unchanged score.
3. **Combined floor view, complete.** Keep all players visible while showing the selected floor radar. Players on the other floor use quieter hollow markers and directional double chevrons. A stacked-floors icon toggles Upper and Lower with one click without changing playback. Utility and world bomb markers follow the selected floor. This addresses the difficulty following action with split floors. Overlaying both radar textures can be revisited as optional polish.
4. **Player selection.** Clicking players builds a visible group, such as the two AWPers. Highlight selected players and hide unselected players; preserve dimming for deaths. Clicking a selected player removes them. Zero selections shows everyone. Include a "Show all" reset. Revisit after testing. This gives visitors a direct way to focus on players they care about.
5. **Direct round selection.** Clicking the round number opens a compact picker with each available round's number, winner and score. Reveal results without preserving suspense. Grow the list as completed rounds arrive during parsing. Selecting a round jumps directly to it. This removes repeated next-round clicks.
6. **Display filters.** Add a compact panel for team visibility, smoke, fire, grenade paths and shot traces. Player selection uses the click-to-select filter. Define how team toggles combine with player selection before implementation. This lets visitors reduce clutter.
7. **Team identity, complete.** The central HUD shows recorded team names and curated example logos. Names follow the active round's sides and fall back to CT/T. Local imports use recorded names without inferred logos. Player cards omit team-name headers because the HUD already provides that context.
8. **Manual zoom and pan.** Use geospatial map interactions. Drag to pan; wheel or pinch to zoom. Include visible zoom controls, keyboard access and a full-map reset. No automatic player following in the first draft. This helps inspect local action.
9. **Playback shortcuts.** Use YouTube-style defaults. K/Space toggle play/pause. J/L seek backward/forward 10 seconds. Left/right arrows select previous/next round; the focused seek bar keeps native arrow behaviour. F changes floor, R recentres, +/- zoom, and 0–9 seek to 0–90% of the round. Shift+arrows pan. ? opens shortcut help. Preserve native control behaviour and make shortcuts discoverable. This adds keyboard convenience. [YouTube reference](https://support.google.com/youtube/answer/7631406?hl=en).

## Optional polish, ranked

1. **Team winning streaks.** Add a flame for consecutive round wins. Five consecutive recorded wins activate blue CT or orange T score flames. Streaks follow teams across side swaps and reconstruct when seeking. Reduced motion and unavailable WebGL use static flames.
2. **Rapid multi-kill feedback.** Consider separate player feedback for several kills in quick succession. Appearance and timing threshold remain open. Do not use a flame.

## Conditional additions

- **Optional colour palettes.** Offer game-style team palettes only if testing shows value over the default CT/T colours, #96c8fa and #eabe54. Check map backgrounds and death dimming with colour-vision simulations and user testing where available. Do not assume CS2-style colours establish accessibility. Preserve non-colour identification.
- **Client-side drawing, complete.** Use perfect-freehand for desktop white strokes with subtle pressure variation. Draw toggles drawing mode and Clear map removes drawings. Colour settings are deferred. D toggles drawing; Shift+D clears the current round and floor. Drawings follow map pan and zoom, survive seeking and round navigation, and reset on a new demo. They stay in memory without export or shared editing.
- **Settings UI.** Its scope depends on which optional settings earn a place. No additional settings are defined yet. Key remapping is deferred.

## Maintenance

- **Reduce test maintenance burden, complete.** Reduced the unit suite from 333 to 124 cases by removing duplicate matrices, repeated fixtures and implementation assertions, and merging related replay transitions. Independent real-demo comparisons, parser failure boundaries, renderer lifecycles and all-map opening pan checks remain. Both suites detected nine deliberately introduced faults in an isolated copy. Prefer independent expected results and consequential behaviour over allocation details or fixed styling values when adding tests.

## Deferred

- **Shared viewing and drawing.** Retain for a potential commercial product. Revisit hosting costs and pricing before expanding release scope.
- **Accurate player visibility.** Intended use is checking whether a player looked at a corner. Approximate or decorative cones are unacceptable. Assess feasibility before expanding PROJECT.md's visibility scope. Implementation difficulty remains unconfirmed.
- **Custom key remapping.** Use familiar YouTube-style defaults for the first release.

The refreshed example-demo UI is complete per the scope review and has been removed from outstanding work.

The central HUD now shows recorded clan names with curated example logos, CT/T
fallbacks, the clock, round number and previous/next controls. Its round picker shows
available completed rounds and grows as parsing progresses. A small Halftime divider
marks the recorded regulation side swap. Team identity stays
in the HUD without repeated names above the player cards.
