## ADDED Requirements

### Requirement: Long-Term tab prefers the LLM verdict, falls back to deterministic
The Long-Term lens's left prose SHALL render `transfers.longTermNarrative` when present, and otherwise the deterministic `buildLongTermSummary(plan)`.

#### Scenario: LLM verdict present
- **WHEN** `transfers.longTermNarrative` is a non-null string
- **THEN** the Long-Term left prose renders it (split into paragraphs as needed)

#### Scenario: Fallback when null
- **WHEN** `longTermNarrative` is `null` (offline, error, or nothing to plan)
- **THEN** the left prose renders the existing client-side deterministic summary (`buildLongTermSummary`), preserving the reasoned empty states

### Requirement: This-Week rendering unchanged
#### Scenario: Weekly verdict still rendered
- **WHEN** the This-Week lens is active
- **THEN** the left prose still renders `transfers.narrativeSummary` (+ hit reasoning) exactly as before

### Requirement: Offline indicator preserved
#### Scenario: AI-offline chip
- **WHEN** `transfers.confidence === "low"` (LLM unavailable)
- **THEN** the "AI synthesis offline" indicator still shows; the Long-Term tab transparently uses the deterministic summary
