# Design — demo-mode engine

## 0. The seam: why this is mostly synthesis, not new pipeline
`teamId` threads from the routes into two places that fetch manager-specific data:
- `fetchPicks(teamId, gw)` → the 15-man squad
- `buildManagerProfile(teamId, bootstrap)` → rank, held chips, transfer history

Everything downstream (`runSquadAnalysisPipeline`, the scorers, `rankSquad`, `buildSquadView`, the Scout tools) operates on `Player[]` + a `picks` array and never re-reads the manager. So demo mode = **fabricate the picks + stub the profile**, then reuse the pipeline verbatim. This keeps the blast radius tiny and the demo's ratings/chat genuinely identical in behavior to the real product.

## 1. The dream-team builder (`lib/demo/squad.ts`)
`buildDemoSquad(players, { fixtures, teams, currentGw }) → DemoSquad`

**Season state — from the calendar, not `ep_next`.** `deriveDemoSeason(events)` returns **`"live"`** iff an unfinished gameweek with a future deadline exists, else **`"offseason"`**. This is the reliable signal: in the summer break the bootstrap keeps serving last season's *finished* GW38 feed, and those players still carry **stale `ep_next`** (verified: 386/841 with `ep_next > 0`, all 38 events finished, `is_next` undefined). So `ep_next` presence must NOT decide the season — the calendar does. Live mid-season → the current/next GW is upcoming; summer break → no upcoming GW; pre-season → the new GW1 deadline is in the future.

**Ranking metric — driven by season, guarded for pre-season.**
- **Live** → rank by `epNext` (anchors on FPL's projection, mirroring the epNext-dominant composite so the demo team agrees with the engine) — **unless** `ep_next` isn't meaningfully populated yet (the pre-season window), in which case fall back to `totalPoints`.
- **Off-season** → rank by `totalPoints` (tie-break `pointsPerGame`). Full and meaningful on the previous season's final bootstrap FPL keeps live through the summer; the stale `ep_next` is deliberately ignored.

The `season` flag is surfaced (on the context → plan → brief/banner) so the copy is honest about the basis ("last season's returns" vs "this week's projections") instead of pretending a finished feed is a live projection.

**Greedy budget-valid selection.** Constraints: 2 GK · 5 DEF · 5 MID · 3 FWD, total ≤ £100.0m, ≤ 3 players per club. A true ILP knapsack is overkill for a demo; use a **greedy value fill**:
1. Within each position, sort by the season metric.
2. Reserve cheap, credible "enabler" slots (e.g. a budget GK2 and the cheapest valid bench) so the premium slots have headroom.
3. Fill remaining slots by best **metric-per-£** under the running budget and the 3-per-club cap.
4. If the greedy pass can't complete a valid squad under budget, relax toward metric-only for the last slots and clamp to a valid formation (a demo team that's slightly sub-optimal is fine; an invalid one is not).

Then pick the **starting XI** (best 11 by metric forming a legal formation, ≥1 GK / ≥3 DEF / ≥1 FWD), the 4 bench slots, and the **captain** = highest-metric starter (vice = next). Emit a `PicksResponse`-shaped object: `picks[]` with `position` 1–15 (12–15 bench), `is_captain`/`is_vice_captain`, `multiplier`, plus `entry_history` with `bank: 0`.

**Determinism.** Pure function of the bootstrap snapshot → cacheable like any context; stable within a gameweek.

