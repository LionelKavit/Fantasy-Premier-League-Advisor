## Tasks

**Status: ✅ Complete.** `Player.teamCode` surfaced; `GameweekPlan` enriched with `squad` (15 views, slot order, resolved captain/vice/weak flags), `bank`, `chipsRemaining`, `manager`. Verified live against team 123456 (squad 11/4 split, flags resolved, teamCode present). tsc + build clean; 130 tests pass; coverage gate green.

### Task 1: Surface team code on Player
**Capability:** player-team-code
**Files:** `lib/types.ts`, `lib/fpl-api.ts`

Add `teamCode: number` to the `Player` interface and map it from the raw `team_code` in the player normalizer.

### Task 2: Extend the GameweekPlan type
**Capability:** plan-display-fields
**File:** `lib/plan/types.ts`

Add `SquadPlayerView` and extend `GameweekPlan` with `squad: SquadPlayerView[]`, `bank: number`, `chipsRemaining: ChipsRemaining`, and `manager: { name; overallRank; teamName }`.

### Task 3: Populate the display fields
**Capability:** plan-display-fields
**File:** `lib/plan/index.ts`

After fan-out, build `squad` by joining `ctx.analysis.picks` (slot order) to `ctx.analysis.rankedSquad` (scores/availability/teamCode), resolving `isCaptainRec`/`isViceRec` from `captaincy` and `isWeakSpot` from `ctx.analysis.weakest3`; set `bank`, `chipsRemaining` from the analysis and `manager` from `ctx.managerProfile.entry`. These come from the shared context, so they populate regardless of sub-pipeline success.

### Task 4: Update the suite for the new fields
**Files:** `lib/__tests__/factories.ts`, `lib/__tests__/plan/resilience.test.ts`, `lib/__tests__/e2e/flow.test.ts`

Add `teamCode` to `makePlayer`. Add assertions that `squad` (15, correct starting/bench split, flags), `bank`, `chipsRemaining`, and `manager` are present — including under partial failure (squad still populated when a side is null). Confirm existing assertions remain green.

### Task 5: Verify
Run `npx tsc --noEmit`, `npm run build`, and `npm test` — all clean. Optionally hit `/api/plan?team_id=123456&free_transfers=1` and confirm the response now includes `squad`/`bank`/`chipsRemaining`/`manager` and that players carry `teamCode`.
