## Tasks

### Task 1: Add `deadline` to the result types
**Capability:** gameweek-plan-types
**Files:** `lib/pipeline/types.ts`, `lib/plan/types.ts`

Add `deadline: string | null` to `SquadAnalysisResult` (after `currentGw`) and to `GameweekPlan` (after `currentGw`). Document it as "ISO deadline of the current gameweek (when picks lock)".

### Task 2: Populate it at both analysis build sites
**Capability:** gameweek-plan-types
**Files:** `lib/pipeline/index.ts`, `lib/plan/context.ts`

In `runSquadAnalysisPipeline` and `buildLiteBaseContext`, read `const deadline = bootstrap.currentGameweek?.deadline_time ?? null;` and include `deadline` in the returned `SquadAnalysisResult`.

### Task 3: Surface it on every `GameweekPlan`
**Capability:** gameweek-plan-types
**File:** `lib/plan/index.ts`

Add `deadline: ctx.analysis.deadline` to the plan object at both build sites (`runGameweekPlanBase` and `runGameweekPlan`).

### Task 4: Tests
**Files:** `lib/__tests__/factories.ts`, `lib/__tests__/plan/*.test.ts` (or nearest existing plan test)

- Give `makeSquadAnalysisResult` a `deadline` default (e.g. `"2026-01-01T00:00:00Z"`) so existing fixtures compile.
- Add a unit asserting the deadline threads bootstrap → `SquadAnalysisResult` → `GameweekPlan` (base phase), and is `null` when `currentGameweek` is absent.
- `npx tsc --noEmit`, `eslint .`, `vitest` all green (existing 204 + new).

## Verification
- Base API response (`/api/plan/base`) includes `deadline` for a real manager ID.
- No UI change expected yet.
