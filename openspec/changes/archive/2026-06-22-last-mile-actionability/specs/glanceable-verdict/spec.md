## ADDED Requirements

### Requirement: Always-visible verdict bar

The system SHALL display a single, always-visible verdict bar above the fold that spans the full width of the pitch and conversation columns and summarises the week's decision in one glance: the transfer call, the captaincy call, and the chip call (e.g. "This week: João Pedro → Saka · Captain Haaland · Hold your chips"). The bar SHALL sit above the pitch and conversation so it is readable without scrolling or expanding any drawer, and SHALL host the "Open FPL Transfers" action at its end.

#### Scenario: Verdict is visible above the fold

- **WHEN** a plan is loaded
- **THEN** a full-width verdict bar summarising the transfer, captain, and chip call is shown above the pitch/conversation, with the "Open FPL Transfers" action, without any interaction

### Requirement: Deterministic-first verdict

The verdict SHALL be derived deterministically from the committed `GameweekPlan` so it is correct during the base phase, before LLM insights arrive, and in keyless mode. When a part of the decision is not yet available (e.g. captaincy before insights), the verdict SHALL render the parts it has rather than blocking, and SHALL update in place when the remaining parts arrive. The verdict's transfer wording SHALL be consistent with the This Week breakdown (same underlying recommendation).

#### Scenario: Base phase, captaincy not yet computed

- **WHEN** the deterministic base plan has painted but captaincy insights have not yet arrived
- **THEN** the verdict shows the available parts (e.g. the transfer/hold call) and indicates captaincy is pending rather than showing nothing

#### Scenario: Verdict updates when insights arrive

- **WHEN** LLM insights arrive and refine captaincy
- **THEN** the verdict line updates in place to reflect the refined captain without a separate user action

#### Scenario: Hold recommendation

- **WHEN** the plan recommends holding the transfer (a roll/hold rather than a move)
- **THEN** the verdict expresses the hold (e.g. "Roll your transfer") rather than implying a move
