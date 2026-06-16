## ADDED Requirements

### Requirement: Synthesize recommendation
The system SHALL provide a `synthesizeRecommendation(inputs: SynthesisInput): Promise<OptimizerResult>` function that calls the Claude API to reason about all parallel node outputs and produce a coherent, actionable recommendation.

### Requirement: Claude prompt structure
The system SHALL construct a prompt with:
1. **Role:** "You are an FPL transfer advisor analyzing GW{N} options for a manager ranked {rank}."
2. **Context:** Risk profile summary (rank trend, GWs remaining, hit history, knee-jerk rate), chips remaining, bank, free transfers available.
3. **Data:** All node outputs as structured JSON — single transfer result, hit transfer result, restructure options, horizon projections, chip recommendations.
4. **Instructions:** "Evaluate conflicts between recommendations. Consider the manager's risk tolerance. Sequence chip usage optimally. Output JSON matching the OptimizerResult schema exactly."
5. **Output schema:** The exact `OptimizerResult` JSON schema with field descriptions and valid enum values.

#### Scenario: Prompt includes risk context
- **WHEN** the manager has rankTrend "rising", totalHitsTaken 2, gwsRemaining 15
- **THEN** the prompt conveys this is a cautious manager with time remaining

### Requirement: Secondary recommendation
The synthesis node SHALL produce a `secondaryRecommendation` as a plan for the following gameweek.

#### Scenario: Roll leads to strong next week
- **WHEN** the primary recommendation is ROLL (no transfer this week)
- **THEN** secondaryRecommendation is the best ValidTransfer for next week, framed as a FREE transfer with 2 banked free transfers

#### Scenario: Free transfer used — next week plan
- **WHEN** the primary recommendation uses 1 free transfer AND freeTransfers was 1
- **THEN** secondaryRecommendation is the next best ValidTransfer targeting a different weak player (if one has positive gw5Gain), as a look-ahead for next week's single free transfer

#### Scenario: Horizon informs secondary
- **WHEN** a horizon entry has timing "WAIT" (no immediate gain but positive 5-GW outlook)
- **THEN** secondaryRecommendation may suggest that transfer for next week, citing the horizon data

#### Scenario: No useful secondary
- **WHEN** no valid transfer with positive gw5Gain exists beyond the primary
- **THEN** secondaryRecommendation is null

### Requirement: Conflict resolution
#### Scenario: Immediate vs. horizon conflict
- **WHEN** the single-transfer node recommends player A (best gw1Gain) but the horizon comparator classifies player A as "BUY_NOW_SELL_LATER" and player B as "BUY_NOW"
- **THEN** the synthesis node weighs the tradeoff and picks one, explaining the reasoning in narrativeSummary

#### Scenario: Risk-averse manager
- **WHEN** managerProfile.riskProfile.rankTrend is "rising" AND totalHitsTaken < 3
- **THEN** the synthesis should bias toward ROLL or free transfer over hits
- **AND** confidence is "high" if the recommendation clearly aligns with the risk profile

#### Scenario: Risk-seeking manager
- **WHEN** rankTrend is "falling" AND gwsRemaining < 10
- **THEN** the synthesis should be more willing to recommend hits and wildcards
- **AND** narrativeSummary should acknowledge the aggressive posture

#### Scenario: Chip sequencing
- **WHEN** wildcard and benchBoost are both recommended
- **THEN** the synthesis orders them (e.g., "Wildcard GW20, Bench Boost DGW22") and explains the sequencing logic in narrativeSummary and chipPlan

### Requirement: Fail-safe when API call fails
#### Scenario: API error
- **WHEN** the Claude API call fails or times out
- **THEN** return a valid OptimizerResult with:
  - primaryRecommendation = TransferAction built from singleResult.bestSingle (type "FREE") or a ROLL action if bestSingle is null
  - secondaryRecommendation = null
  - hitVerdict = { recommended: false, reasoning: "LLM synthesis unavailable" }
  - chipPlan = raw chip node output (unmodified)
  - restructureOptions = raw restructure output
  - horizon = raw horizon output
  - confidence = "low"
  - narrativeSummary = "Automated recommendation without AI synthesis. Review manually."
  - alerts = ["LLM synthesis failed: {error message}"]

#### Scenario: Missing API key
- **WHEN** ANTHROPIC_API_KEY environment variable is not set
- **THEN** use the same fail-safe behavior as API error
- **AND** log a warning

### Requirement: Response validation
#### Scenario: Valid response
- **WHEN** Claude returns valid JSON matching the OptimizerResult schema
- **THEN** parse and return it

#### Scenario: Malformed response
- **WHEN** Claude returns JSON that fails schema validation
- **THEN** treat as API failure and use the fail-safe response
- **AND** log a parsing error with the raw response

#### Scenario: Non-JSON response
- **WHEN** Claude returns text that is not valid JSON
- **THEN** treat as API failure and use the fail-safe response

### Requirement: Alerts generation
The synthesis node SHALL include alerts for actionable situations:

#### Scenario: Price rise imminent
- **WHEN** a recommended candidate has transferMomentum > 0.7
- **THEN** alerts includes "Price rise likely for {playerName} — act before deadline"

#### Scenario: Player flagged doubtful
- **WHEN** a squad player has availability status "doubtful" with chanceOfPlayingNext ≤ 50
- **THEN** alerts includes "{playerName} flagged doubtful ({chance}% chance of playing)"

#### Scenario: Multiple weak spots share position
- **WHEN** 2 or more of the weakest 3 are the same position (e.g., both MID)
- **THEN** alerts includes "Multiple weak spots at {position} — consider prioritizing this area"

### Requirement: Narrative summary
The narrativeSummary SHALL be 2–4 sentences of plain English explaining:
1. What action to take and why
2. The key data point(s) driving the recommendation
3. Any relevant chip or horizon context

#### Scenario: Narrative example
- **WHEN** the recommendation is a free transfer of Groß → Wilson
- **THEN** narrativeSummary might read: "Transfer out Groß for Wilson (£5.8m). Wilson's form (6.2 PPG) and favorable fixtures (FDR 2.0 avg) make him the strongest upgrade. With your rank trending upward, there's no need to take a hit this week."
