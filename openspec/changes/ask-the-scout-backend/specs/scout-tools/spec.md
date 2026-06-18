## ADDED Requirements

### Requirement: Lightweight simulation module
The system SHALL provide `lib/simulate` with `simulateTransfer` and `simulateCaptain` that compute a **lightweight delta** (validate + re-score affected players), not a full re-plan.

#### Scenario: Simulate a transfer
- **WHEN** `simulateTransfer({ outId, inId })` runs against the manager's context
- **THEN** it validates the move (budget + 3-per-club via `validateTransfer`) and returns whether it's legal, the price delta, and the projected score gain of the incoming over the outgoing player

#### Scenario: Illegal move
- **WHEN** the move breaks budget or the club rule
- **THEN** it returns `legal: false` with the reason (it does not throw)

#### Scenario: Simulate a captain
- **WHEN** `simulateCaptain({ id })` runs
- **THEN** it returns that player's captain score for the current gameweek and how it compares to the current recommended captain

### Requirement: Scout tool set
The system SHALL expose a tool set the agentic loop can call, all scoped to FPL data, wrapping existing pipeline functions.

#### Scenario: Squad / plan tools
- **WHEN** the model calls `get_plan` or `get_squad`
- **THEN** it receives the manager's current recommendation plan / squad from the grounding context

#### Scenario: Score any player
- **WHEN** the model calls `score_player({ query })` (name) or `({ id })`
- **THEN** the tool resolves the player from the full pool, scores them (reusing squad-analysis scoring), and returns the composite score + key signals — for **any** player, not just the squad

#### Scenario: Targeted scoring is full-fidelity (lazy enrichment)
- **WHEN** a targeted tool (`score_player`, `compare_players`, or `simulate_*`) scores a player who is **not** already in the squad/analysis
- **THEN** the system enriches that one player on demand via `scorePlayerEnriched` — a lazy per-player `fetchElementSummary` → trend signals, plus a single-player LLM-context pass when an API key is configured — and caches the enriched score on the context for reuse within the session
- **AND** squad members and evaluated transfer targets short-circuit to their existing full pipeline score (no refetch)
- **AND** when the element-summary fetch fails or no key is set, scoring degrades gracefully to the lightweight result (no throw)

#### Scenario: Search the pool
- **WHEN** the model calls `search_players({ position?, maxPrice?, team?, sortBy?, limit? })`
- **THEN** it returns a filtered, ranked list of candidates from the player pool, scored **lightweight** (no per-player fetch/LLM) to keep the bulk scan cheap

#### Scenario: Compare players
- **WHEN** the model calls `compare_players(a, b)`
- **THEN** it returns the two players' (enriched) scores/stats side by side

#### Scenario: Simulation tools exposed
- **WHEN** the model calls `simulate_transfer` or `simulate_captain`
- **THEN** they invoke `lib/simulate` and return the delta result

#### Scenario: Tool failure is recoverable
- **WHEN** a tool can't resolve its input (e.g. unknown player) or errors
- **THEN** it returns a structured error message the model can read and recover from (not an exception that aborts the request)
