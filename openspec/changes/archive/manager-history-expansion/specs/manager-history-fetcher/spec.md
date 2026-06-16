## MODIFIED Requirements

### Requirement: Fetch bootstrap chip allowances
The `fetchBootstrap()` function SHALL parse the `chips` array from the bootstrap-static response into `BootstrapChip[]` and include it in the `BootstrapData` return type alongside `players`, `teams`, `gameweeks`, and `currentGameweek`. This array defines the total chip allowances per season window and serves as the source of truth for deriving chips remaining.

#### Scenario: Bootstrap includes chip definitions
- **WHEN** the system fetches bootstrap-static data
- **THEN** the returned `BootstrapData` includes a `chips` field containing all chip definitions (e.g., 8 entries for 2025/26: wildcard ×2, freehit ×2, bboost ×2, 3xc ×2, each split across two event windows)

### Requirement: Fetch full manager season history
The `fetchHistory()` function SHALL return a normalized `ManagerHistory` object instead of the current partial inline type. The `current` array entries SHALL be normalized to `ManagerGameweekHistory` (with `bank` and `value` divided by 10 to convert to £m). The `chips` array SHALL be normalized to `ChipUsage[]` (including the `time` timestamp). The `past` array SHALL be normalized to `ManagerPastSeason[]`.

#### Scenario: Successful history fetch
- **WHEN** the system fetches history for a valid team ID
- **THEN** the system returns a `ManagerHistory` containing `current` (array of `ManagerGameweekHistory` with all 11 fields: `event`, `points`, `totalPoints`, `rank`, `overallRank`, `percentileRank`, `bank`, `value`, `eventTransfers`, `eventTransfersCost`, `pointsOnBench`), `chips` (array of `ChipUsage` with `name`, `event`, `time`), and `past` (array of `ManagerPastSeason` with `seasonName`, `totalPoints`, `rank`)

#### Scenario: Bank and value normalization in history
- **WHEN** a raw history entry has `bank: 23` and `value: 1035`
- **THEN** the normalized `ManagerGameweekHistory` entry has `bank: 2.3` and `value: 103.5`

#### Scenario: Cached history
- **WHEN** the history endpoint was fetched less than 1 hour ago for the same team ID
- **THEN** the system returns the cached `ManagerHistory` without making a new HTTP request

## ADDED Requirements

### Requirement: Fetch manager transfer history
The system SHALL provide a `fetchTransferHistory(teamId: number): Promise<ManagerTransfer[]>` function that fetches `/entry/{team_id}/transfers/` and normalizes each record into a `ManagerTransfer` object. Costs SHALL be divided by 10 to convert to £m (consistent with existing bank/value normalization). Results SHALL be cached with the same 1-hour TTL as other fetch functions.

#### Scenario: Successful transfer history fetch
- **WHEN** the system fetches transfers for a valid team ID
- **THEN** the system returns an array of `ManagerTransfer` objects with normalized costs, sorted by event (descending, matching API order)

#### Scenario: Cost normalization
- **WHEN** a raw transfer record has `element_in_cost: 76` and `element_out_cost: 99`
- **THEN** the normalized `ManagerTransfer` has `elementInCost: 7.6` and `elementOutCost: 9.9`

#### Scenario: Manager with no transfers
- **WHEN** a manager has made no transfers this season
- **THEN** the function returns an empty array

### Requirement: Analyze transfer patterns
The system SHALL provide an `analyzeTransferPatterns(transfers: ManagerTransfer[], players: Player[]): TransferPatterns` function that computes behavioral signals from the raw transfer history. The `players` array is used to resolve player positions for the position bias calculation. The function SHALL:
1. Count total transfers
2. Identify completed buy→sell cycles (same player bought then later sold) and compute knee-jerk rate (sold within ≤2 GWs / total completed cycles), net value change (sum of sell − buy across cycles), and average hold duration
3. Compute position bias by resolving each `elementIn` to a player's position and counting per position

