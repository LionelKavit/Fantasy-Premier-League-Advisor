## Tasks

**Status: ✅ All tasks complete.** All 11 tasks implemented and verified (type check + build clean, live test against team 123456 passing, synthesis fail-safe confirmed). A post-implementation audit found and fixed 7 logic/quality gaps.

### Task 1: Create optimizer types
**Capability:** optimizer-types
**File:** `lib/optimizer/types.ts`

Define `ValidTransfer`, `TransferAction`, `SingleTransferResult`, `HitRecommendation`, `HitTransferResult`, `RestructureOption`, `HorizonEntry`, `ChipRecommendation`, `SynthesisInput`, and `OptimizerResult`.

### Task 2: Implement setup node
**Capability:** setup-node
**File:** `lib/optimizer/setup.ts`

Implement `validateTransfer(weak, candidate, bank, squadTeamCounts)` and `buildValidTransfers(analysis)`. Validate budget, club rule (3-per-team with sell-frees-slot logic), and availability.

### Task 3: Implement single-transfer node
**Capability:** single-transfer
**File:** `lib/optimizer/single-transfer.ts`

Implement `evaluateSingleTransfer(validTransfers, managerProfile)`. Rank by gw1Gain, identify best/alternatives/savings, determine ROLL if all gains ≤ 0.

### Task 4: Implement hit-transfer node
**Capability:** hit-transfer
**File:** `lib/optimizer/hit-transfer.ts`

Implement `evaluateHitTransfers(validTransfers, bank, squadTeamCounts, freeTransfers)`. Single hit (−4) and double hit (−8) analysis with budget chain simulation and break-even computation.

### Task 5: Implement restructure analyzer
**Capability:** restructure
**File:** `lib/optimizer/restructure.ts`

Implement `findRestructureOptions(analysis, allPlayers, fixtures, teams)`. Find sell-to-fund chains for dream targets, compute net score change, return top 3.

### Task 6: Implement horizon comparator
**Capability:** horizon-comparator
**File:** `lib/optimizer/horizon.ts`

Implement `computeHorizon(validTransfers, weakest3, fixtures, teams, currentGw)`. Re-score at GW+1 through GW+5 using shifted fixture signals. Compute cumulative gain, detect fixture swings, classify timing.

### Task 7: Implement chip interaction node
**Capability:** chip-interaction
**File:** `lib/optimizer/chip-interaction.ts`

Implement `evaluateChipInteractions(analysis, managerProfile, validTransfers, gwFlags, singleResult, hitResult)`. Trigger logic for all 4 chips with altered transfer output.

### Task 8: Implement synthesis node
**Capability:** synthesis-node
**File:** `lib/optimizer/synthesis.ts`

Implement `synthesizeRecommendation(inputs)` with Claude API call, structured prompt, JSON response parsing, Zod validation, and fail-safe defaults.

### Task 9: Implement pipeline orchestrator
**File:** `lib/optimizer/index.ts`

Implement `runOptimizerPipeline(analysis, managerProfile, freeTransfers, allPlayers, fixtures, teams)` wiring all nodes: setup → single/hit/restructure/horizon (parallel) → chip interaction → synthesis.

### Task 10: Create API route
**File:** `app/api/optimize/route.ts`

Wire the optimizer pipeline to an API route accepting `team_id` and `free_transfers` params. Calls `runSquadAnalysisPipeline` first, then `runOptimizerPipeline`.

### Task 11: Verification
Verify against real FPL team ID 123456:
- Setup node correctly filters invalid transfers
- Single transfer recommends ROLL when no improvements exist
- Hit transfer correctly simulates budget chains
- Restructure finds viable sell-to-fund chains
- Horizon shows different timing classifications across candidates
- Chip triggers fire correctly for known BGW/DGW scenarios
- Synthesis fail-safe returns valid output when ANTHROPIC_API_KEY is missing
- Full pipeline completes in <6 seconds
