## ADDED Requirements

### Requirement: Long-term verdict synthesis
The system SHALL provide `synthesizeLongTerm(input)` that produces a plain-English long-term verdict from the optimizer's deterministic outputs (`horizon`, `chipPlan`, `restructureOptions`), `chipsRemaining`, `currentGw`, and the manager's risk profile. It returns `string | null`.

#### Scenario: Produces strategic prose
- **WHEN** the API key is available and there is content to summarize (horizon entries and/or chip recommendations)
- **THEN** it returns a short paragraph covering the strongest upcoming transfer target and its timing (BUY_NOW / WAIT / BUY_NOW_SELL_LATER), chip sequencing, and any restructure-toward-a-dream note

#### Scenario: Risk-aware tone
- **WHEN** `riskProfile.rankTrend` is "rising" vs "falling"
- **THEN** the prompt conveys the corresponding posture (protect rank vs chase), so the verdict reads accordingly

#### Scenario: Plain prose, used directly
- **WHEN** the model responds successfully
- **THEN** the response text is used directly as the verdict (no JSON parsing)

#### Scenario: Fail-safe → null
- **WHEN** the API key is missing, the call errors, or the content is empty
- **THEN** it returns `null` (the frontend falls back to the deterministic summary)

#### Scenario: Skip when nothing to plan
- **WHEN** there are no `horizon` entries AND no `chipPlan` recommendations
- **THEN** it skips the LLM call and returns `null` (the deterministic fallback supplies the reasoned empty state)

### Requirement: Parallel synthesis, exposed on the plan
The long-term verdict SHALL be produced as a separate call running concurrently with the weekly synthesis, and surfaced on the plan.

#### Scenario: Two separate calls, concurrent
- **WHEN** the optimizer stage runs
- **THEN** `synthesizeRecommendation` (weekly) and `synthesizeLongTerm` (long-term) run concurrently, and the long-term result is merged onto the `OptimizerResult`

#### Scenario: Field present
- **WHEN** a plan is produced
- **THEN** `transfers.longTermNarrative` is present as `string | null`

#### Scenario: Weekly side unaffected by long-term failure
- **WHEN** `synthesizeLongTerm` fails (or is skipped)
- **THEN** the weekly `narrativeSummary` and the rest of the `OptimizerResult` are unaffected; only `longTermNarrative` is `null`

### Requirement: This-Week verdict references restructure and hits
The weekly synthesis prompt SHALL instruct the model to weave the restructure options and hit verdict into the narrative (the data is already in its input — no new call).

#### Scenario: Restructure / hit referenced
- **WHEN** `restructureOptions` is non-empty or a hit is in play
- **THEN** the weekly `narrativeSummary` references them rather than covering only the single transfer
