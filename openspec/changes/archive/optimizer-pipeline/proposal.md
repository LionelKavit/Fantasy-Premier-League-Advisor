# Optimizer Pipeline

## Problem

The Squad Analysis Pipeline scores and ranks players, identifies the 3 weakest squad members, and finds replacement candidates — but it makes no decisions. It does not evaluate whether to make a free transfer, take a hit, roll the transfer, use a chip, or restructure the squad. There is no mechanism to compare immediate vs. long-term value, resolve conflicting recommendations, or factor in the manager's risk tolerance.

## Proposed Change

Build a 7-node Optimizer Pipeline that consumes `SquadAnalysisResult` + `ManagerProfile` and produces `OptimizerResult` — a complete, actionable transfer recommendation with:

- Primary transfer recommendation (free transfer, hit, roll, or wildcard)
- Secondary recommendation (plan for next week)
- Hit verdict with break-even analysis
- Chip usage plan with sequencing
- Restructure options (sell-to-fund chains for premium targets)
- Horizon projections (GW+1 through GW+5 score comparisons)
- LLM-generated narrative summary explaining the reasoning

Captain pick is **not** included — it will be a separate spec change set.

## Capabilities

1. **optimizer-types** — All new types for the pipeline
2. **setup-node** — Validate and prepare transfer options
3. **single-transfer** — Evaluate best free transfer or roll decision
4. **hit-transfer** — Single and double hit analysis with budget chain validation
5. **restructure** — Sell-to-fund chains for dream targets
6. **horizon-comparator** — 5-GW fixture-adjusted score projections
7. **chip-interaction** — Wildcard/FreeHit/BenchBoost/TripleCaptain trigger logic
8. **synthesis-node** — LLM-powered decision synthesis with fail-safe
