## ADDED Requirements

### Requirement: Chat answers render as formatted text, never raw markup
Assistant replies in the Ask The Scout panel SHALL render a constrained Markdown subset so the user never sees literal markup characters.

#### Scenario: Bold and lists render
- **WHEN** the model returns `**bold**` or a `-` bullet list
- **THEN** the bubble shows actual bold text and a formatted list — not literal `**` or `-` characters

#### Scenario: No raw tables in the column
- **WHEN** the model returns a Markdown table
- **THEN** it renders as a compact formatted table (not raw `|` pipes); and the system prompt instructs the model to **avoid tables** in favour of prose/bullets so this is rare

#### Scenario: User messages stay literal
- **WHEN** a user message is displayed
- **THEN** it renders as plain text (the manager's own words are not Markdown-parsed)

### Requirement: Scout output is shaped by a dedicated instruction module
The Scout's system prompt SHALL live in its own module (`lib/scout/system-prompt.ts`) and specify how to format for the chat surface.

#### Scenario: Formatting guidance present
- **WHEN** the system prompt is built for a chat turn
- **THEN** it instructs: concise prose with optional short bullet lists, **no Markdown tables**, sparing bold for key figures, and to **complement the on-screen panels rather than restate raw data**

### Requirement: Interim reasoning is separated from the final answer
Tool-preamble text streamed before a tool call SHALL NOT be concatenated into the committed answer.

#### Scenario: Preamble does not merge into the answer
- **WHEN** the Scout streams "Let me check…" before calling a tool, then streams the final answer
- **THEN** the committed assistant message reads as a clean answer — the preamble is suppressed or visually subordinate, with tool progress conveyed by the status chip
