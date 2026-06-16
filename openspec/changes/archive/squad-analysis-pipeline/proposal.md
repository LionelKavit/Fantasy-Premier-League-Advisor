## Problem

The data layer is complete — all FPL API data (players with 50+ normalized fields, fixtures, manager profile with history/chips/risk/transfer patterns, gameweek flags) is fetched, normalized, and cached. But no scoring or analysis exists. The app cannot yet answer the fundamental question: "Which of my 15 players are weakest, and who should I transfer in?"

The Squad Analysis Pipeline is the core computation engine that:
1. **Scores every player** using statistical, trend, fixture, market, and contextual signals
2. **Applies position-specific weights** (FWD values goals, DEF values clean sheets, GK values saves)
3. **Ranks the manager's squad** and identifies the weakest 3 starters
4. **Searches for replacement candidates** within budget and club-rule constraints

Without this pipeline, the Optimizer Pipeline (future change set) has no scored players to optimize over, and the UI has no data to display.

## Proposed Change

Build the 8-node Squad Analysis Pipeline:

- **New config**: `lib/config.ts` — all scoring weights, normalization bounds, trend thresholds, regression additives, LLM signal ranges, pipeline constants
- **New pipeline types**: `StatisticalSignals`, `TrendSignals`, `FixtureSignals`, `MarketSignals`, `LlmContextSignals`, `CompositeScore`, `ScoredPlayer`, `WeakSpot`, `TransferCandidate`, `SquadAnalysisResult`
- **New signal computation nodes**: statistical scoring, trend analyzer, fixture analyzer, market dynamics, LLM context
- **New scoring engine**: composite scorer with normalization and position-specific weighting
- **New ranking and search**: squad ranker with weakness identification and candidate search
- **New orchestrator**: `runSquadAnalysisPipeline(teamId)` that wires all nodes together

## Capabilities Added

1. `scoring-config` — Tunable weights, bounds, thresholds, and pipeline constants
2. `statistical-scoring` — Per-player stat signal computation (xGI, BPS, set pieces, value, CS)
3. `trend-analyzer` — Rolling 5GW xG/goals regression with BUY/SELL classification
4. `fixture-analyzer` — FDR scoring, home/away, DGW/BGW, opponent strength
5. `market-dynamics` — Price movement, ownership, transfer momentum, expected points
6. `llm-context` — Claude API contextual signals (rotation, OOP, injury, tactical, opponent absence)
7. `composite-scorer` — Normalization + position-weighted composite scoring
8. `squad-ranker` — Squad ranking, weakness identification, and candidate search
