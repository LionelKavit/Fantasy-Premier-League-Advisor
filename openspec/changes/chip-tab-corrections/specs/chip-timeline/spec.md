## ADDED Requirements

### Requirement: Chips tab presents a reasons list without a gameweek axis
The Chips tab SHALL present the chip plan as the chips-left row plus a reasons list, with the play-now entry highlighted, and SHALL NOT render a gameweek-axis chip-marker visual.

#### Scenario: Plan with scheduled chips
- **WHEN** the chip plan has one or more entries
- **THEN** the Chips tab shows the chips-left row and the reasons list (play-now highlighted) and shows no gameweek-axis markers

#### Scenario: Play-now is legible without the axis
- **WHEN** a chip is scheduled play-now this gameweek
- **THEN** it is distinguished in the reasons list (so removing the axis loses no information)
