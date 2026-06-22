## ADDED Requirements

### Requirement: Orchestrator grounding names the current half
The orchestrator's prompt SHALL identify which half of the season the current gameweek is in (first half, GW1–19; or second half, GW20–38) so its chip reasons use the correct half label and do not mislabel it.

#### Scenario: Second-half gameweek
- **WHEN** the current gameweek is in the second half (after the first-half expiry gameweek)
- **THEN** the grounding identifies it as the second half (GW20–38), so a reason never calls a chip a "first-half" chip there

#### Scenario: First-half gameweek
- **WHEN** the current gameweek is in the first half (at or before the first-half expiry gameweek)
- **THEN** the grounding identifies it as the first half (GW1–19)
