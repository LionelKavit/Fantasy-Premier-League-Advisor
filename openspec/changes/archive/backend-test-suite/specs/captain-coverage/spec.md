## ADDED Requirements

### Requirement: Captain scoring coverage
#### Scenario: Ceiling beats floor
- **WHEN** an explosive attacker and a high-floor defender have equal transfer composite scores
- **THEN** the attacker's captain score is higher

#### Scenario: Minutes-certainty gate
- **WHEN** a player is injured/suspended/unavailable, or doubtful with low chance, or a nailed-on starter
- **THEN** minutes certainty is 0 for the unavailable, well below 1 for the doubtful, and at/near 1 for the nailed-on — and the gate multiplies the whole score

#### Scenario: Fixture and DGW multipliers
- **WHEN** scoring an easy home fixture vs a hard away fixture, and a single fixture vs a double
- **THEN** the fixture multiplier is >1 vs <1 (clamped to bounds) and the DGW multiplier (1–2, discounted by the weaker fixture) makes a moderate DGW player outrank a stronger single-fixture player

#### Scenario: Blank gameweek
- **WHEN** a player's team has no fixture in the target gameweek
- **THEN** the captain score total is 0

#### Scenario: Starting XI only
- **WHEN** batch scoring a 15-player squad
- **THEN** only the 11 starters (pick positions 1–11) are scored

### Requirement: Captain ranking and selection coverage
#### Scenario: Rank and tiebreak
- **WHEN** candidates have differing and tied captain scores
- **THEN** they sort by total descending, breaking ties on minutes certainty then fixture multiplier

#### Scenario: Vice avoids the captain's match
- **WHEN** selecting the vice-captain
- **THEN** it is the highest-ranked candidate not sharing the captain's fixture; if all others share it, the next-highest is used as last resort

#### Scenario: Differential surfacing
- **WHEN** a low-owned candidate scores within the differential band of the top pick, and when none does
- **THEN** a differential option is returned, or null respectively

#### Scenario: Single viable candidate
- **WHEN** only one candidate has non-zero minutes certainty
- **THEN** it is the captain and vice/differential are null

### Requirement: Captain horizon coverage
#### Scenario: Per-GW best and DGW peak
- **WHEN** computing the horizon over upcoming gameweeks including a DGW
- **THEN** each entry's best captain is the top-scorer for that GW and the DGW entry is flagged with a higher best score

#### Scenario: End of season
- **WHEN** fewer than the horizon length of gameweeks remain
- **THEN** only the remaining gameweeks are produced

### Requirement: Triple-captain advice coverage
#### Scenario: Recommend, hold, and unavailable
- **WHEN** a horizon peak exceeds the baseline margin, does not exceed it, or the chip is unavailable
- **THEN** advice is recommended (with target GW/player), hold, or unavailable respectively

> Note: the captain↔optimizer triple-captain coherence assertions migrated from `tc-coherence` also exercise this advice feeding the optimizer chip node.

### Requirement: Captain synthesis coverage (mocked LLM)
#### Scenario: Success path and risk bias
- **WHEN** the Claude mock returns a valid choice and the manager profile is rank-rising vs rank-falling
- **THEN** the chosen captain is mapped from candidates, confidence is clamped, and the prompt/selection reflects template vs differential bias

#### Scenario: Fail-safe
- **WHEN** the mock errors/malformed or the key is unset
- **THEN** the top-ranked candidate is returned with confidence "low" and a synthesis-failed alert

#### Scenario: Computed alerts
- **WHEN** the chosen captain is doubtful, or a triple-captain window is within two gameweeks
- **THEN** the corresponding alerts are present regardless of LLM outcome
