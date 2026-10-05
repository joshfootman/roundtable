# UI consistency audit

The audit covers all product-owned DOM components, global and responsive CSS, and map-renderer styling. The catalog and replay use the same workspace. Third-party development tools and colors inside map images and team-logo assets are outside the styling scope.

## Corrections

| Property               | Before                                                                    | After                                                      |
| ---------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Mobile content gutter  | Catalog 16px, replay 8px                                                  | Both use `demo-content`, 8px on mobile and 16px on desktop |
| Playback panel radius  | 12px outside an 8px button with 8px padding                               | 16px outer radius                                          |
| Player details radius  | 12px outside 8px cards with 8px padding                                   | 16px outer and summary radius                              |
| Disabled hover         | Navigation uses a separate dark fill; floor and play controls still react | Hover fills apply only to enabled controls                 |
| Error panel background | Stone palette in an otherwise neutral interface                           | Neutral-800, retaining red error text                      |
| Focus outline offset   | Example cards 3px, controls 2px                                           | Both 2px                                                   |
| Map player number font | Generic sans-serif                                                        | Geist Variable with sans-serif fallback                    |

## Coverage and retained choices

| Visual property                  | Source assessment                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background and foreground colors | Scoreboard neutral tiles, player cards, playback panel, and inactive floor buttons already share `bg-neutral-700/50`. Shell neutral-800, stage neutral-900/50, and page neutral-900 retain depth.                         |
| State and semantic colors        | CT and T use shared tokens in DOM and canvas. Money, import states, utility types, selected floors, and dead players retain their distinct colors and opacity.                                                            |
| Radii                            | Shell24 minus mobile inset8 equals stage16. Desktop shell32 minus inset16 equals stage16. Compact badges, health tracks, circular map markers, and timeline thumbs have distinct shapes.                                  |
| Typography                       | Geist is the UI family. Root tabular numbers and antialiasing are set. Headings, body text, metadata, scores, and compact statistics retain different sizes and weights.                                                  |
| Spacing and density              | Main gutters now match. Local 4px, 8px, 12px, and 16px gaps reflect density and grouping. Catalog content has more space than compact replay controls.                                                                    |
| Dimensions and hit areas         | Navigation and playback buttons are 44px. Floor buttons and upload controls have a 44px minimum height. Timeline has a 44px input area and larger coarse-pointer thumbs.                                                  |
| Alignment                        | Team cards deliberately mirror. Scores and elapsed time use a grid. Playback and map placement change by viewport size. Optical icon centering still needs rendered inspection.                                           |
| Borders, outlines, and shadows   | Product panels use fills without decorative shadows or borders. Map thumbnails have a consistent inset white 10% outline. Focus uses a 2px mauve outline.                                                                 |
| Icons and imagery                | Navigation and playback icons are 20px. Primary weapons, secondary weapons, utility icons, team logos, and map images keep role-specific sizes and aspect ratios.                                                         |
| Wrapping and overflow            | Names and filenames truncate. Player statistics wrap. Error text can break anywhere. Player lists scroll on desktop; catalog scrolls within the shell.                                                                    |
| Interaction states               | Selected floor, hover, keyboard focus, loading, errors, success, disabled, and dead-player states are represented. Disabled hover is corrected.                                                                           |
| Motion                           | Source uses explicit transition properties and reduced-motion variants. Import travel animation runs only while loading. Timing differs by purpose, not equivalent instances. Perceived timing was not visually assessed. |
| Responsive layout                | Phone and tablet controls remain in flow. Desktop controls and players overlay the map at the shared 16px inset. Short landscape layouts place the map beside controls. Safe-area insets are respected.                   |
| Canvas styling                   | Team, foreground, and background colors come from CSS tokens. Marker and trajectory widths scale to screen size. Utility colors carry game meaning rather than panel hierarchy.                                           |

## Evidence and limits

Source review identifies the corrections above. The six existing Chromium end-to-end tests cover imports, catalog playback, keyboard controls, responsive map placement, overflow, and player-panel behavior. Lint, formatting, and TypeScript checks passed. The initial browser suite passed all six tests. After the styling edits, five passed and the responsive test failed its map-overlap assertion during viewport resizing. The isolated responsive test then passed. This intermittent failure remains open; its cause is not proven.

The collaborative preview timed out on open, status, and navigation attempts. Rendered optical alignment, actual color contrast over map imagery, clipping, font loading in canvas, and perceived motion remain unverified. Passing functional browser tests is not a pixel or visual parity verdict. Translucent backgrounds can look different over different underlying content even when their CSS values match.
