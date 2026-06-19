## ADDED Requirements

### Requirement: The dashboard renders progressively
The dashboard SHALL paint the squad/pitch and header as soon as the base phase resolves, then fill in the LLM-derived verdict and detail when insights arrive — without a full-screen blocking loader.

#### Scenario: Pitch paints before insights
- **WHEN** a manager is loaded
- **THEN** the header, pitch (with the deterministic captain armband), and alerts render from the base phase first — the page does not wait for the LLM syntheses to show anything

#### Scenario: Insights region shows a step-aware analyzing indicator
- **WHEN** the base has rendered but insights are still loading
- **THEN** the Scout's Verdict and the This Week / Long Term detail panels show a tasteful "Scout is analyzing…" indicator (conveying progress), not a blank/"unavailable" state and not a full-screen spinner

#### Scenario: Insights merge in on arrival
- **WHEN** the insights phase resolves
- **THEN** the verdict, transfer/restructure/captaincy detail, and any refined captain flags appear in place, replacing the analyzing indicator

#### Scenario: Re-analyze refreshes
- **WHEN** the user clicks Re-analyze
- **THEN** the plan recomputes fresh (cache bypassed) and the analyzing indicator shows again while insights regenerate
