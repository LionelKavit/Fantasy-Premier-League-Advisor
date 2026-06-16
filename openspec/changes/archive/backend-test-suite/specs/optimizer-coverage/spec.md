## ADDED Requirements

### Requirement: Setup node coverage
#### Scenario: Budget, club rule, availability
- **WHEN** validating transfers that pass budget, fail budget, sit within/at/over the 3-per-club limit (including sell-frees-slot), or target injured/suspended/unavailable players
- **THEN** each returns the documented valid result or null

#### Scenario: Supplied gains used, fallback otherwise
- **WHEN** `validateTransfer` is called with explicit gains vs without
- **THEN** it uses the supplied gains when given, else the composite-diff fallback; `scoreDiffPct` handles a zero weak score

### Requirement: Single transfer coverage
#### Scenario: ROLL when no improvement
- **WHEN** all valid transfers have non-positive gw1Gain
- **THEN** `bestSingle` is null and a ROLL reason is returned

#### Scenario: Best, alternatives, savings, tiebreak
- **WHEN** several positive transfers exist
- **THEN** the top gw1Gain is best, the next three are alternatives, the savings option matches the price/gain rule, and ties break on gw5Gain

#### Scenario: Second free transfer with budget cascade
- **WHEN** two free transfers are available and the best transfer frees budget
- **THEN** `bestSecond` targets a different weak player and may be a transfer unlocked only by the freed budget (re-validated against the adjusted bank)

### Requirement: Hit transfer coverage
#### Scenario: Single hit threshold and break-even
- **WHEN** the best additional transfer exceeds/does-not-exceed the −4 threshold
- **THEN** a single-hit recommendation is returned with correct net gain and break-even, or null

#### Scenario: Double-hit budget chain and ordering
- **WHEN** a pair requires the first sale's funds to afford the second
- **THEN** the budget chain is simulated, both orderings are tried, and the higher-net ordering is chosen; pairs that never afford are rejected

#### Scenario: Club rule after both moves and shared weak player
- **WHEN** two hit transfers both buy into the same club, or both target the same weak player
- **THEN** the post-both club count is enforced (≤3) and same-weak-player pairs are rejected

#### Scenario: Excludes free-transfer picks
- **WHEN** the single-transfer node already consumed transfers as free
- **THEN** the hit node does not re-recommend those as paid hits

### Requirement: Restructure coverage
#### Scenario: Viable sell-to-fund chain
- **WHEN** a dream target needs funds and a rank 4–12 downgrade frees enough while keeping net score positive
- **THEN** the option is returned with correct net score change and the top 3 are sorted by it

#### Scenario: Exclusions
- **WHEN** the only funding would come from a top-3 or weakest-3 player, or net score change is ≤0, or no replacement scores ≥ the floor
- **THEN** no option is produced

#### Scenario: Total cost by free transfers
- **WHEN** a 2-transfer restructure runs with 1 vs 2 free transfers
- **THEN** total cost is 4 vs 0 respectively

### Requirement: Horizon coverage
#### Scenario: Timing classifications
- **WHEN** cumulative gains are positive-now/positive-later, non-positive-now/positive-later, or positive-now/non-positive-later
- **THEN** timing is BUY_NOW, WAIT, or BUY_NOW_SELL_LATER respectively

#### Scenario: Fixture swing and end-of-season
- **WHEN** per-GW gain changes sign within the window, and when fewer than 5 GWs remain
- **THEN** `fixtureSwing` is true and the cumulative array is padded to length 5 with the last value

### Requirement: Chip interaction coverage
#### Scenario: Each trigger fires on its condition
- **WHEN** synthetic states meet the wildcard (≥3 beneficial), free-hit (BGW with ≥3 blanks), bench-boost (DGW within 3, bench avg >0.40), and triple-captain (advice or DGW heuristic) conditions
- **THEN** the corresponding chip is recommended; otherwise it is not

#### Scenario: Conflict resolution and empty chips
- **WHEN** wildcard and bench-boost trigger in the same window, and when no chips remain
- **THEN** wildcard is preferred (bench-boost deferred to the next DGW) and an empty list is returned with no chips

### Requirement: Synthesis coverage (mocked LLM)
#### Scenario: Success path parsed and mapped
- **WHEN** the Claude mock returns a valid OptimizerResult JSON
- **THEN** the recommendation is parsed, transfer actions are mapped from node outputs, confidence is clamped to the allowed set, and computed alerts are merged

#### Scenario: Parse failure and API error fall back
- **WHEN** the mock returns malformed JSON or a non-200 status, or the key is unset
- **THEN** the deterministic fail-safe is returned (best single or ROLL, confidence "low", a synthesis-failed alert)

#### Scenario: Computed alerts independent of LLM
- **WHEN** a candidate has high transfer momentum, a squad player is doubtful, or multiple weak spots share a position
- **THEN** the corresponding alerts are present regardless of LLM success/failure
