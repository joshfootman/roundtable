# Agent instructions

## Design system

Tokens live in `src/styles.css`. Tailwind's default palette and radius scale are removed, so `bg-neutral-800` or `rounded-lg` generate nothing. Use the semantic tokens instead; `npm run check:tokens` fails on palette classes.

- Colour by role: `bg-canvas` → `bg-surface` → `bg-inset`/`bg-panel` → `bg-control`, text `text-foreground`/`text-muted`, edges `border-line`/`outline-edge`, focus `outline-focus`. Team and game data use `ct`, `t`, `bomb`, `money`.
- Add a token to `@theme` rather than reaching for a raw colour, radius or easing in markup. Palette primitives in `:root` are for token definitions only.
- Radii are by role: `shell`, `panel`, `field`, `control`, `chip`, `bar`.
- Concentric corners: when a child sits inset inside a rounded parent by less than the parent's radius, give the parent `frame-<radius>` instead of `rounded-<radius>` and the child `rounded-inset-<padding>`. The child's radius becomes the parent's radius minus the inset. `frame-*` publishes its radius through an inherited variable, so only use `rounded-inset-*` where the nearest `frame-*` ancestor is the one the child is inset in.
