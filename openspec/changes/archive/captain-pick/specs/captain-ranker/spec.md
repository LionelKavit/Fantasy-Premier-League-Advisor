## ADDED Requirements

### Requirement: Rank captain candidates
The system SHALL provide a `rankCaptains(candidates: CaptainCandidate[]): CaptainCandidate[]` function that sorts the starting-XI candidates by `captainScore.total` descending.

#### Scenario: Highest score is captain
- **WHEN** candidate A has captainScore.total 0.82 and all others are lower
- **THEN** A is first in the ranked list and is the recommended captain

#### Scenario: Tiebreaker
- **WHEN** two candidates have equal captainScore.total
- **THEN** prefer the one with the higher minutesCertainty, then the easier fixtureMultiplier

### Requirement: Select captain and vice-captain
The system SHALL provide a `selectCaptaincy(ranked: CaptainCandidate[]): { captain, viceCaptain, differentialOption }` function.

#### Scenario: Captain is top pick
- **WHEN** the ranked list is non-empty
- **THEN** captain is `ranked[0]`

#### Scenario: Vice-captain avoids same match
- **WHEN** selecting the vice-captain
- **THEN** it is the highest-ranked candidate OTHER than the captain whose fixture is not the same match as the captain's (so one postponement cannot wipe out both)
- **AND** if every other candidate shares the captain's match, the next-highest candidate is used as a last resort

#### Scenario: Differential option surfaced
- **WHEN** a candidate beyond the captain has `isDifferential` true and a captainScore within a configurable band of the top pick
- **THEN** it is returned as `differentialOption`
- **AND** if no such candidate exists, `differentialOption` is null

#### Scenario: Single viable candidate
- **WHEN** only one candidate has minutesCertainty above 0
- **THEN** captain is that candidate, viceCaptain is null, differentialOption is null

### Requirement: Effective ownership and differential flag
The system SHALL compute effective ownership for each candidate and flag differentials.

#### Scenario: Template captain
- **WHEN** a candidate has very high selected-by / captaincy share
- **THEN** isDifferential is false (a template, rank-protecting captain)

#### Scenario: Differential captain
- **WHEN** a candidate's effective ownership is below the differential threshold AND captainScore is high
- **THEN** isDifferential is true

### Requirement: Captain reasons
The ranker SHALL populate `whyCaptain` for the top candidates with human-readable drivers.

#### Scenario: Reason content
- **WHEN** a candidate is a penalty-taking forward at home in a DGW
- **THEN** whyCaptain includes the penalty duty, the favorable home fixture(s), and the double gameweek
