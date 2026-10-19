# Match intro references

Collected 2026-10-12 for a planned demo intro: show the map, both teams and all ten players,
then hand off into the playback layout (player cards, scoreboard, radar). Frames and short
clips are kept locally in `.audit/intro-references/` (git-excluded), with a moodboard at
`.audit/intro-references/index.html`. They are not committed because they are game and
broadcast captures.

The intro must not use portraits, character models or 2D figures. Frames that contain them
were cropped, or the moodboard notes say what to ignore.

| Reference                        | What it shows                                              | Source                                                                            |
| -------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| F1 TV, Monaco GP 2025 build-up   | Globe, 3D circuit with coordinates, stat panel, grid title | [VOD, 0:59](https://www.youtube.com/watch?v=RPep3Qhe3wM&t=59)                     |
| The Finals                       | Tournament bracket, city title card                        | [Gameplay, 0:00](https://www.youtube.com/watch?v=szBKN_4fi5c)                     |
| Tour de France 2026 route reveal | Route drawn as one line over terrain, town flags           | [Official video, 3:37](https://www.youtube.com/watch?v=IPREyLGxDVU&t=217)         |
| Destiny 2, Crucible load-in      | Small wide-tracked map title over flyover                  | [Capture, 0:00](https://www.youtube.com/watch?v=WuZS_DUegz4)                      |
| Marathon, zone select            | Isometric map with a technical side panel                  | [Walkthrough, 12:16](https://www.youtube.com/watch?v=iteU9h8AEtI&t=736)           |
| Marathon, launch trailer         | Wordmark, radar sweep, dot-matrix graphics                 | [Trailer, 0:21](https://www.youtube.com/watch?v=MXhQbF7TlbA&t=21)                 |
| SailGP broadcast                 | AR team labels pinned to boats                             | [CNET feature, 0:24](https://www.youtube.com/watch?v=kN10t8ecOK8&t=24)            |
| Persona 5                        | Drawn city map, menu transitions                           | [Menus, 3:10 and 4:36](https://www.youtube.com/watch?v=QmQZg2990ck&t=190)         |
| Premier League on NOW Sports     | Numbered formation on a flat pitch, team-code wall         | [Line-ups, 1:03](https://www.youtube.com/watch?v=nbIid1aebsE&t=63)                |
| Splatoon 3                       | Match-start nameplates over the map, then the top HUD      | [Gameplay, 0:01](https://www.youtube.com/watch?v=0Ii3TRaMw1Y)                     |
| MotoGP Malaysian GP grid         | Compact grid of race numbers that builds row by row        | [Motorsport.tv, 0:00](https://www.youtube.com/watch?v=BNeLGTOOaJ8)                |
| Need for Speed Unbound           | Repeating type wall behind the selected car                | [Gameplay, 0:30](https://www.youtube.com/watch?v=Wxnf9pgbmIE&t=30)                |
| Spotify Wrapped 2025             | Ranked blocks, single big number, group race               | [Newsroom](https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/) |
| Metaphor: ReFantazio             | Results and bond screens with ink masks                    | [Clip compilation, 0:03](https://www.youtube.com/watch?v=Hi5jpirmHeE&t=3)         |
| Fall Guys                        | Course flyover, then a lower-third round card              | [Gameplay, 0:02](https://www.youtube.com/watch?v=GNYoitdLYBY&t=2)                 |

Looked at and left out: Valorant's loading screen and GeoGuessr Duels (character art and
avatars), F1 TV's starting grid and MotoGP's opening titles (photos), StarCraft II's loading
screen (portraits), EA Sports FC 26 (3D cutscenes), Canal+ Champions League idents (abstract
3D figures), Gran Turismo 7 and TETR.IO (no pre-race or versus screen in the footage found),
and WipEout (HUD only).

## Patterns

- **The map comes first.** It gets a name, a position or coordinates, and two or three
  numbers before any player appears (F1 TV, The Finals, Destiny 2, Marathon).
- **Players are names and numbers in a meaningful place.** Football line-ups put numbers on
  the pitch in formation. SailGP pins labels to boats. Splatoon puts eight nameplates over
  the map. None of these need a face.
- **Each team gets one saturated colour beat.** The team code is repeated as a type wall, or
  the screen floods with the team colour (Premier League, The Finals, NFS Unbound).
- **The intro hands off to the HUD.** MotoGP builds the compact grid while the large cards
  play, and the compact grid is what stays. Splatoon's nameplates become the top-bar icons
  in the same order.
- **Length.** Splatoon's intro is about four seconds. The Finals holds its city card for
  about nine, which drags on repeat viewing. Broadcast sequences (F1 TV, Tour de France)
  run 20 seconds or more and are references for single beats, not for total length.
- **Type and colour.** Every reference pairs a condensed display face with a small mono or
  caps style for data, and uses one field colour at a time. Roundtable's theme has Geist
  only, so an intro in this style needs a deliberate theme addition.

The moodboard ends with three candidate sequences (roll call on the radar, team cards,
broadcast cold open), each with beat timings and the references it draws from.
