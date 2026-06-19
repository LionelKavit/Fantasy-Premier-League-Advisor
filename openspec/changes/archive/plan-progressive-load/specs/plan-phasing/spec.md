## ADDED Requirements

### Requirement: The gameweek plan is computed in two phases
The system SHALL expose the plan as a fast deterministic **base** phase and a slow LLM **insights** phase, so the pitch can render before the syntheses complete.

#### Scenario: Base phase is a lightweight squad-only computation
- **WHEN** `runGameweekPlanBase(teamId, opts)` (or `GET /api/plan/base`) runs
- **THEN** it returns the squad view, bank, chips, manager meta, weak-spot flags, and the **deterministic** captain/vice, with `transfers`/`captaincy` left null
- **AND** it scores **only the 15 squad players** with lightweight scoring (statistical + fixture + market; neutral trend/LLM) — it does **not** build the transfer candidate pool, does **not** fetch per-player element summaries, and makes **no** LLM call

#### Scenario: Insights phase carries the full analysis + syntheses
- **WHEN** `runGameweekPlanInsights(teamId, opts)` (or `GET /api/plan/insights`) runs
- **THEN** it builds (or reuses the cached) **full** analysis — candidate pool, element summaries, batched player-context — and returns the optimizer transfers, the captaincy result (with narrative), the long-term narrative, and alerts

#### Scenario: Merged plan preserved for back-compat
- **WHEN** `runGameweekPlan` / `GET /api/plan` is called
- **THEN** it returns the same full `GameweekPlan` as before (full-scored squad + the syntheses), so existing callers and tests are unaffected

#### Scenario: The full analysis is computed once and shared
- **WHEN** the insights phase, the merged plan, and the Scout chat run for the same manager within the cache TTL
- **THEN** the expensive full analysis is computed once and shared (the lightweight base phase computes its own squad-only scoring and does not populate that cache)
