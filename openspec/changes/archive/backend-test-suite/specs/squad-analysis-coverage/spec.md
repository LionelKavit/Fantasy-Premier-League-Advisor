## ADDED Requirements

### Requirement: Normalization coverage
#### Scenario: In-range, clamp, and inverted
- **WHEN** `normalizeSignal` and `normalizeInverted` receive values below min, above max, at the bounds, and in between
- **THEN** outputs are clamped to [0,1], inverted signals decrease as input rises, and min===max is handled without NaN/divide-by-zero

### Requirement: Statistical signals coverage
#### Scenario: Zero-minutes player
- **WHEN** a player has 0 minutes
- **THEN** all statistical signals are 0 (no divide-by-zero on per-90 math)

#### Scenario: Suspension thresholds across boundaries
- **WHEN** computing suspension risk just before GW19, between GW19–32, and after GW32, at yellow-card counts adjacent to the ban thresholds
- **THEN** risk escalates at the documented proximities and a red card raises it by the configured penalty (clamped to 1)

#### Scenario: Set-piece and value components
- **WHEN** a player is the primary penalty/corner/free-kick taker, or has zero price
- **THEN** set-piece value reflects the duties and value score handles price 0 without error

### Requirement: Trend analysis coverage
#### Scenario: Insufficient history
- **WHEN** fewer than the minimum gameweeks of history are available
- **THEN** trend classification degrades safely (no false BUY/SELL) per the configured minimum

#### Scenario: Rising, falling, and overperformance
- **WHEN** history shows a rising xG slope, a falling slope, or goals far exceeding xG
- **THEN** classification returns BUY/HIDDEN_GEM_BUY, SELL/SELL_RISK, or HOLD with the corresponding additive

### Requirement: Fixture signals coverage
#### Scenario: No upcoming fixtures
- **WHEN** a player's team has no upcoming fixtures
- **THEN** the documented default fixture signals are returned (worst-case FDR, no BGW/DGW crash)

#### Scenario: Blank gameweek in the run
- **WHEN** a gameweek in the FDR run has no fixture
- **THEN** `hasBgw` is true and averages ignore the blank

#### Scenario: Double gameweek in the run
- **WHEN** a gameweek has two fixtures
- **THEN** `hasDgw` is true, both FDRs feed the average, and the DGW bonus is applied

### Requirement: Market signals coverage
#### Scenario: Null and zero edges
- **WHEN** `epNext` is null or `maxEpNext` is 0
- **THEN** `epNextSignal` falls back to the documented neutral value; ownership/transfer momentum handle zero transfer volume without NaN

### Requirement: Composite scoring coverage
#### Scenario: Insufficient minutes fallback
- **WHEN** total minutes are below the configured minimum
- **THEN** the composite total equals the fallback score and the breakdown is empty

#### Scenario: Output bounds and per-position weights
- **WHEN** scoring players of each position with extreme signal inputs
- **THEN** the composite total stays within [0,1] and uses the correct position weight map

### Requirement: Ranking and candidate coverage
#### Scenario: Weakest-3 identification
- **WHEN** a scored squad is ranked
- **THEN** the three lowest composites are the weak spots, each with non-empty `whyWeak`

#### Scenario: Candidate filtering and budget flags
- **WHEN** finding candidates for a weak spot
- **THEN** injured/suspended/unavailable and 3-per-club violations are excluded, and `fitsBudget`/`restructureNeeded` reflect price vs (weak price + bank)

#### Scenario: gw1 vs gw5 gains diverge under fixture variance
- **WHEN** a candidate has a markedly different GW1 fixture than its 5-GW average
- **THEN** `gw1Gain` and `gw5Gain` differ accordingly