#### Scenario: Knee-jerk rate calculation
- **WHEN** a manager has 10 completed buy→sell cycles and 3 of those had a hold duration ≤2 GWs
- **THEN** `kneeJerkRate` is `0.3`

#### Scenario: Net value change
- **WHEN** a manager bought Player A for £7.6m and sold for £8.0m, bought Player B for £9.9m and sold for £9.2m
- **THEN** `netValueChange` is `0.4 + (-0.7) = -0.3`

#### Scenario: Position bias with unknown players
- **WHEN** a transfer references a player ID not found in the `players` array (e.g., player transferred out of the PL mid-season)
- **THEN** that transfer is excluded from the position bias calculation

#### Scenario: No completed cycles
- **WHEN** no player bought this season was subsequently sold
- **THEN** `kneeJerkRate` is `0.0`, `netValueChange` is `0.0`, `avgHoldDuration` is `0.0`

### Requirement: Derive chips remaining
The system SHALL provide a `deriveChipsRemaining(usedChips: ChipUsage[], bootstrapChips: BootstrapChip[]): ChipsRemaining` function that computes the total allowance per chip by summing `number` across all `BootstrapChip` entries with the same `name`, then subtracts the count of each chip in the manager's usage history. The chip name mapping SHALL be: "wildcard" → `wildcard`, "freehit" → `freeHit`, "bboost" → `benchBoost`, "3xc" → `tripleCaptain`.

#### Scenario: All chips used
- **WHEN** a manager has used 2 wildcards, 2 free hits, 2 bench boosts, and 2 triple captains, and the bootstrap defines 2 of each
- **THEN** `deriveChipsRemaining` returns `{ wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 }`

#### Scenario: Partial chip usage
- **WHEN** a manager has used 1 wildcard out of 2 allowed and no other chips
- **THEN** `deriveChipsRemaining` returns `{ wildcard: 1, freeHit: 2, benchBoost: 2, tripleCaptain: 2 }`

#### Scenario: Unknown chip name ignored
- **WHEN** the chips array contains a chip with an unrecognized name
- **THEN** the system ignores it without error

### Requirement: Build manager profile
The system SHALL provide a `buildManagerProfile(teamId: number, bootstrap: BootstrapData): Promise<ManagerProfile>` function that fetches the manager entry, history, and transfer history in parallel, derives chips remaining from the history and bootstrap chip definitions, analyzes transfer patterns, computes the risk profile, and returns a single `ManagerProfile` object.

#### Scenario: Complete manager profile
- **WHEN** `buildManagerProfile` is called with a valid team ID and bootstrap data
- **THEN** it returns a `ManagerProfile` with `entry` (from `fetchEntry`), `history` (from `fetchHistory`), `chipsRemaining` (from `deriveChipsRemaining`), `riskProfile` (computed from history and gameweek data), and `transferPatterns` (from `analyzeTransferPatterns` using fetched transfers and bootstrap players)

#### Scenario: Risk profile rank trend calculation
- **WHEN** the manager's overall rank over the last 5 GWs decreased by more than 5%
- **THEN** the `riskProfile.rankTrend` is `"rising"` (lower rank number = better position)

#### Scenario: Risk profile with fewer than 3 GWs played
- **WHEN** the manager has played fewer than 3 gameweeks
- **THEN** `riskProfile.rankTrend` is `"stable"` (insufficient data for trend)

#### Scenario: Risk profile GWs remaining
- **WHEN** the current gameweek is 30 and the season has 38 gameweeks
- **THEN** `riskProfile.gwsRemaining` is `8`

#### Scenario: Risk profile hit summary
- **WHEN** a manager took hits in GW 5, GW 12, GW 20, and GW 28 costing 4, 4, 8, and 4 points respectively
- **THEN** `riskProfile.totalHitsTaken` is `4` and `riskProfile.totalHitCost` is `20`

#### Scenario: Risk profile bench waste
- **WHEN** a manager has 38 GWs with total bench points of 338
- **THEN** `riskProfile.avgBenchPoints` is `8.9`
