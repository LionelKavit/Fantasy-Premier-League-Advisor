## ADDED Requirements

### Requirement: Long Term tab is structured-only
The Long Term view SHALL show only the structured detail (Transfer Horizon + Chip Strategy); the long-form long-term outlook prose SHALL NOT be rendered.

#### Scenario: No outlook paragraph
- **WHEN** the user opens the Long Term tab in the plan drawer
- **THEN** it shows the Transfer Horizon and Chip Strategy panels, with no multi-paragraph outlook prose above them

### Requirement: Long-term narrative is no longer produced
The system SHALL NOT compute a `longTermNarrative`; the `synthesizeLongTerm` LLM call SHALL be removed and `OptimizerResult` SHALL NOT carry a `longTermNarrative` field.

#### Scenario: No dead LLM call
- **WHEN** the optimizer pipeline runs
- **THEN** it makes the weekly verdict call but not a separate long-term-narrative call (one fewer LLM call per analysis)

#### Scenario: Reasoning unchanged
- **WHEN** the long-term call is removed
- **THEN** the weekly verdict, transfer/hold decision, restructure, horizon, chip windows, and captaincy are byte-for-byte unchanged (the removed call was display-only and never fed any decision)
