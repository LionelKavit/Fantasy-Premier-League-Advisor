## ADDED Requirements

### Requirement: A dedicated Chips tab
The plan drawer SHALL expose three lenses — **This Week**, **Long Term**, **Chips** — and chip strategy SHALL live under Chips, not Long Term.

#### Scenario: Three tabs
- **WHEN** the plan drawer is open
- **THEN** its tab bar shows This Week, Long Term, and Chips

#### Scenario: Chips holds the chip strategy
- **WHEN** the user selects the Chips tab
- **THEN** it shows the chip timeline, chips remaining, and the recommended chip windows (the content previously under Long Term's "Chip strategy")

#### Scenario: Long Term keeps only the horizon
- **WHEN** the user selects the Long Term tab
- **THEN** it shows only the Transfer Horizon (the Chip strategy block no longer appears there)

#### Scenario: Wildcard draft stays in This Week
- **WHEN** the recommendation is to play a Wildcard/Free Hit
- **THEN** the resulting transfer draft remains in the This Week transfer section (only the chip timeline/timing lives under Chips)
