## Tasks

**Status: ✅ All tasks complete.** All 10 tasks implemented and verified (type check + build clean, live test against team 123456 passing: ceiling-weighting ranks attackers above floor players, vice in a different match, differential surfaced, synthesis fail-safe confirmed, triple-captain advice integrated into the chip node with the DGW heuristic preserved as fallback). The captain horizon remains internal (feeds TC advice only); current-GW picks are exposed via `rankedCandidates`/`captain`/`viceCaptain`/`differentialOption`.

### Task 1: Captain config constants
**File:** `lib/config.ts` (extend)

Add `CAPTAIN_CONFIG`: ceiling/base/form weights, DGW multiplier bounds, fixture multiplier range, minutes-certainty curve, differential ownership threshold, vice-captain band, and triple-captain margin over baseline.

### Task 2: Create captain types
**Capability:** captain-types
**File:** `lib/captain/types.ts`

Define `CaptainSignals`, `CaptainScore`, `CaptainCandidate`, `CaptainResult`, `HorizonCaptainEntry`, `TripleCaptainAdvice`, `CaptainSynthesisInput`.

### Task 3: Implement captain scoring
**Capability:** captain-scoring
**File:** `lib/captain/scoring.ts`

Implement `computeCaptainScore` (ceiling-weighted, minutes-certainty gate, fixture + DGW multipliers, blank → 0) and `batchComputeCaptainScores` (starting XI only, effective ownership, reasons).

### Task 4: Implement captain ranker
**Capability:** captain-ranker
**File:** `lib/captain/ranker.ts`

Implement `rankCaptains` and `selectCaptaincy` (captain, vice avoiding same match, differential option, effective-ownership/differential flagging, whyCaptain).

### Task 5: Implement captain horizon
**Capability:** captain-horizon
**File:** `lib/captain/horizon.ts`

Implement `computeCaptainHorizon` (GW+1..GW+N best captain per week) and `deriveTripleCaptainAdvice` (peak vs baseline, recommend/hold, end-of-season handling).

### Task 6: Implement captain synthesis
**Capability:** captain-synthesis
**File:** `lib/captain/synthesis.ts`

Implement `synthesizeCaptainPick` with Claude call, template-vs-differential risk reasoning, response validation preserving deterministic node outputs, alerts, and a deterministic fail-safe.

### Task 7: Pipeline orchestrator
**File:** `lib/captain/index.ts`

Implement the captain orchestration core so it can share a pre-computed analysis: `runCaptainWithContext(ctx, horizonLength?)` does batch score current GW → rank/select → horizon + TC advice → synthesis, using the shared inputs. `runCaptainPipeline(teamId, horizonLength?)` is a thin wrapper that builds the inputs (running squad analysis) and delegates. (The `gameweek-plan` change consumes `runCaptainWithContext` to avoid recomputing squad analysis.)

### Task 8: API route
**File:** `app/api/captain/route.ts`

`GET /api/captain?team_id=X&horizon=N`. Validate params; return `CaptainResult`; mirror error handling of `/api/optimize`.

### Task 9: Integrate triple-captain with chip node
**File:** `lib/optimizer/chip-interaction.ts` (refactor)

Refactor the triple-captain branch to accept optional captain TC advice and defer to it; preserve the existing DGW heuristic as fallback when advice is absent (no regression).

### Task 10: Verification
Verify against real FPL team 123456:
- Captain score ranks ceiling players above floor players of equal transfer composite
- Doubtful/benched players are gated out of captaincy
- DGW player outranks a comparable single-fixture player
- Vice-captain is in a different match from the captain
- Differential option appears only when a low-owned high-ceiling candidate exists
- Horizon identifies a sensible triple-captain window (or correctly advises holding)
- Synthesis fail-safe returns a valid CaptainResult with confidence "low" when the API key is missing
- Refactored chip node produces the same/again-sensible TC recommendation via captain advice
- Type check + build clean
