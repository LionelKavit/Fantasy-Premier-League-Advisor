## ADDED Requirements

### Requirement: Alerts are deterministic, high-risk risk flags
The Alerts surface SHALL show only a small, code-authored (no-LLM) set of high-risk events the manager might overlook elsewhere. Free-form LLM-authored alerts (`raw.alerts`) and advisory/strategic lines SHALL NOT appear.

#### Scenario: Curated risk types only
- **WHEN** alerts are computed for a squad
- **THEN** they are drawn only from: a **starting-XI** player flagged doubtful/injured/suspended (or below a chance-of-playing threshold), an **imminent price change** on an owned player or a recommended target, or a **suspension risk** — each as a deterministic template string filled from the data

#### Scenario: No LLM, no invented figures
- **WHEN** an alert names a number (chance to play, price direction)
- **THEN** it comes straight from the squad/market data (no model call, no invented values)

#### Scenario: LLM and advisory lines are excluded
- **WHEN** the syntheses produce free-form `raw.alerts` or advisory items (e.g. "multiple weak spots at FWD", chip-usage reminders, "template captaincy is paramount", "final gameweek" commentary)
- **THEN** none of them appear in the Alerts surface (that judgment lives in the brief / This Week / chip panels)

### Requirement: Severity-ordered, deduped, capped
Alerts SHALL be de-duplicated, ordered by severity (captain/vice availability first), and capped to a small number (~4).

#### Scenario: Capped and ordered
- **WHEN** more than ~4 risks qualify
- **THEN** the most severe ~4 are shown (captain/vice availability ranks highest), with no near-duplicates

### Requirement: System notices preserved
Genuine system/degradation notices SHALL still surface.

#### Scenario: AI offline
- **WHEN** the LLM layer is unavailable (e.g. no API key, synthesis failure)
- **THEN** the corresponding notice (e.g. "AI synthesis unavailable") still appears — it is not a redundant strategy line

### Requirement: Empty state shows a note
The Alerts card SHALL always render; when no curated alert qualifies it SHALL show a brief note rather than disappearing.

#### Scenario: Nothing to flag
- **WHEN** no risk alert and no system notice qualifies
- **THEN** the card renders a muted line such as "No alerts — nothing flagged that isn't already covered above" (the card does not return null / vanish)
