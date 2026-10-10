# Esports broadcast HUD references

Collected 2026-10-10 to guide the replay UX revamp. Frames come from official VODs. They are
kept locally in `.audit/hud-references/` (gitignored) and not committed, because they are
broadcast stills.

| Organiser           | Event                              | Source                                                                                                                |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| BLAST               | Austin Major 2025                  | [skin.club article frame](https://community.skin.club/en/news/tournament-hud-at-blast-major-sparks-wave-of-criticism) |
| BLAST               | Open Rotterdam 2026                | [VOD, 1:30:00](https://www.youtube.com/watch?v=1HAe7cckU-s&t=5400)                                                    |
| ESL (IEM)           | Cologne Major 2026 grand final     | [VOD, 0:40:00 and 1:10:00](https://www.youtube.com/watch?v=p6U28DEBn8A&t=2400)                                        |
| ESL (IEM)           | Katowice 2025 grand final          | [VOD, 0:55:00](https://www.youtube.com/watch?v=ykyKLhnX6lw&t=3300)                                                    |
| ESL                 | Pro League Season 24 quarter-final | [VOD, 0:55:00](https://www.youtube.com/watch?v=LuW2Lg4PA7k&t=3300)                                                    |
| PGL                 | Astana 2026 grand final            | [VOD, 0:55:00](https://www.youtube.com/watch?v=k9E4wwLKXE0&t=3300)                                                    |
| PGL / Perfect World | Shanghai Major 2024 grand final    | [VOD, 0:25:00](https://www.youtube.com/watch?v=29fMfuSf6gA&t=1500)                                                    |
| StarLadder          | Budapest Major 2025 grand final    | [VOD, 0:55:00](https://www.youtube.com/watch?v=9qqiaW7sjD0&t=3300)                                                    |
| CCT (Grid)          | CCT EU #19 grand final             | [Highlights, 0:15:00](https://www.youtube.com/watch?v=dFlqSnL9sgY&t=900)                                              |
| FACEIT              | Streamer League CS2                | [Episode 1](https://www.youtube.com/watch?v=DOAGiMxQ8Pk)                                                              |

FACEIT has no distinct broadcast HUD on YouTube. Its streamer league uses the stock CS2
HUD with a streamer camera, so it is not compared below.

## Per organiser

**BLAST (2025–2026).** Score bar top centre: team logos, scores, `ROUND 13 / 24`, timer. The
timer is replaced by a large red `PLANTED` block with a bomb icon after the plant. Radar
top left with player photo markers. Kill feed top right. All ten players in one bottom
strip, five per side, with the observed player's camera in the middle. Each card shows a
photo, health as a large number, K/D/money (or round damage once dead), and the primary
weapon. Dead players collapse to a short row. The Austin Major kill feed font was widely
criticised as unreadable: condensed type and weak contrast between killer and victim.

**ESL / IEM (2025–2026).** Event and stage label above the score bar. Score bar shows round,
timer and small round-win pips. Map veto strip top left (`MIRAGE ▶ ANUBIS ▶ INFERNO`) with
the picking team's logo. Radar below it with numbered markers. Player columns sit low on
each side, five rows each, under a team name tab. Each row: number, name, K/D, money,
photo, primary weapon icon, health, and small utility, armour and bomb or kit icons. Dead
rows fade, swap the photo for a skull, and drop the weapon. The observed row is outlined.
Pro League is the same system in a different colourway. During a timeout or freeze time,
the bottom becomes a full scoreboard: equipment value, loss bonus, timeouts remaining,
and every player's full inventory and money.

**PGL (Astana 2026, Shanghai Major 2024).** Large score bar with full team names, a
`First to 16` or overtime note, and series pips. Player rows down each side: name, K/D,
money, utility icons, a health bar with armour, and the primary weapon. Team utility
summary cards (`4x smoke 5x flash…`, `HIGH UTILITY`, loss bonus, equipment value) sit
beside the columns. Shanghai adds `POOR UTILITY` / `NO UTILITY` labels and ADR on dead
players. A team-comms quote card appears mid-right during play.

**StarLadder (Budapest Major 2025).** Map list top left with the current map highlighted.
Compact score bar with a `5 vs 5` alive count underneath. Bottom strip of ten tall photo
cards in team colours: weapon icon, health, utility icons, and K/D/money under the name.

**CCT.** Bottom strip of ten photo cards, close to StarLadder's, with health top left and
utility top right. Score bar with team names on coloured bars, the map series beneath, and
`ROUND 3/24`. The radar sits on a dim background with photo markers.

## What every broadcast shows

- **One score bar, top centre.** Both scores, round number, round timer. The bomb state
  replaces the timer after the plant (BLAST's `PLANTED`, PGL's bomb icon in the bar).
- **Ten players always visible, split by team.** Two side columns (ESL, PGL) or one
  bottom strip (BLAST, StarLadder, CCT).
- **Per player:** health first and largest, primary weapon icon, money, K/D, utility
  icons, armour/helmet, bomb or defuse kit.
- **Dead players de-emphasised but still listed:** faded, skull, weapon removed. ESL and
  Shanghai keep money or ADR visible.
- **Team side by colour plus position**, never colour alone: left/right or first/second
  half of the strip.
- **Alive count** somewhere (StarLadder `5 vs 5`, or read from the faded rows).
- **Economy at round start:** equipment value, loss bonus, utility totals (ESL's
  freeze-time scoreboard, PGL's team cards).
- **Series context:** map list or veto strip with results.

## Roundtable today, compared

Roundtable is a 2D replay, so the radar is the main view, not a corner widget. The
broadcast lessons are about the panels around it.

| Element         | Broadcasts                                         | Roundtable now                                 |
| --------------- | -------------------------------------------------- | ---------------------------------------------- |
| Map             | Corner widget, about 15% of the screen             | Centre, but small with a large empty margin    |
| Score bar       | Top centre, compact, timer and bomb state built in | Top centre, large; bomb state not in the bar   |
| Players         | Ten fixed rows or cards, health largest            | Ten cards in side columns that overlap the map |
| Dead players    | Faded, skull, weapon removed                       | Hard to tell apart at a glance                 |
| Equipment icons | Large primary weapon, small utility row            | Small, low-contrast icons                      |
| Alive count     | Shown or obvious                                   | Not shown                                      |
| Economy         | Freeze-time team summary                           | Money per player only                          |
| Series          | Map list or veto strip                             | Not shown                                      |
| Kill feed       | Top right, team-coloured names                     | Present; separate dropdown on mobile           |

## Directions to consider

1. **Side columns that never overlap the map**, ESL/PGL style: five fixed rows per team,
   the map in between, fitted to the remaining space.
2. **Row hierarchy:** health number and bar first, then primary weapon, then money, K/D
   and utility. Dead rows fade with a skull and keep money and ADR.
3. **Score bar carries the round state:** timer, then a plant countdown after the plant,
   alive counts, and series pips.
4. **Freeze-time economy summary:** team equipment value, loss bonus and utility totals
   while frozen, the way ESL swaps in its full scoreboard.
5. **Readable type:** avoid condensed fonts in the kill feed (the BLAST Austin lesson) and
   keep killer and victim in clearly different team colours.
