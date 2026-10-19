# TODO

Done = live product, 50 real users, backend + AI owned, case study published.
POC = timeboxed spike. Output = written yes/no + numbers. Decide before build.

## Epic 0: Scope

- [ ] Pick target user: own-match reviewers OR pro fans
- [ ] Update PROJECT.md: allow backend, accounts, analysis features
- [ ] Update README privacy line: demo stays local, what does leave device

## Epic 1: Finish viewer

- [ ] Ship one player card design, delete unused card variants from /test/cards
- [ ] Add player filter UI
- [ ] Add team filter UI
- [ ] Add utility toggle UI
- [ ] Add playback speed control (0.5x, 1x, 2x, 4x)
- [ ] Add jump to next/previous kill
- [ ] Add jump to bomb plant
- [ ] Add round overview: score, winner, win reason per round
- [ ] Add per-round economy row: team money + buy type
- [ ] Add end-of-match scoreboard: K, D, A, ADR per player
- [ ] Audit WCAG 2.1 AA on import + replay flows, fix failures
- [ ] Test playback on real phone, record model + fps

## Epic 2: Import friction

- [ ] POC: list current demo download formats for Premier, FACEIT, HLTV
- [ ] POC: decompress gz/bz2/zst in worker, measure time + memory on 300MB demo
- [ ] Import compressed demo files in worker
- [ ] POC: fetch demo from Premier share code or FACEIT match URL (legal + CORS + auth)
- [ ] Import demo from match URL (only if POC says yes)
- [ ] Show clear error for unsupported file type, with fix instructions

## Epic 3: Place names

- [ ] POC: decode player last place name from pawn entity
- [ ] Add place name to player tracks
- [ ] Show place name in player card + kill feed
- [ ] Fallback: draw named zones per map (only if POC says no)

## Epic 4: Backend

- [ ] POC: pick host (Fly vs Railway), cost at 0 and 1k users
- [ ] Scaffold API: Node + TypeScript + Hono + Drizzle + Postgres
- [ ] Add CI deploy for API
- [ ] Add magic link sign-in
- [ ] Add object storage for parsed round data
- [ ] Add per-user rate limit
- [ ] Add error tracking (Sentry or equivalent)

## Epic 5: Share links

- [ ] Define share payload: demo id, round, tick, camera, drawings
- [ ] Upload parsed demo data on share (opt-in, signed-in only)
- [ ] Create share link endpoint
- [ ] Open share link without import
- [ ] Add "copy link to this moment" button
- [ ] Add Open Graph preview image per share link
- [ ] Add saved demos list per user
- [ ] Add delete demo + delete account

## Epic 6: Pro demo corpus

- [ ] POC: download + parse 20 HLTV demos via Node CLI, record failures
- [ ] Write ingest script: download, extract, parse, store
- [ ] Ingest 200 pro maps across active duty pool
- [ ] Store round state snapshots in Postgres
- [ ] Document corpus sources + licence notes

## Epic 7: AI feature

- [ ] POC: win probability. Train on corpus, report accuracy on held-out matches
- [ ] POC: lineup recognition. Cluster smokes on 1 map, report % correctly named
- [ ] POC: strategy tagging. Cluster T rounds on 1 map, hand-check 30 rounds
- [ ] Pick one AI feature from POC results, write decision in docs/
- [ ] Build labelled eval set (min 30 cases) for chosen feature
- [ ] Ship model to browser (ONNX or equivalent), measure load size + inference time
- [ ] Ship chosen feature UI in replay view
- [ ] Add eval script to CI, fail on accuracy regression
- [ ] (Stretch) Auto-director: camera + speed driven by win prob swings

## Epic 8: Measure

- [ ] Add PostHog
- [ ] Track funnel: landing, example opened, import started, first round played, share created
- [ ] Track retention: returned within 7 days
- [ ] Add in-app feedback button
- [ ] Build dashboard: weekly users, funnel, retention

## Epic 9: Landing

- [ ] Write one-line pitch for target user
- [ ] Record 20s demo clip
- [ ] Build landing page: pitch, clip, "open example match" button
- [ ] Add 2nd example match from a different map

## Epic 10: Users

- [ ] Post to r/GlobalOffensive
- [ ] Post to r/FACEIT
- [ ] Post to 3 CS2 Discord servers
- [ ] Reach 50 users (PostHog unique, played 1+ round)
- [ ] Interview 5 users, write notes
- [ ] Ship 1 change from interviews, note before/after metric

## Epic 11: Case study

- [ ] Write case study 2: problem, decisions, AI eval numbers, user change, result
- [ ] Record 60s walkthrough video
- [ ] Publish on namtoof.com
- [ ] Link from LinkedIn + CV
