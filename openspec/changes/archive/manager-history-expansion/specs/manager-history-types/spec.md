## ADDED Requirements

### Requirement: Bootstrap chip allowance data model
The system SHALL define a `BootstrapChip` type for chip definitions from the bootstrap-static `chips` array, including `id` (number), `name` (string — "wildcard", "freehit", "bboost", "3xc"), `number` (number — allowance per window), `start_event` (number), `stop_event` (number), and `chip_type` (string — "transfer" or "team"). The `BootstrapData` type SHALL include a `chips: BootstrapChip[]` field.

#### Scenario: Chip allowance parsing
- **WHEN** the bootstrap-static API returns a `chips` array with 8 entries (each chip name appearing twice for GW 1–19 and GW 20–38 windows)
- **THEN** the system parses all 8 entries into `BootstrapChip` objects and includes them in `BootstrapData.chips`

#### Scenario: Total allowance per chip
- **WHEN** the `chips` array contains two entries for "wildcard" each with `number: 1`
- **THEN** the total wildcard allowance for the season is 2 (sum of `number` across entries with `name: "wildcard"`)

### Requirement: Manager gameweek history data model
The system SHALL define a `ManagerGameweekHistory` type for per-gameweek manager performance entries from the `/entry/{team_id}/history/` endpoint's `current` array, including `event` (gameweek number), `points` (GW points scored), `totalPoints` (cumulative), `rank` (GW rank), `overallRank` (overall rank after this GW), `percentileRank` (percentile), `bank` (normalized to £m), `value` (squad value, normalized to £m), `eventTransfers` (transfers made this GW), `eventTransfersCost` (hit cost in points), and `pointsOnBench` (wasted bench points).

#### Scenario: Bank and value normalization
- **WHEN** a raw history entry has `bank: 23` and `value: 1035`
- **THEN** the normalized entry has `bank: 2.3` (£m) and `value: 103.5` (£m)

#### Scenario: Hit cost tracking
- **WHEN** a manager took a -4 point hit in gameweek 12
- **THEN** the entry for gameweek 12 has `eventTransfers: 2` and `eventTransfersCost: 4`

#### Scenario: Bench points waste
- **WHEN** a manager's bench scored 10 points in gameweek 5
- **THEN** the entry for gameweek 5 has `pointsOnBench: 10`

### Requirement: Chip usage data model
The system SHALL define a `ChipUsage` type for chip usage records from the `/entry/{team_id}/history/` endpoint's `chips` array, including `name` (string — chip identifier: "wildcard", "freehit", "bboost", "3xc"), `event` (number — gameweek used), and `time` (string — ISO timestamp when activated).

#### Scenario: Chip usage record
- **WHEN** a manager activated a wildcard in gameweek 6
- **THEN** the chip usage record contains `name: "wildcard"`, `event: 6`, `time: "2025-09-22T20:21:40.129309Z"`

### Requirement: Manager past season data model
The system SHALL define a `ManagerPastSeason` type for past season summaries from the `/entry/{team_id}/history/` endpoint's `past` array, including `seasonName` (string — e.g., "2024/25"), `totalPoints` (number), and `rank` (number).

#### Scenario: Past season record
- **WHEN** a manager played in the 2024/25 season with 2142 points and rank 120050
- **THEN** the past season record contains `seasonName: "2024/25"`, `totalPoints: 2142`, `rank: 120050`

### Requirement: Manager history composite data model
The system SHALL define a `ManagerHistory` type that wraps the full history response, including `current: ManagerGameweekHistory[]`, `chips: ChipUsage[]`, and `past: ManagerPastSeason[]`.

#### Scenario: Full history response
- **WHEN** the system fetches history for a manager who has played 38 gameweeks, used 8 chips, and has 12 past seasons
- **THEN** the `ManagerHistory` contains `current` (38 entries), `chips` (8 entries), and `past` (12 entries)

### Requirement: Manager transfer record data model
The system SHALL define a `ManagerTransfer` type for individual transfer records from the `/entry/{team_id}/transfers/` endpoint, including `elementIn` (number — player ID bought), `elementInCost` (number — purchase price, normalized to £m by dividing by 10), `elementOut` (number — player ID sold), `elementOutCost` (number — sale price, normalized to £m by dividing by 10), `event` (number — gameweek), and `time` (string — ISO timestamp).

#### Scenario: Transfer record normalization
- **WHEN** a raw transfer record has `element_in_cost: 76` and `element_out_cost: 99`
- **THEN** the normalized `ManagerTransfer` has `elementInCost: 7.6` and `elementOutCost: 9.9`

#### Scenario: Multiple transfers in same gameweek
- **WHEN** a manager made 2 transfers in gameweek 37
- **THEN** there are 2 separate `ManagerTransfer` records both with `event: 37`

