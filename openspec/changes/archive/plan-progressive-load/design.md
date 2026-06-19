# Design

## Context
The deterministic phase (`buildAnalysisContext` → `runSquadAnalysisPipeline`) produces everything the pitch needs and is the only part required for a meaningful first paint. The three LLM syntheses (optimizer weekly + long-term, captain) are the slow tail. `GameweekPlan.transfers` and `.captaincy` are already nullable, so a base-only plan is a valid partial render. The Scout chat already demonstrates the cache + context pattern we'll generalize (`lib/scout/context.ts`).

## Key Decisions

### 1. Shared, TTL'd AnalysisContext cache
Add `getCachedAnalysisContext(teamId)` + `invalidateAnalysisContext(teamId)` in `lib/plan/context.ts`: an in-memory `Map` keyed by `teamId` holding `{ ctx, gw, ts }`, ~10-min TTL, failures not cached (mirror `lib/scout/context.ts`). Refactor `getScoutContext` to build on it, so the expensive squad analysis (and its batched LLM-context call) is computed **once** and shared by the plan base phase, the insights phase, and the Scout chat within the TTL.

### 2. Base / insights split
- `runGameweekPlanBase(teamId, opts)` — builds a **lightweight squad-only analysis** via `buildLiteBaseContext` (bootstrap + fixtures + picks + manager profile; scores **only the 15 squad players** with the shared lightweight scorer — statistical + fixture + market, neutral trend/LLM; ranks them and flags weak spots via `identifyWeakest3`). It deliberately **skips the candidate pool, the per-player element-summary fan-out, and the `batchComputeLlmContext` call** — those are the cold bottleneck (~100+ FPL requests + an LLM call) and the pitch doesn't need them. Then the deterministic captain via `computeCaptainSynthesisInput` → `buildSquadView(...)`. **No LLM, no candidate fetches.** `buildSquadView` takes captain/vice **ids**.
- `runGameweekPlanInsights(teamId, opts)` — uses the **full** cached context (`getCachedAnalysisContext`) → the three syntheses → `{ transfers, captaincy, alerts }`.
- `runGameweekPlan` is a thin wrapper that builds the full plan from the **full** context + insights (it does not reuse the lite base, so the merged plan keeps full-scored squad for back-compat).
- The base scores differ from the full scores only by the bounded trend/LLM adjustments; the pitch shows lite scores on first paint and the client reconciles the captain armband when insights arrive. (Note: `computeStatisticalSignals` already ignores the element summary, so the only lite/full delta is trend + LLM context.)

### 3. Insights result cache + Re-analyze
Memoize `runGameweekPlanInsights` in a `Map` keyed by `team:gw:freeTransfers:horizon`, TTL'd. A `force` flag (plus `invalidateAnalysisContext`) lets "Re-analyze" recompute. Net: first load computes; refresh / back-nav / lens switches are instant; Re-analyze is an explicit fresh run.

### 4. Endpoints
- `GET /api/plan/base` → base. `GET /api/plan/insights` → insights (accepts `force=1`). Both reuse the existing `team_id` / `free_transfers` / `horizon` params and the `ApiErrorResponse` 400/404/500 shape.
- `GET /api/plan` stays (delegates to the merged wrapper) for back-compat.

### 5. Progressive render — the deliberate hybrid (not a full-screen loader)
- `lib/client/plan.ts`: add `fetchPlanBase(...)` and `fetchPlanInsights(..., { force })` (keep `fetchPlan`).
- `app/page.tsx`: `load()` awaits base first → renders **Header + Pitch + AlertsCard** (new `"base"` status); then fetches insights → merges `transfers`/`captaincy`/`alerts` and flips to `"loaded"`.
  - An `insightsLoading` flag drives a **step-aware "Scout is analyzing…" indicator** in `ScoutVerdict` and the `ThisWeekDetail`/`LongTermDetail` panels (cycling honest steps, e.g. "scoring transfers → weighing captaincy → mapping the run-in"). Rejected alternative: a full-screen progress bar — that's effectively today's `Skeleton` and withholds the already-renderable pitch.
  - Pitch armband uses the deterministic captain from base; if insights refine the pick, flags update on merge.
  - `Re-analyze` → invalidate + re-fetch base + `fetchPlanInsights({ force: true })`.

## Reuse (don't rebuild)
`buildAnalysisContext` + `buildSquadView` + merge logic (`lib/plan`), `computeCaptainSynthesisInput` (`lib/captain`), `runOptimizerWithContext` (`lib/optimizer`), `synthesizeCaptainPick` (`lib/captain/synthesis`); the scout's TTL-cache pattern (`lib/scout/context.ts`) is the template.

## Risks / notes
- In-memory caches are per-process (fine for dev; per-instance under serverless) — acceptable; note in code.
- Partial render must not look broken — the analyzing indicator + the self-contained pitch handle that.
