## ADDED Requirements

### Requirement: The Scout's Verdict adds insight beyond the structured panel
The verdict prose (this-week `narrativeSummary` + `hitVerdict.reasoning`, and the long-term narrative) SHALL explain reasoning and non-obvious context, not restate the recommendations already shown as structured chips/rows in the right panel.

#### Scenario: Reasoning over restatement
- **WHEN** the LLM synthesizes the verdict and a transfer / restructure / captain pick is already displayed structurally
- **THEN** the prose does **not** simply re-list those moves; it explains **why** this option beats the alternatives, the key trade-off or risk, and context the raw numbers don't show (e.g. form-vs-underlying, fixture swing, ownership/template, timing)

#### Scenario: Concise and complementary
- **WHEN** the verdict is generated
- **THEN** it is 2–4 sentences that complement the panel — adding value a reader couldn't get by glancing at the chips

#### Scenario: Offline fallback unchanged
- **WHEN** no API key is available
- **THEN** the deterministic fallback summaries are used as before (this requirement targets the LLM path)
