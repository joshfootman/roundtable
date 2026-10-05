# Remaining work

## Checklist

- [x] Responsive phone experience, first pass.
- [ ] Clear round outcomes.
- [ ] Combined floor view.
- [ ] Player selection.
- [ ] Direct round selection.
- [ ] Display filters.
- [ ] Team identity.
- [ ] Manual zoom and pan.
- [ ] Playback shortcuts.
- [ ] Team winning streaks, optional polish.
- [ ] Rapid multi-kill feedback, optional polish.
- [ ] Optional colour palettes, conditional.
- [ ] Client-side drawing, conditional.
- [ ] Settings UI, conditional.
- [ ] Reduce test maintenance burden.
- [ ] Shared viewing and drawing, deferred.
- [ ] Accurate player visibility, deferred.
- [ ] Custom key remapping, deferred.

## Scope and priorities

Ranked by value to a frontend/design engineering portfolio. The primary visitor is a curious visitor or CS fan exploring a match without instructions. Interaction quality, visual craft, accessibility and responsive design lead. Items describe agreed scope; the checklist records implementation progress. [PROJECT.md](PROJECT.md) still defines release requirements.

The responsive first pass uses controls around the map and an initially expanded native Players disclosure on phones and tablets. Visitors can collapse the player details. Short landscape viewports place controls beside the map. Browser checks cover import, playback, disclosure and resizing; real-phone validation and further design review remain. The filter panel is separate outstanding work.

This is a value ranking, not an implementation sequence. Accessibility applies to the complete experience, including the tactical view; it is not conditional on adding a palette setting.

## Core experience, ranked

1. **Responsive phone experience.** Build a map-first layout for quick watching and exploration. Keep player details and filters available on demand rather than permanently occupying map space. Preserve desktop, tablet and phone support across touch and keyboard-accessible controls. This has the broadest effect on the first impression.
2. **Clear round outcomes.** Briefly announce the winner in the centre at the recorded round result and immediately update the score. Use the recorded team name, such as "FAZE WIN", when available; otherwise use "COUNTER TERRORISTS WIN" or "TERRORISTS WIN". Seeking before the result restores the earlier score. This addresses the reported unclear outcome and unchanged score.
3. **Combined floor view.** Define the primary floor in map reference data by largest surface area. Nuke and Vertigo use upper. Overlay both floors and keep all players visible. Primary-floor players have no chevron; players above or below it have an up or down chevron. Treatment of utility and the bomb remains open. This addresses the reported difficulty following action with split floors.
4. **Player selection.** Clicking players builds a visible group, such as the two AWPers. Highlight selected players and hide unselected players; preserve dimming for deaths. Clicking a selected player removes them. Zero selections shows everyone. Include a "Show all" reset. Revisit after testing. This gives visitors a direct way to focus on players they care about.
5. **Direct round selection.** Clicking the round number opens a compact picker with each available round's number, winner and score. Reveal results without preserving suspense. Grow the list as completed rounds arrive during parsing. Selecting a round jumps directly to it. This removes repeated next-round clicks.
6. **Display filters.** Add a compact panel for team visibility, smoke, fire, grenade paths and shot traces. Player selection uses the click-to-select filter. Define how team toggles combine with player selection before implementation. This lets visitors reduce clutter.
7. **Team identity.** Read recorded team names. Proposed layout puts the full name above the first player card in each team column. Curated example logos replace CT/T in the score display, with accessible team-name labels. Local imports retain compact CT/T score labels and use recorded names in team headers, with CT/T fallbacks. Do not infer logos from clan names. Check long names and phone placement. This adds match context without squeezing names into the score display.
8. **Manual zoom and pan.** Use geospatial map interactions. Drag to pan; wheel or pinch to zoom. Include visible zoom controls, keyboard access and a full-map reset. No automatic player following in the first draft. This helps inspect local action.
9. **Playback shortcuts.** Use YouTube-style defaults. K toggles play/pause. J/L seek backward/forward 10 seconds. Left/right arrows on the seek bar seek 5 seconds. Space toggles play/pause when the seek bar has focus. Preserve native control behaviour and make shortcuts discoverable. This adds keyboard convenience. [YouTube reference](https://support.google.com/youtube/answer/7631406?hl=en).

## Optional polish, ranked

1. **Team winning streaks.** Add a flame for consecutive round wins. Five or more wins is the initial threshold idea, pending confirmation. Clear round outcomes take priority.
2. **Rapid multi-kill feedback.** Consider separate player feedback for several kills in quick succession. Appearance and timing threshold remain open. Do not use a flame.

## Conditional additions

- **Optional colour palettes.** Offer game-style team palettes only if testing shows value over the default CT/T colours, #96c8fa and #eabe54. Check map backgrounds and death dimming with colour-vision simulations and user testing where available. Do not assume CS2-style colours establish accessibility. Preserve non-colour identification.
- **Client-side drawing.** Trial integration before committing. Assess tldraw licensing, a minimal toolbar, touch input, map alignment and playback control conflicts. Annotations remain excluded by PROJECT.md until this decision changes. [tldraw licensing](https://tldraw.dev/community/license).
- **Settings UI.** Its scope depends on which optional settings earn a place. No additional settings are defined yet. Key remapping is deferred.

## Maintenance

- **Reduce test maintenance burden.** Audit tests rather than targeting a count. Retain tests that protect consequential regressions. Remove duplicated coverage and brittle implementation assertions. Preserve independent comparisons against real demos. This is separate from the visitor-facing ranking.

## Deferred

- **Shared viewing and drawing.** Retain for a potential commercial product. Revisit hosting costs and pricing before expanding release scope.
- **Accurate player visibility.** Intended use is checking whether a player looked at a corner. Approximate or decorative cones are unacceptable. Assess feasibility before expanding PROJECT.md's visibility scope. Implementation difficulty remains unconfirmed.
- **Custom key remapping.** Use familiar YouTube-style defaults for the first release.

The refreshed example-demo UI is complete per the scope review and has been removed from outstanding work.
