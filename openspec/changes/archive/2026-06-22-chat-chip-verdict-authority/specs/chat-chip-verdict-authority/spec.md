## ADDED Requirements

### Requirement: Committed chip plan overrides curated knowledge for the chip verdict

In the chat, when a committed `chipPlan` is present, it SHALL be the authoritative chip verdict and the curated knowledge (`chips.md`, `rank-strategy.md`) SHALL be subordinate to it for the chip decision. The chat system prompt SHALL state that the curated principles are general guidance the committed plan has already applied to this squad, and that for the actual chip decision the Scout defers to the plan. The Scout SHALL NOT recommend playing a different chip this gameweek than the plan's play-now chip, and SHALL NOT recommend playing a chip when the plan holds — even when the principles might suggest otherwise.

#### Scenario: Plan plays Bench Boost; chat asked TC vs BB

- **WHEN** the committed plan sets Bench Boost play-now and Triple Captain hold, and the manager asks whether Triple Captain is better
- **THEN** the Scout backs the committed Bench Boost call (explaining its reasoning) and does NOT recommend playing Triple Captain this gameweek instead

#### Scenario: Subordination instruction present alongside knowledge

- **WHEN** the chat system prompt is built with both a committed `chipPlan` and the curated knowledge
- **THEN** the prompt includes an explicit instruction that the committed chip plan is authoritative over the curated principles for the chip decision

### Requirement: Explanation is preserved (authority, not a gag)

The subordination SHALL constrain only the competing chip *verdict*, not discussion. The Scout SHALL still explain chip trade-offs, answer comparative questions, and cite the curated principles to justify the committed call.

#### Scenario: Comparative question still answered

- **WHEN** the manager asks "why Bench Boost over Triple Captain?"
- **THEN** the Scout explains the trade-off and the committed plan's reasoning (and may cite the principles) without issuing a competing recommendation to play a different chip

#### Scenario: No committed chip plan

- **WHEN** no `chipPlan` is supplied to the chat (e.g. keyless or insights unavailable)
- **THEN** the subordination clause is omitted and the chat behaves as before

### Requirement: General chip knowledge remains available

Subordinating the chip verdict SHALL NOT remove the curated knowledge from the chat. General chip-principle and rank/EO questions SHALL still be answered from the curated knowledge.

#### Scenario: General principle question

- **WHEN** the manager asks a general question like "when is a good time to play a Wildcard?"
- **THEN** the Scout answers from the curated chip principles as normal
