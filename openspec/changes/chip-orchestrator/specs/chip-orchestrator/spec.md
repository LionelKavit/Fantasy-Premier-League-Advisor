## ADDED Requirements

### Requirement: chips.md-grounded chip orchestrator
The system SHALL produce the chip plan via a single LLM synthesis grounded in `chips.md` (principles) and the deterministic candidate windows + chip state + fixture facts (the facts). Its structured output SHALL become the single `chipPlan`.

#### Scenario: Grounded sequencing
- **WHEN** the orchestrator runs with candidate windows and `chips.md`
- **THEN** it returns a structured plan that selects/sequences among the provided windows (per chip: play-now | sequenced gameweek | hold) with reasoning, and that result becomes `chipPlan`

#### Scenario: No invented fixtures
- **WHEN** the orchestrator returns a gameweek not present in the provided windows
- **THEN** that entry is dropped (it may only act on provided, confirmed windows)

### Requirement: Orchestrator-judged single-fixture Triple Captain
The grounding SHALL include the current gameweek's top captain-candidate signals (form, fixture multiplier, ceiling, minutes certainty). A single-fixture Triple Captain (no Double) SHALL be an orchestrator judgment, not a deterministic rule.

#### Scenario: Justified single-fixture TC
- **WHEN** there is no premium Double before the chip expires, but the top captain candidate has a fixture-driven exceptional ceiling (very weak opponent), is in form, and is nailed on minutes
- **THEN** the orchestrator MAY propose a single-fixture Triple Captain, grounded in those signals and `chips.md` (a Double is the textbook spot; a single great fixture can justify it)

#### Scenario: Held when risky or a Double is available
- **WHEN** the captain's minutes are uncertain, or a premium Double exists before the chip expires
- **THEN** the orchestrator does NOT propose a single-fixture Triple Captain (it holds for the Double or a safer week)

### Requirement: LLM-gated This Week activation (N2)
A chip SHALL be activated in This Week only when the orchestrator sets a `play-now` entry at the current gameweek; the deterministic layer never activates.

#### Scenario: Orchestrator plays a chip this week
- **WHEN** the orchestrator sets `play-now` at the current gameweek
- **THEN** This Week surfaces that chip with its draft, and the Chips tab shows the same decision (consistent)

#### Scenario: Orchestrator holds
- **WHEN** the orchestrator sequences all chips for future gameweeks or holds them
- **THEN** This Week shows no chip activation; the Chips tab shows the sequenced plan

### Requirement: Keyless degradation preserves the invariant
With no API key the orchestrator SHALL be skipped and `chipPlan` SHALL be the deterministic candidate windows; This Week SHALL show no chip (N2) and the Chips tab SHALL show the windows with templated reasoning and an "AI reasoning offline" indicator.

#### Scenario: No key
- **WHEN** `ANTHROPIC_API_KEY` is not set
- **THEN** the Chips tab shows the deterministic candidate windows with an offline indicator, This Week activates no chip, and both tabs still read the same `chipPlan`

### Requirement: Cached and bounded
The orchestrator SHALL be cached per `team:gameweek` and bounded in tokens, and its guidance SHALL be presented as reasoned, grounded advice (chip decisions are sparse / not backtestable), not as a fitted prediction.

#### Scenario: Reuse within a session
- **WHEN** the chip plan is requested again for the same team and gameweek
- **THEN** the cached result is reused (no repeat LLM call)
