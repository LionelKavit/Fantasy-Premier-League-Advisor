## Tasks

> Depends on the `captain-pick` change being implemented first.

**Status: ✅ All tasks complete.** All 7 tasks implemented and verified (type check + build clean; live `/api/plan` test against team 123456 returns combined transfers + captaincy; single squad-analysis pass confirmed via LLM-call count; combined latency 0.48s vs 1.07s for sequential separate calls). TC-coherence resolved via a deterministic-captain prelude that injects authoritative triple-captain advice into the optimizer's chip node while both LLM syntheses still run in parallel; proven by the `lib/__tests__/tc-coherence.test.ts` harness (`npm test`, 12 assertions). Standalone `/api/optimize` and `/api/captain` confirmed unchanged.

### Task 1: Gameweek plan types
**Capability:** gameweek-plan-types
**File:** `lib/plan/types.ts`

Define `AnalysisContext` and `GameweekPlan`.

### Task 2: Shared context builder
**Capability:** plan-aggregator
**File:** `lib/plan/context.ts`

Implement `buildAnalysisContext(teamId)`: run `runSquadAnalysisPipeline` once; fetch bootstrap, fixtures, manager profile; compute `detectGameweekFlags`; assemble the `AnalysisContext`.

### Task 3: Refactor optimizer to injected context
**File:** `lib/optimizer/index.ts` (refactor)

Extract the optimizer body into `runOptimizerWithContext(ctx, freeTransfers)`. Reimplement `runOptimizerPipeline(teamId, freeTransfers)` as a wrapper that calls `buildAnalysisContext` then delegates. Verify `/api/optimize` is unchanged.

### Task 4: Refactor captain to injected context
**File:** `lib/captain/index.ts` (refactor; implemented in captain-pick change)

Extract `runCaptainWithContext(ctx, captainHorizon)`. Reimplement `runCaptainPipeline(teamId, ...)` as a wrapper. Verify `/api/captain` is unchanged.

### Task 5: Plan aggregator
**Capability:** plan-aggregator
**File:** `lib/plan/index.ts`

Implement `runGameweekPlan(teamId, options)`: build context once, run both `*WithContext` cores in parallel, isolate per-side failures with plan-level alerts, assemble `GameweekPlan`.

### Task 6: Plan API route
**Capability:** plan-aggregator
**File:** `app/api/plan/route.ts`

`GET /api/plan?team_id=X&free_transfers=N&horizon=M`. Validate/clamp params; return `GameweekPlan`; mirror `/api/optimize` error handling.

### Task 7: Verification
Verify against real FPL team 123456:
- `buildAnalysisContext` runs squad analysis exactly once (instrument/log to confirm)
- `/api/plan` returns both transfers and captaincy in one response
- Combined latency is materially below calling `/api/optimize` then `/api/captain` sequentially
- Forcing an optimizer error returns captaincy + a plan alert (and vice versa)
- `/api/optimize` and `/api/captain` still return identical output to before the refactor
- Type check + build clean
