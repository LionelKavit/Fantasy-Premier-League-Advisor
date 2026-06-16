## Tasks

### Task 1: Create scoring config
**Capability:** scoring-config
**File:** `lib/config.ts`

Export `SCORING_WEIGHTS` (per-position weight vectors with form, xgcRate, defensive categories), `NORMALIZATION_BOUNDS` (per-signal min/max including inverted bounds for xgcRate and suspensionRisk), `SUSPENSION_THRESHOLDS` (yellow card ban thresholds), `TREND_THRESHOLDS`, `REGRESSION_ADDITIVES`, `LLM_SIGNAL_RANGES`, and `PIPELINE_CONFIG`.

### Task 2: Create pipeline signal types
**Capability:** all
**File:** `lib/pipeline/types.ts`

Define `StatisticalSignals` (12 fields including formSignal, xgcRate, defensiveScore, suspensionRisk), `TrendSignals`, `FixtureSignals`, `MarketSignals`, `LlmContextSignals`, `CompositeScore`, `ScoredPlayer`, `WeakSpot`, `TransferCandidate`, `SquadAnalysisResult`.

### Task 3: Create normalization utility
**Capability:** composite-scorer
**File:** `lib/pipeline/normalize.ts`

Implement `normalizeSignal(value, min, max)` → clamped 0-1.

### Task 4: Implement statistical scoring node
**Capability:** statistical-scoring
**File:** `lib/pipeline/statistical-scoring.ts`

Implement `computeStatisticalSignals(player, currentGw, elementSummary?)` computing goalThreat, assistPotential, formSignal, bonusEfficiency (BPS + bonus + influence weighted), setPieceValue, valueScore, cleanSheetRate, xgcRate (xGC + GC weighted), defensiveScore (defensiveContributionPer90), savesRate, minutesReliability (starts/GW × chanceOfPlayingNext), suspensionRisk (yellow/red card proximity to ban thresholds).

### Task 5: Implement trend analyzer node
**Capability:** trend-analyzer
**File:** `lib/pipeline/trend-analyzer.ts`

Implement `computeTrendSignals(history, historyPast)` with rolling 5GW window, xG slope, gap analysis, finisher premium, and BUY/SELL/HOLD classification.

### Task 6: Implement fixture analyzer node
**Capability:** fixture-analyzer
**File:** `lib/pipeline/fixture-analyzer.ts`

Implement `computeFixtureSignals(player, fixtures, teams, currentGwId)` using existing `computeFdrRun` and `getPlayerFixtures`. Compute fdrScore, homeRatio, dgwBonus, opponentStrength.

### Task 7: Implement market dynamics node
**Capability:** market-dynamics
**File:** `lib/pipeline/market-dynamics.ts`

Implement `computeMarketSignals(player)` computing priceMovement, ownershipScore, transferMomentum, epNextSignal, differentialValue.

### Task 8: Implement LLM context node — prompt and parsing
**Capability:** llm-context
**File:** `lib/pipeline/llm-context.ts`

Implement `batchComputeLlmContext(players, teamSetPieceNotes, opponentPlayers)` with Claude API call, structured JSON prompt, response parsing, signal clamping, and fail-safe defaults.

### Task 9: Implement composite scorer
**Capability:** composite-scorer
**File:** `lib/pipeline/composite-scorer.ts`

Implement `computeCompositeScore(stats, trend, fixture, market, llm, position)` with normalization, position-specific weighting, trend additive, LLM adjustment, and insufficient data fallback.

### Task 10: Implement squad ranker and weakness identification
**Capability:** squad-ranker
**File:** `lib/pipeline/squad-ranker.ts`

Implement `rankSquad(scoredPlayers)` and weakness reason generation from score breakdowns.

### Task 11: Implement candidate search
**Capability:** squad-ranker
**File:** `lib/pipeline/squad-ranker.ts`

Implement `findCandidates(weakPlayer, allPlayers, budget, existingTeamIds, scoredCache)` with position matching, budget filtering, club rule enforcement, and top-5 selection.

### Task 12: Implement pipeline orchestrator
**Capability:** squad-ranker
**File:** `lib/pipeline/index.ts`

Implement `runSquadAnalysisPipeline(teamId)` that wires all nodes: parallel data fetch → parallel signal computation → LLM batch → composite scoring → ranking → candidate search → SquadAnalysisResult.

### Task 13: Create or update API route
**File:** `app/api/squad/route.ts` or `app/api/analysis/route.ts`

Wire the pipeline to an API route that accepts `team_id` and returns `SquadAnalysisResult`.

### Task 14: Verification
Verify against real FPL team ID 123456:
- All signal computations return values within expected ranges
- Position-specific weights sum to 1.0
- Trend analyzer correctly classifies known performers
- LLM fallback works when ANTHROPIC_API_KEY is not set
- Composite scores are in 0.2-0.9 range with plausible ordering
- Weakest 3 identification produces sensible reasons
- Candidate search respects budget, 3-per-team rule, position matching
- Full pipeline completes in <6 seconds first run, <1 second cached