## 2. Demo context (`lib/plan/context.ts`)
`buildDemoContext()`:
- `fetchBootstrap()` + `fetchFixtures()` (cached as usual).
- `buildDemoSquad(...)` → synthetic picks.
- Score the 15 with the **same** path the real lite/full context uses (`scorePlayerLite` for base; the full pipeline scorers when the chat needs enriched scores), so ratings are real engine output.
- `rankSquad` + `identifyWeakest3` as normal (weak spots still meaningful — they make the chat's "who's the squad's weak link?" answer work — but no transfer *targets* are generated).
- **Stub `managerProfile`**: a placeholder entry (`name: "Demo Squad"`, `overallRank: null`), empty `chipsRemaining` (all chips shown as unavailable/none-held so nothing recommends one), neutral `riskProfile`/`transferPatterns`.
- `gwFlags` computed normally from fixtures.

`getCachedDemoContext()`: same TTL pattern as `getCachedAnalysisContext`, keyed on a single demo sentinel (the team is bootstrap-derived, so one cache entry serves everyone). Reuse the existing cache shape; do **not** overload a real `teamId`.

## 3. Demo plan (`lib/plan/index.ts`)
- **Base** (`runGameweekPlanBase` demo path): identical output to today — `squad` (full ratings) + deterministic captain/vice — built from `buildDemoContext` instead of `buildLiteBaseContext`. `teamId` field → `0`/null; `manager` → the demo placeholder.
- **Insights** (`computeDemoInsights`): **captaincy only**.
  - **Keep:** captain deterministic input + `synthesizeCaptainPick` (the captaincy call is meaningful on any squad and is a showcase).
  - **Skip:** the **entire optimizer** — the transfer recommendation, its LLM narrative, the chip orchestrator, *and* the long-term transfer horizon. `runOptimizerWithContext` is not called in demo.
  - **Why no long-term:** the "Long Term" tab is the optimizer's transfer horizon (`LongTermDetail` → `plan.transfers.horizon`; a `HorizonEntry` is `{ candidate, weakPlayer, timing }` — which transfer to make and when). That is transfer strategy, which demo excludes; and it needs the candidate pool that `buildDemoContext` deliberately skips (so it would be empty anyway).
  - Result: `transfers` is `null`; `captaincy` is populated. This bounds demo LLM spend to the captain synthesis (+ the brief and chat elsewhere).
  - *Implementation note:* `computeDemoInsights` is a small sibling of `computeInsights` that runs only the captain branch (`computeCaptainSynthesisInput` → `synthesizeCaptainPick`) and returns `{ transfers: null, captaincy, alerts }`.

## 4. Demo brief (`lib/scout/brief.ts`)
A demo variant of the opening brief — same shape (short, spoken, ≤4 sentences, no markdown) but a **welcome/explainer** grounding rather than `BriefGrounding`'s deadline-action shape:
- Leads with "I built this squad from {last season's returns | this week's projections}" (driven by the `season` flag), names the captain, and invites a question.
- Never references a deadline-action ("make your transfer"), held chips, or "your squad."
- Keep both an LLM stream path and a deterministic keyless fallback (mirroring `streamOpeningBrief` / `composeDeterministicBrief`).

## 5. Demo chat grounding (`lib/scout/{context,system-prompt}.ts`)
- `getScoutContext` gains a demo path that builds from `getCachedDemoContext()` (sentinel key) instead of `getCachedAnalysisContext(teamId)`. The tools (`score_player`, `simulate_captain`, `simulate_transfer`, `get_plan`) work unchanged against the demo context.
- The system prompt gains a **demo framing block**: "This is a sample squad built from the numbers, not the user's team. Give general FPL advice; never say 'your squad' or reference the user's rank/chips. `simulate_transfer` is a hypothetical teaching tool — explain the ep effect of a swap, but never issue a 'you should transfer' verdict."
- No new tools; the chip-plan authority logic simply has no committed chip plan to defer to in demo.

## 6. Route contract (`/api/plan/base|insights`, `/api/ask`, `/api/brief`)
- GET routes: a `demo=1` query param. When present, `team_id` is **not required**; the route calls the demo plan/insights path. (When both `demo=1` and a `team_id` are sent, `demo` wins.)
- POST routes (`/api/ask`, `/api/brief`): a `demo: true` body field with the same effect.
- Error/shape parity: demo responses are the same `GameweekPlan` / `PlanInsights` / NDJSON types — just with `transfers.primaryRecommendation`/`chipPlan` absent. The shell relies on that shape, not on a separate schema.

## Sequencing & risk
- Build order: builder → demo context → demo plan (base, then trimmed insights) → demo brief → demo chat framing → route flags. Each is independently unit-testable (the builder and context need no LLM).
- **Off-season check:** verify against whatever `bootstrap-static` currently serves — if it's 2025-26 final data, `season: "offseason"` ranks by `totalPoints` and the pitch shows a real spread. The cold-start composite bug only bites a *new* season's GW1–3 (see `new-season-readiness` item 1); flagged as a dependency for August, not a blocker now.
- Keep demo strictly additive and flag-gated so the ID flow can't regress.
