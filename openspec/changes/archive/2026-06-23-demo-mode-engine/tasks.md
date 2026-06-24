## 1. Season-aware dream-team builder

- [x] 1.1 New `lib/demo/squad.ts`: `deriveDemoSeason(events)` (calendar-based: live iff an unfinished GW with a future deadline exists — NOT `ep_next` presence, which is stale in the summer feed) + `buildDemoSquad(players, season)` → a `PicksResponse`-shaped synthetic squad + the `season` flag
- [x] 1.2 Season-aware metric: rank by `ep_next` in a live season (guarded — fall back to points if `ep_next` isn't populated yet, pre-season); otherwise by `totalPoints` (tie-break `pointsPerGame`)
- [x] 1.3 Greedy budget-valid fill: enforce 2-5-5-3, ≤ £100.0m, ≤ 3 per club; reserve cheap enabler slots, then fill by metric-per-£; clamp to a valid squad if the greedy pass stalls
- [x] 1.4 Designate starting XI (legal formation: ≥1 GK, ≥3 DEF, ≥1 FWD), bench (slots 12–15), captain + vice (top-metric starters); `entry_history.bank = 0`
- [x] 1.5 Keep it a pure/deterministic function of the bootstrap snapshot
- [x] 1.6 Unit tests: `deriveDemoSeason` (summer break → offseason, mid/next/pre-season → live), shape, budget, 3-per-club, formation legality, and both metric branches (ep vs points)

## 2. Demo analysis context

- [x] 2.1 `lib/plan/context.ts`: `buildDemoContext()` — bootstrap + fixtures + `buildDemoSquad`, score the 15 via the existing scorers, `rankSquad` + `identifyWeakest3` (no transfer targets)
- [x] 2.2 Stub `managerProfile`: placeholder entry (`name: "Demo Squad"`, `summaryOverallRank: null`), empty `chipsRemaining` (all zero), neutral `riskProfile`/`transferPatterns`/`history`; normal `gwFlags`
- [x] 2.3 `getCachedDemoContext()` — same TTL pattern, keyed on a demo sentinel; must not collide with a real manager's cache entry
- [x] 2.4 Verify the demo path makes no `fetchPicks` / `buildManagerProfile` call

## 3. Demo plan (base + captaincy-only insights)

- [x] 3.1 `lib/plan/index.ts`: demo base path returns squad + ratings + deterministic captain (from `buildDemoContext`), `teamId: 0`, `manager` placeholder
- [x] 3.2 `computeDemoInsights(ctx)`: run only the captain branch (`computeCaptainSynthesisInput` → `synthesizeCaptainPick`); return `{ transfers: null, captaincy, alerts }`
- [x] 3.3 Do **not** invoke the optimizer in demo (no transfer rec, no long-term horizon, no chip plan)
- [x] 3.4 Tests: demo insights make no transfer/chip LLM calls and no optimizer call; captaincy present; `transfers` null

## 4. Demo opening brief

- [x] 4.1 `lib/scout/brief.ts`: a demo welcome-brief variant (LLM stream + `composeDeterministicDemoBrief`), grounded on the `season` flag and the captain; no deadline/chip/"your squad" references
- [x] 4.2 The demo brief falls back to `composeDeterministicDemoBrief` on **both** no-key **and** runtime LLM failure (never an error string in the brief bubble) — coordinate with the `/api/brief` demo path so a thrown stream resolves to the deterministic brief, not a friendly-error event

## 5. De-personalized captain fallback for demo

- [x] 5.1 `lib/captain/synthesis.ts` (`buildFailSafe`): in demo mode use a de-personalized fallback narrative (e.g. "Top projected captain this gameweek: {webName}") instead of "Automated pick: … Review manually."; keep existing copy for the ID-based flow
- [x] 5.2 The deterministic captain *pick* is unchanged — only the fallback prose differs

## 6. Demo chat grounding

- [x] 6.1 `lib/scout/context.ts`: `getScoutContext` demo path builds from `getCachedDemoContext()` (sentinel) instead of `getCachedAnalysisContext(teamId)`
- [x] 6.2 `lib/scout/system-prompt.ts`: add a demo framing block — general advice about a sample squad, never "your squad"/rank/held chips; `simulate_transfer` is a hypothetical teaching tool, never a "you should transfer" verdict
- [x] 6.3 No new tools

## 7. Route demo signal

- [x] 7.1 `/api/plan/base` + `/api/plan/insights`: accept `demo=1`; when set, drop the `team_id` requirement and route to the demo plan/insights path
- [x] 7.2 `/api/ask` + `/api/brief`: accept `demo: true` in the body with the same effect
- [x] 7.3 Preserve response-shape parity (`GameweekPlan` / `PlanInsights` / NDJSON); demo differs only in `transfers` being null

## 8. Verify & green-gate

- [x] 8.1 Manual: hit `GET /api/plan/base?demo=1` (no `team_id`) — a spread of ratings, not a flat fallback (against the current bootstrap)
- [x] 8.2 `tsc` / `eslint` / `vitest` clean; new unit tests for sections 1–3 included

## Notes

- Ships now against whatever `bootstrap-static` serves; the off-season metric covers the no-`ep_next` gap.
- August (2026-27 GW1–3) quality depends on `new-season-readiness` item 1 (cold-start composite fix) — without it the new-season composite collapses to a flat rating. Coordinate landing that before GW1.
