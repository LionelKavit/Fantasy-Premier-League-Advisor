## ADDED Requirements

### Requirement: Chat is grounded in the committed chip plan
The Scout chat SHALL be grounded in the same chip plan the panels display (the orchestrator's `chipPlan`), supplied with the request, and SHALL treat that plan's chip decisions as authoritative — explaining and defending them rather than re-deriving a different chip verdict. When no chip plan is supplied, the chat behaves as before.

#### Scenario: Chat backs the panels' chip verdict
- **WHEN** the manager asks which chip to play (or about chip timing) and a chip plan is supplied with the request
- **THEN** the system prompt presents that plan as authoritative and instructs the assistant to explain and defend it, so the chat's chip recommendation matches This Week and the Chips tab

#### Scenario: Pushback surfaces the plan's reasoning
- **WHEN** the manager disagrees with the chip plan
- **THEN** the assistant surfaces the plan's reasoning rather than asserting a contradicting chip verdict

#### Scenario: No chip plan supplied
- **WHEN** the request carries no chip plan (e.g. keyless or insights unavailable)
- **THEN** no chip-plan grounding is added and the chat behaves exactly as before

#### Scenario: Slim payload
- **WHEN** the chip plan is sent with the request
- **THEN** it carries only the chip, status, gameweek, and reason (not the transfer draft)
