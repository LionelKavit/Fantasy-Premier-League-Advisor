## Tasks

> Status: implemented on branch `claude/musing-hoover-ef5e36`. `tsc` clean, `eslint` 0 errors, `vitest` 207 passed (204 existing + 3 new). Threading test lives in the e2e flow suite (mocks `fetchBootstrap` with a real `currentGameweek`), which is closer to end-to-end than a `plan/*` unit.

### Task 1 — ✅ Done: Add `deadline` to the result types
**Capability:** gameweek-plan-types
**Files:** `lib/pipeline/types.ts`, `lib/plan/types.ts`

Add `deadline: string | null` to `SquadAnalysisResult` (after `currentGw`) and to `GameweekPlan` (after `currentGw`). Document it as "ISO deadline of the current gameweek (when picks lock)".

### Task 2 — ✅ Done: Populate it at both analysis build sites
**Capability:** gameweek-plan-types
**Files:** `lib/pipeline/index.ts`, `lib/plan/context.ts`

In `runSquadAnalysisPipeline` and `buildLiteBaseContext`, read `const deadline = bootstrap.currentGameweek?.deadline_time ?? null;` and include `deadline` in the returned `SquadAnalysisResult`.

### Task 3 — ✅ Done: Surface it on every `GameweekPlan`
**Capability:** gameweek-plan-types
**File:** `lib/plan/index.ts`

Add `deadline: ctx.analysis.deadline` to the plan object at both build sites (`runGameweekPlanBase` and `runGameweekPlan`).

### Task 4 — ✅ Done: Tests
**Files:** `lib/__tests__/factories.ts`, `lib/__tests__/e2e/flow.test.ts`

- Gave `makeSquadAnalysisResult` a `deadline` default (`"2026-01-01T00:00:00Z"`) so existing fixtures compile.
- Added a deadline block to the e2e flow suite asserting it threads bootstrap → `SquadAnalysisResult` → `GameweekPlan` on **both** the base and full plan, and is `null` when `currentGameweek` is `null`.
- `npx tsc --noEmit` clean, `eslint` 0 errors (2 pre-existing warnings), `vitest` 207 passed.

## Verification
- Base API response (`/api/plan/base`) includes `deadline` for a real manager ID.
- No UI change expected yet.