### Requirement: Transfer patterns data model
The system SHALL define a `TransferPatterns` type with:
- `totalTransfers: number` — total number of transfers made this season
- `kneeJerkRate: number` — proportion of bought players that were sold within 2 GWs (0.0–1.0)
- `netValueChange: number` — sum of (sale price − buy price) across all completed buy→sell cycles, in £m
- `positionBias: { GKP: number, DEF: number, MID: number, FWD: number }` — percentage of transfers (in) per position
- `avgHoldDuration: number` — average GWs a player was held before being sold (only for players that were both bought and later sold)
- `transfers: ManagerTransfer[]` — full transfer history for downstream use

#### Scenario: Knee-jerk detection
- **WHEN** a manager bought 20 players this season and 6 of them were sold within 2 GWs of purchase
- **THEN** `kneeJerkRate` is `0.3`

#### Scenario: Value destruction
- **WHEN** a manager's completed transfer cycles show total buy cost of £120.0m and total sell revenue of £115.5m
- **THEN** `netValueChange` is `-4.5`

#### Scenario: Position bias
- **WHEN** out of 40 transfers in, 5 were GKP, 10 DEF, 15 MID, 10 FWD
- **THEN** `positionBias` is `{ GKP: 0.125, DEF: 0.25, MID: 0.375, FWD: 0.25 }`

#### Scenario: Hold duration
- **WHEN** a manager bought 3 players who were later sold, held for 1, 4, and 7 GWs respectively
- **THEN** `avgHoldDuration` is `4.0`

#### Scenario: No completed cycles
- **WHEN** no player bought this season has been sold yet
- **THEN** `kneeJerkRate` is `0.0`, `netValueChange` is `0.0`, and `avgHoldDuration` is `0.0`

### Requirement: Chips remaining data model
The system SHALL define a `ChipsRemaining` type with `wildcard: number`, `freeHit: number`, `benchBoost: number`, and `tripleCaptain: number`. Each value represents how many uses of that chip the manager has remaining. The system SHALL derive this by computing the total allowance per chip name from the bootstrap `chips` array (sum of `number` across all `BootstrapChip` entries with that name), then subtracting the count of each chip in the manager's `ChipUsage[]` history.

#### Scenario: All chips used
- **WHEN** a manager has used 2 wildcards, 2 free hits, 2 bench boosts, and 2 triple captains (matching the 2025/26 allowance of 2 each)
- **THEN** `ChipsRemaining` is `{ wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 }`

#### Scenario: Mid-season chips remaining
- **WHEN** a manager has used 1 wildcard and 1 bench boost out of 2 each allowed
- **THEN** `ChipsRemaining` is `{ wildcard: 1, freeHit: 2, benchBoost: 1, tripleCaptain: 2 }`

#### Scenario: Chip name mapping
- **WHEN** the API uses chip names "wildcard", "freehit", "bboost", "3xc"
- **THEN** the system maps these to `wildcard`, `freeHit`, `benchBoost`, `tripleCaptain` respectively

### Requirement: Risk profile data model
The system SHALL define a `RiskProfile` type with `currentRank: number` (latest overall rank), `bestRank: number` (lowest overall rank achieved this season), `rankTrend: "rising" | "falling" | "stable"` (based on last 5 GWs — "rising" if overall rank decreased by >5%, "falling" if increased by >5%, "stable" otherwise), `gwsRemaining: number` (total gameweeks minus current GW), `totalHitsTaken: number` (count of GWs with non-zero transfer cost), `totalHitCost: number` (sum of all transfer costs), and `avgBenchPoints: number` (average points on bench per GW, rounded to 1 decimal).

#### Scenario: Rising rank trend
- **WHEN** a manager's overall rank over the last 5 GWs went from 200000 to 177000 (11.5% decrease)
- **THEN** `rankTrend` is `"rising"`

#### Scenario: Stable rank trend
- **WHEN** a manager's overall rank over the last 5 GWs went from 180000 to 177000 (1.7% decrease)
- **THEN** `rankTrend` is `"stable"`

#### Scenario: Hit-heavy manager
- **WHEN** a manager took hits in 4 gameweeks totaling 16 points
- **THEN** `totalHitsTaken` is `4` and `totalHitCost` is `16`

### Requirement: Manager profile composite data model
The system SHALL define a `ManagerProfile` type that composites `entry: ManagerEntry`, `history: ManagerHistory`, `chipsRemaining: ChipsRemaining`, `riskProfile: RiskProfile`, and `transferPatterns: TransferPatterns`. This type serves as the single object passed to downstream pipeline nodes (Chip Interaction Node, Synthesis Node) for risk-calibrated recommendations.

#### Scenario: Complete profile
- **WHEN** the system builds a manager profile for a valid team ID
- **THEN** the `ManagerProfile` contains all five nested objects populated with data from the entry, history, and transfers endpoints
