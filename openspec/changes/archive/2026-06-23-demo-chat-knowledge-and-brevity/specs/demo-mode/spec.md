## ADDED Requirements

### Requirement: The demo chat is grounded in current FPL rules
The demo chat SHALL be supplied a curated, current FPL rules reference so it answers rules/scoring/chip questions from that reference rather than from the model's (possibly stale) training knowledge.

#### Scenario: A curated rules file exists and is injected
- **WHEN** the demo chat system prompt is built
- **THEN** a curated FPL rules knowledge file (`lib/knowledge/rules.md`, covering squad composition, scoring including the defensive-contribution rule, transfers, chips and the two-halves set, and season structure) is loaded and included
- **AND** it is dated so a future rule change is a visible maintenance task

#### Scenario: The chat defers to the supplied rules
- **WHEN** a visitor asks about an FPL rule, scoring, transfer mechanics, or chips
- **THEN** the Scout answers from the supplied current rules and does not contradict them with stale assumptions

#### Scenario: Missing rules file degrades gracefully
- **WHEN** the rules file cannot be read
- **THEN** the system prompt still builds (the rules block is simply empty) and the chat does not error

### Requirement: The demo chat uses the Scout persona with a demo-tuned system prompt
The demo chat SHALL use the same Scout persona as the rest of the app, with a demo-specific system prompt that overrides any "real squad / one manager" framing.

#### Scenario: Same persona, demo framing
- **WHEN** the demo chat system prompt is built
- **THEN** it includes the shared `SCOUT_PERSONA`
- **AND** it explicitly establishes this is a sample squad with no manager (overriding the persona's "their real squad" close), so the Scout never refers to "your team", a rank, or held chips

#### Scenario: Off-season honesty
- **WHEN** the squad and data reflect a finished season (off-season)
- **THEN** the prompt instructs the Scout to make clear it is reasoning off last season's data rather than a live projection

### Requirement: Demo chat responses are brief to conserve tokens
The demo chat SHALL be tuned for conservative token usage, distinct from the manager chat.

#### Scenario: Lower output cap for demo
- **WHEN** a demo chat turn is generated
- **THEN** it uses a lower `max_tokens` ceiling than the manager chat

#### Scenario: Tighter brevity guidance
- **WHEN** the demo system prompt specifies response format
- **THEN** it asks for a markedly shorter answer than the manager chat (around two sentences), while still leading with the direct answer

#### Scenario: Brevity does not bypass grounding
- **WHEN** a demo answer needs a real number (a score, price, or projection)
- **THEN** the Scout still calls its tools to fetch it rather than guessing to save space

### Requirement: The demo chat uses prompt caching with a shared, stable prefix
The demo chat SHALL use prompt caching, and its cached system prefix SHALL be constant across visitors so the cache is shared rather than per-session.

#### Scenario: Caching is applied
- **WHEN** a demo chat turn runs
- **THEN** the system prompt and the conversation tail are marked for caching (as the manager chat already does)

#### Scenario: The demo system prefix is visitor-independent
- **WHEN** the demo system prompt is built for any visitor
- **THEN** it contains no per-request variability (e.g. it does not embed the gameweek number or any per-visitor data), so the cached prefix is byte-identical across visitors and can be shared

#### Scenario: The prefix clears the cache floor
- **WHEN** the demo system prefix is assembled (persona + rules + chips/rank + format)
- **THEN** it is large enough to exceed the model's minimum cacheable prefix size, so caching reliably engages
