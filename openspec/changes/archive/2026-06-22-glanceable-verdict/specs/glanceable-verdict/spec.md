## ADDED Requirements

### Requirement: Always-visible verdict bar

The system SHALL display a single, always-visible verdict bar above the fold that spans the full width of the pitch and conversation columns and summarises the week's decision in one glance: the transfer call, the captaincy call, and the chip call (e.g. "This week: João Pedro → Saka · Captain Haaland · Hold your chips"). The bar SHALL sit above the pitch and conversation so it is readable without scrolling or expanding any drawer, and SHALL host the "Open FPL Transfers" action at its end.

#### Scenario: Verdict is visible above the fold

- **WHEN** a plan is loaded
- **THEN** a full-width verdict bar summarising the transfer, captain, and chip call is shown above the pitch/conversation, with the "Open FPL Transfers" action, without any interaction

### Requirement: Verdict waits for a final decision

The verdict SHALL reflect only the final decision produced by the insights phase (the optimizer transfer and the LLM-refined captain), never the provisional deterministic base armband. While insights are still computing, the bar SHALL show a single placeholder (e.g. "Preparing this week's verdict…") rather than a partial decision, so a shown transfer or captain never changes mid-flight. Once insights arrive, the bar SHALL render the final verdict, and SHALL NOT subsequently swap a shown decision within the same plan. The verdict's transfer wording SHALL be consistent with the This Week breakdown (same underlying recommendation).

#### Scenario: Insights still computing

- **WHEN** the base plan has painted but the insights phase has not finished
- **THEN** the bar shows the placeholder and the "Open FPL Transfers" action, and shows no provisional transfer or captain

#### Scenario: Verdict appears when insights arrive

- **WHEN** the insights phase finishes with the transfer recommendation and refined captain
- **THEN** the bar replaces the placeholder with the final verdict (transfer, captain, chip) and does not change it again for that plan

#### Scenario: Hold recommendation

- **WHEN** the plan recommends holding the transfer (a roll/hold rather than a move)
- **THEN** the verdict expresses the hold (e.g. "Roll your transfer") rather than implying a move

### Requirement: FPL transfers handoff

The system SHALL provide a primary action — hosted at the end of the verdict bar — that opens the official FPL transfers screen (`https://fantasy.premierleague.com/transfers`) in a new tab with `rel="noopener noreferrer"`, so the manager lands on the screen where the recommended move is executed. The action SHALL be available whenever a plan is loaded, including before LLM insights arrive and in keyless mode. Because FPL exposes no public write API and the transfers URL takes no parameters, the system SHALL hand off only — it SHALL NOT attempt to execute or pre-fill the transfer.

#### Scenario: Manager opens the transfers screen

- **WHEN** a plan is loaded and the manager activates "Open FPL Transfers"
- **THEN** the FPL transfers screen opens in a new browser tab with `rel="noopener noreferrer"`

#### Scenario: Handoff available before insights

- **WHEN** the deterministic base plan has painted but LLM insights have not yet arrived
- **THEN** the "Open FPL Transfers" action is still present and functional
