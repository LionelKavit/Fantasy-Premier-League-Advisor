## ADDED Requirements

### Requirement: A shared Pocket Scout persona drives the reasoning calls
The four reasoning / user-facing LLM calls SHALL share one persona — Pocket Scout, an FPL analyst with a Premier League post-match pundit's voice — supplied as their `system` instruction, while the team-news extraction call keeps its literal-extraction system.

#### Scenario: The persona is defined once
- **WHEN** the persona is authored
- **THEN** `lib/llm/persona.ts` exports a `SCOUT_PERSONA` identity covering: the Pocket Scout name + pundit voice; reason only from given data and never invent prices/scores/projections/ownership/fixtures (say so if a number is missing); lead with the *why*; think in rank (template vs differential) not just points; be decisive but name the risk; be concise; and respect the exact output format each task requests
- **AND** it contains identity/voice/principles only — no task- or format-specific instructions

#### Scenario: Applied to the four reasoning calls
- **WHEN** the captain, transfer, and long-term syntheses call the LLM
- **THEN** each passes `SCOUT_PERSONA` as its `system` instruction, and its prompt no longer carries a standalone "You are an FPL … advisor" identity line (only its specific task, data, and output format remain)
- **AND** the Scout chat composes `SCOUT_PERSONA` into `buildScoutSystemPrompt` so the agent shares the identity while keeping its tool-use rules

#### Scenario: The extraction call is excluded
- **WHEN** the team-news extraction call runs
- **THEN** it continues to use its literal-extraction system and does NOT include the Pocket Scout persona

#### Scenario: Structured outputs still parse
- **WHEN** a JSON-returning synthesis runs with the persona applied
- **THEN** it still returns valid JSON in the requested shape (the persona defers to each task's format); the e2e flow test confirms parsing is unaffected

#### Scenario: Behaviour unchanged, app build clean
- **WHEN** the change ships
- **THEN** deterministic picks/scores are unchanged (prose-only), and `tsc` / `eslint` / `next build` / `vitest` stay green
