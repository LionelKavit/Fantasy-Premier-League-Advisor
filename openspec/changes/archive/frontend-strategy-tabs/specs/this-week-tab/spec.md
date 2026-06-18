## ADDED Requirements

The "This Week" lens splits across both columns: **left = the scout's written verdict (prose)**, **right = the structured picks**. All content comes from `transfers` and `captaincy` on the `GameweekPlan`. (Alerts are handled by `strategy-tabs` — pinned left, always visible.)

### Requirement: Weekly verdict prose (left column)
The left prose zone SHALL present the LLM-written weekly verdict.

#### Scenario: Narrative + hit reasoning
- **WHEN** the This Week lens is active
- **THEN** the left zone shows `transfers.narrativeSummary` as the headline verdict, followed by the `hitVerdict.reasoning` (and optionally `captaincy.narrativeSummary`)

#### Scenario: AI synthesis offline
- **WHEN** `transfers.confidence === "low"` (or `captaincy.confidence === "low"`)
- **THEN** an unobtrusive "AI synthesis offline" indicator is shown with the deterministic text, and the structured picks are still presented on the right

### Requirement: Transfer move (right column)
#### Scenario: Transfer / roll / hit
- **WHEN** `transfers.primaryRecommendation` is present
- **THEN** the right column shows the compact move (FREE out→in, ROLL, or hit) with a `confidence` badge and a hit-verdict status line ("worth a hit" / "no hit needed" + break-even GW) — the *reasoning paragraph* sits in the left prose, not here

### Requirement: Restructure verdict (right column)
#### Scenario: Options present
- **WHEN** `transfers.restructureOptions` is non-empty
- **THEN** each option renders as a compact chain — "to afford {dreamTarget}: sell {downgradedPlayer} → buy {downgradeReplacement}" — with net score change and total cost

#### Scenario: No options
- **WHEN** `restructureOptions` is empty
- **THEN** the restructure section is hidden

### Requirement: Captaincy with expandable top-5 (right column)
#### Scenario: Headline picks
- **WHEN** `captaincy` is present
- **THEN** the right column shows the captain, vice-captain, and (when present) the differential, each with a short reason from `whyCaptain`

#### Scenario: Expandable top-5
- **WHEN** the user expands "Top 5 captain options"
- **THEN** the top 5 of `captaincy.rankedCandidates` are listed (name + projected captain score), collapsed by default

#### Scenario: Captaincy unavailable
- **WHEN** `captaincy` is null
- **THEN** the section shows a soft empty state rather than breaking

### Requirement: FPL-consistent styling
#### Scenario: Accents are labelled
- **WHEN** actions are colour-coded (buy green, sell magenta)
- **THEN** they also carry text/icon so meaning does not depend on colour alone
