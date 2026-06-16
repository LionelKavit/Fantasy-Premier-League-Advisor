# Design

## Context

The optimizer and captain pipelines both begin from the same foundation: a `SquadAnalysisResult` plus shared reference data (bootstrap players/teams, fixtures, manager profile, gameweek flags). Today the optimizer fetches and computes all of this itself, and the captain pipeline is specified to do the same. The aggregator's job is to compute that foundation once and hand it to both.

## Key Decisions

### 1. Squad analysis is computed once and injected as a shared `AnalysisContext`
This is the core reason for the change. The aggregator builds one `AnalysisContext` (squad analysis + bootstrap + fixtures + manager profile + gw flags) and passes it to both sub-pipelines. This removes the duplicate squad-analysis pass — the system's most expensive step — from the combined view.

### 2. Sub-pipelines expose an injected-context entry point; standalone entry points are preserved
Each pipeline gains a `run*WithContext(ctx, options)` function containing its real logic. The existing `runOptimizerPipeline(teamId, freeTransfers)` (and the captain pipeline's `runCaptainPipeline(teamId, ...)`) become thin wrappers that build a context and delegate. Effect:
- `/api/optimize` and `/api/captain` keep working unchanged.
- `/api/plan` builds the context once and calls both `*WithContext` functions.
- No logic is duplicated between the standalone and aggregated paths.

### 3. Fan-out is parallel
Given a shared `AnalysisContext`, the optimizer and captain pipelines are independent and SHALL run concurrently (`Promise.all`). The combined latency is therefore `max(optimizer, captain)` after the one-time analysis, not the sum.

### 4. Partial failure is isolated, not fatal
Both sub-pipelines already degrade gracefully on LLM failure (deterministic fail-safes). The aggregator additionally guards against a sub-pipeline throwing entirely: if one fans-out fails hard, the plan returns the other's result, sets the failed side to null, and records a plan-level alert. A manager always gets whatever could be produced.

### 5. The plan is current-gameweek-centric
`GameweekPlan` answers "what do I do *this* gameweek": the transfer action(s) and the captain/vice for the upcoming gameweek. It deliberately does not flatten the forward horizons into a 38-week script — those stay inside each sub-result as timing aids (when to buy, when to triple-captain).

### 6. Triple-captain coherence is owned downstream, not re-resolved here
The `captain-pick` change already routes triple-captain advice from the captain horizon into the optimizer's chip node. The aggregator does not re-decide chips; it surfaces both sub-results as produced, so the chip plan in the optimizer result and the triple-captain advice in the captain result are already consistent.

## Shapes (informative)

```
AnalysisContext {
  analysis: SquadAnalysisResult
  managerProfile: ManagerProfile
  players: Player[]
  teams: Team[]
  fixtures: Fixture[]
  gwFlags: GameweekFlags[]
}

GameweekPlan {
  teamId: number
  currentGw: number
  transfers: OptimizerResult | null
  captaincy: CaptainResult | null
  alerts: string[]          // plan-level (e.g. a sub-pipeline failed)
  generatedAt: string
}
```

## Reused / refactored functions
- `runSquadAnalysisPipeline` — called once by the aggregator (and by the standalone wrappers).
- `fetchBootstrap`, `fetchFixtures`, `buildManagerProfile` — called once to populate the context.
- `detectGameweekFlags` — called once for the context's `gwFlags`.
- `runOptimizerWithContext` (new) / `runCaptainWithContext` (new) — the injected-context cores.
