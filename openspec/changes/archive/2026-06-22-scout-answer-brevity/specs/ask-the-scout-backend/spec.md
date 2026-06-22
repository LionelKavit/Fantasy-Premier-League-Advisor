## ADDED Requirements

### Requirement: Chat answers are crisp and answer-first
The Scout chat system prompt SHALL instruct the assistant to lead with the direct answer in the first sentence, default to a short reply (about 2–4 sentences / ~90 words), use at most one short list, and avoid stacked multi-paragraph essays — while allowing a longer reply when the user explicitly asks to go deeper. Existing formatting rules (no Markdown tables, no headings, sparing bold, add reasoning rather than restating the on-screen panels) SHALL be preserved.

#### Scenario: Default reply is tight and answer-first
- **WHEN** the manager asks a normal question (e.g. "Why Haaland over Anderson?")
- **THEN** the system prompt directs the assistant to give the verdict in the first sentence and keep the whole reply short, without stacking multiple prose paragraphs

#### Scenario: Depth on request
- **WHEN** the manager explicitly asks the Scout to walk them through or explain in detail
- **THEN** the brevity default does not forbid a longer, fuller answer

#### Scenario: Existing rules preserved
- **WHEN** the system prompt is built
- **THEN** it still forbids Markdown tables and headings, keeps bold sparing, and tells the assistant to add reasoning rather than restate the on-screen panels
