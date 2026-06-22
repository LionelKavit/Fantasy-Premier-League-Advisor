## ADDED Requirements

### Requirement: A single chip-plan source of truth
There SHALL be one chip plan (`chipPlan`) that is the sole authority for chip decisions; This Week and the Chips tab SHALL both derive from it. Each entry SHALL carry a `status` (`window` | `play-now` | `hold`), a gameweek, reasoning, and — for an activatable chip — its draft.

#### Scenario: Both surfaces read the same plan
- **WHEN** chip information is shown anywhere
- **THEN** This Week and the Chips tab both render from `chipPlan` (no second, independent chip computation)

### Requirement: This Week ↔ Chips consistency invariant
This Week SHALL show a chip activation **iff** `chipPlan` contains a `play-now` entry at the current gameweek; the Chips tab SHALL show the whole plan. This SHALL hold with or without an API key.

#### Scenario: A chip is played this week
- **WHEN** `chipPlan` has a `play-now` entry at the current gameweek
- **THEN** This Week surfaces that activation (with its draft), and the Chips tab shows the same entry as this-week — they cannot contradict

#### Scenario: Only future windows
- **WHEN** `chipPlan` has only `window` / `hold` entries
- **THEN** This Week shows no chip activation, and the Chips tab shows the candidate windows

### Requirement: The transfer synthesis does not elect chips
The weekly transfer recommendation SHALL be FREE / HIT / ROLL only; `WILDCARD` / `FREE_HIT` SHALL NOT be transfer actions or appear in the synthesis schema. Chip decisions come solely from `chipPlan`.

#### Scenario: Model cannot elevate a chip
- **WHEN** the transfer synthesis runs
- **THEN** it cannot set `primaryRecommendation` to a chip; FREE / HIT / ROLL behavior is unchanged

### Requirement: Deterministic layer never auto-activates (N2 baseline)
The deterministic chip generator SHALL emit only `window` / `hold` entries — never `play-now`. Activation is reserved for the orchestrator.

#### Scenario: No key, no orchestrator
- **WHEN** there is no LLM orchestrator (e.g. deterministic-only or no API key)
- **THEN** `chipPlan` has no `play-now` entry, so This Week shows no chip while the Chips tab still shows the deterministic candidate windows

### Requirement: One canonical draft; FREE_HIT represented
The wildcard/free-hit transfer draft SHALL be computed once and attached to the chip entry; FREE_HIT SHALL be represented in the model (not coerced to ROLL).

#### Scenario: Single draft
- **WHEN** a chip has a draft
- **THEN** the same draft is used wherever that chip is shown (no second, divergent draft computation)
