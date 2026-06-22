## ADDED Requirements

### Requirement: Chat knows the manager's held, expiring chips
The chat system prompt SHALL list the manager's held chips and the gameweek they expire, and SHALL instruct the assistant that a held chip is use-it-or-lose-it near its deadline — in particular that a held Wildcard makes unlimited transfers at no points cost, so when the manager weighs a points hit for extra moves and holds an (expiring) Wildcard, the assistant points out the Wildcard does it for free, while still leading with the optimal recommendation. When no chips are held, no such grounding is added.

#### Scenario: Held chips and expiry are surfaced
- **WHEN** the chat prompt is built and the manager holds one or more chips
- **THEN** the prompt lists those chips and the gameweek they expire

#### Scenario: Wildcard offered as a free alternative to a hit
- **WHEN** the manager weighs a points hit to make extra moves and holds an (expiring) Wildcard
- **THEN** the assistant notes the Wildcard makes those moves for free (a better option than a −4 hit), while still leading with the optimal recommendation and not urging a chip be spent merely to avoid losing it

#### Scenario: No chips held
- **WHEN** the manager holds no chips
- **THEN** no held-chip grounding is added and the chat behaves as before
