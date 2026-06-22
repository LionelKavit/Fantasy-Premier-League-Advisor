## ADDED Requirements

### Requirement: Transfer moves grouped by out-player
The This Week transfer section SHALL render one line per out-player, listing that player's candidate replacements together, rather than a separate line per `out → candidate` pair.

#### Scenario: Multiple candidates for one out-player
- **WHEN** a recommendation (e.g. a Wildcard) offers several candidates for the same out-player
- **THEN** they appear on a single line as `Out → cand1 / cand2 / cand3`, candidates ordered by projected gain and capped to the top three

#### Scenario: Single transfer unchanged
- **WHEN** the recommendation is a single move (one out-player, one candidate)
- **THEN** the line renders as `Out → In` exactly as before

#### Scenario: Strongest moves lead
- **WHEN** several out-players are listed
- **THEN** they are ordered by their best candidate's projected gain (highest first)

#### Scenario: Display-only
- **WHEN** the moves are grouped
- **THEN** it is a presentation transform over the existing recommended transfers — the optimizer's chosen transfers and the hit verdict / restructure / captaincy sections are unchanged
