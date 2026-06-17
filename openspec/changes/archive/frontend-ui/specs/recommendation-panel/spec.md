## ADDED Requirements

### Requirement: FPL-consistent styling
The panel SHALL sit on a calm neutral surface (so the purple pitch stays the visual anchor) while using FPL accent colors for meaning: `--fpl-green` for positive/buy actions, `--fpl-magenta` for sells/warnings, and FPL-purple headings.

#### Scenario: Action colors are also labelled
- **WHEN** an action is colored (buy green, sell magenta)
- **THEN** it also carries text/icon so meaning does not depend on color alone

### Requirement: Primary recommendation
The panel SHALL present the primary move from `transfers.primaryRecommendation` with its plain-English narrative and a confidence badge.

#### Scenario: Free transfer
- **WHEN** the primary recommendation is a FREE transfer
- **THEN** the panel shows the out→in players, the projected gain, the `narrativeSummary`, and the `confidence`

#### Scenario: Roll
- **WHEN** the primary recommendation is ROLL
- **THEN** the panel communicates "hold your transfer" with the reasoning

#### Scenario: Hit verdict
- **WHEN** `transfers.hitVerdict` is present
- **THEN** the panel shows whether to take a points hit, the reasoning, and the break-even gameweek when available

### Requirement: Captain card
The panel SHALL present the captaincy recommendation from `captaincy`.

#### Scenario: Captain, vice, differential
- **WHEN** captaincy data is present
- **THEN** the panel shows the recommended captain and vice (and the differential option when present), each with a short reason from `whyCaptain`

### Requirement: Alerts
The panel SHALL surface the merged alerts from `plan.alerts`, `transfers.alerts`, and `captaincy.alerts`.

#### Scenario: Actionable alerts shown
- **WHEN** alerts exist (price rise, doubtful player, multiple weak spots, etc.)
- **THEN** they are listed in a dedicated area

#### Scenario: No alerts
- **WHEN** there are no alerts
- **THEN** the alerts area is hidden or shows a calm empty state

### Requirement: AI-offline indication and graceful degradation
The panel SHALL behave well when the LLM synthesis fell back to the deterministic path.

#### Scenario: Synthesis offline
- **WHEN** `confidence === "low"` (missing/failed Claude key)
- **THEN** the panel shows an unobtrusive "AI synthesis offline" indicator AND still presents the deterministic recommendation and picks

#### Scenario: A side failed
- **WHEN** `transfers` or `captaincy` is null
- **THEN** that section shows a soft empty/failed state rather than breaking the panel
