## ADDED Requirements

### Requirement: Every player row the tools return is tagged with squad membership
`fmtPlayer` SHALL include `owned: "xi" | "bench" | null`, derived from the analysis picks (positions 1–11 ⇒ `xi`, 12–15 ⇒ `bench`, absent ⇒ `null`), on every tool result that returns a player row.

#### Scenario: Owned players tagged
- **WHEN** `score_player` or `search_players` returns a player who is in the manager's 15
- **THEN** the row's `owned` is `xi` or `bench` according to their pick position

#### Scenario: Non-owned players
- **WHEN** a returned player is not in the squad
- **THEN** `owned` is `null`

### Requirement: Transfer-target search excludes owned players by default
`search_players` SHALL accept `excludeOwned` (boolean, default `true`) and SHALL omit squad members from its results unless `excludeOwned` is `false`; its description SHALL state that it finds transfer targets and excludes the manager's own players by default.

#### Scenario: Default search
- **WHEN** `search_players` is called with `position: "FWD"` and no `excludeOwned`
- **THEN** no returned row has `owned` set

#### Scenario: Opt-in to owned players
- **WHEN** `search_players` is called with `excludeOwned: false`
- **THEN** squad members may appear and carry their `owned` tag

### Requirement: The Scout never presents an owned player as a transfer target
The system prompt SHALL instruct that a transfer target is never a player already owned; when an owned player is the better answer the Scout SHALL frame it as a lineup call, not a transfer, and SHALL NOT count that player's price against a transfer budget.

#### Scenario: Prompt rule present
- **WHEN** the manager or demo system prompt is built
- **THEN** it contains a Grounding rule that owned players are never transfer targets and owned-player questions are answered as lineup calls

### Requirement: Recommendations are unchanged
This change SHALL NOT alter any deterministic output: the plan, the optimizer, captaincy, scoring, or the replays.

#### Scenario: Invariance
- **WHEN** `vitest` runs and both research replays are re-run
- **THEN** all tests pass and `report.md` / `transfer-report.md` are byte-identical
