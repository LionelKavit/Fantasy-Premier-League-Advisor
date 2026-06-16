# Gameweek Plan Aggregator

## Why

The transfer optimizer and the captain pick pipeline are independent: each has its own orchestrator, its own API route, and its own result type. To present a manager with a single coherent "here is your gameweek" view, a frontend would have to call both endpoints and stitch the results together itself.

Worse, the two pipelines each call `runSquadAnalysisPipeline` separately. Squad analysis is the most expensive step in the system (per-player scoring, element-summary fetches, LLM context). Running it twice for one manager in one gameweek roughly doubles the cost and latency of the combined view for no benefit.

This change adds a **Gameweek Plan Aggregator** that runs squad analysis (and the shared bootstrap/fixtures/manager-profile fetches) **once**, then fans out that shared context to both the optimizer and the captain pipelines in parallel, returning a single combined `GameweekPlan`.

## What Changes

- **New capability `gameweek-plan-types`** — `AnalysisContext` (the shared, once-computed inputs) and `GameweekPlan` (the combined output bundling transfers + captaincy).
- **New capability `plan-aggregator`** — `runGameweekPlan(teamId, options)` orchestrator with parallel fan-out and partial-failure resilience, plus the `GET /api/plan` route.
- **Refactor (optimizer):** `runOptimizerPipeline` is split so its core logic accepts an injected `AnalysisContext` (`runOptimizerWithContext`). The existing `runOptimizerPipeline(teamId, freeTransfers)` and `/api/optimize` are preserved by building a context internally and delegating — no behavior change for existing callers.
- **Refactor (captain):** the captain orchestrator (still spec-only in the `captain-pick` change) is specified to expose the same injected-context entry point (`runCaptainWithContext`) so the aggregator can share the analysis.

This change depends on the `captain-pick` change being implemented; it is the integration layer on top of it.

Out of scope: a full 38-gameweek season plan. The `GameweekPlan` is current-gameweek-centric — it combines this gameweek's transfer and captaincy decisions. Forward-looking horizons remain inside each sub-result (the optimizer's 5-GW transfer horizon and the captain N-GW horizon) for timing decisions.
