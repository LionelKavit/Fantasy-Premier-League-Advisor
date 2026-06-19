## Tasks

> Performance only. Live timing verification uses the configured `ANTHROPIC_API_KEY`; unit tests run offline on spies/mocks.

### Task 1: Shared AnalysisContext cache
**Capability:** plan-caching
**Files:** `lib/plan/context.ts`, `lib/scout/context.ts`

- Add `getCachedAnalysisContext(teamId)` + `invalidateAnalysisContext(teamId)` (in-memory Map, ~10-min TTL, failures not cached).
- Refactor `getScoutContext` to build on it.

### Task 2: Base / insights split
**Capability:** plan-phasing
**File:** `lib/plan/index.ts`

- `runGameweekPlanBase` (deterministic squad + meta + deterministic captain, no LLM) and `runGameweekPlanInsights` (the three syntheses) over the cached context. Adapt `buildSquadView` to take captain/vice ids. Keep `runGameweekPlan` as a merged wrapper.

### Task 3: Insights result cache + Re-analyze bypass
**Capability:** plan-caching
**File:** `lib/plan/index.ts`

- Memoize insights per `team:gw:freeTransfers:horizon` (TTL); `force` bypasses; tie invalidation to `invalidateAnalysisContext`.

### Task 4: Endpoints
**Capability:** plan-phasing
**Files:** `app/api/plan/base/route.ts`, `app/api/plan/insights/route.ts` (new); `app/api/plan/route.ts` (delegate)

- `base` and `insights` GET routes; `insights` accepts `force=1`. Reuse params + `ApiErrorResponse`.

### Task 5: Two-phase fetch + progressive render
**Capability:** progressive-dashboard
**Files:** `lib/client/plan.ts`, `app/page.tsx`, `components/panel/ScoutVerdict.tsx` (+ `ThisWeekDetail`/`LongTermDetail` if needed)

- `fetchPlanBase` / `fetchPlanInsights({ force })`. Page renders pitch+header+alerts from base immediately; `insightsLoading` drives a step-aware "Scout is analyzing…" indicator in the verdict/detail panels; merge insights on arrival. Re-analyze forces a fresh run. No full-screen blocker.

### Task 6: Tests + verify — ✅ Done
- [x] Context cache: `fetchPicks` called once across two `getCachedAnalysisContext` calls; `invalidateAnalysisContext` forces recompute (in `flow.test.ts`).
- [x] `runGameweekPlanBase` returns a deterministic captain and skips the three syntheses (≤1 `llm.complete` call — the squad-analysis context batch; transfers/captaincy null).
- [x] `runGameweekPlanInsights` cache hit on repeat key (no `llm` re-invoke); `force` bypasses.
- [x] `lib/__tests__/plan/resilience.test.ts` reconciled (mocks `getCachedAnalysisContext`, clears the insights cache); `flow.test.ts` green via the merged wrapper.
- [x] `npx tsc --noEmit`, `eslint .` (0 errors), `next build` (both new routes registered), `vitest` (181 tests) clean.
- [x] Browser (live key): pitch/header paint while the insights region shows the step-aware "analyzing" indicator (screenshot captured); reload renders the full plan instantly (insights cache hit); Re-analyze recomputes (force).

#### As-built notes
- **Lite base (follow-up fix).** Initial impl had base reuse the full `getCachedAnalysisContext`, whose squad analysis does a ~100+ `fetchElementSummary` fan-out + a `batchComputeLlmContext` call — cold base measured **>30s**. Base now uses `buildLiteBaseContext`: bootstrap + fixtures + picks + profile, scoring **only the 15 squad players** via the shared `scorePlayerLite` (`lib/pipeline/lite-scoring.ts`), with `identifyWeakest3` for weak-spot flags. **No candidate pool, no element fetches, no LLM.** Cold base now ~**0.4s** (warm ~10–25ms). The merged `runGameweekPlan` wrapper builds from the full context (not the lite base) so `/api/plan` stays full-scored.
- `scorePlayerLite` is shared: the Scout's `scorePlayer` now delegates to it (DRY).
- Pitch shows lite scores on first paint (differ from full only by bounded trend/LLM adjustments); the client reconciles the captain armband when insights arrive.
- Two module-level caches (context in `lib/plan/context.ts`, insights in `lib/plan/index.ts`) are per-process; test-only `_clearContextCache` / `_clearInsightsCache` reset them between tests.
