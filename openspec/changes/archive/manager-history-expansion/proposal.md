## Problem

The `/entry/{team_id}/history/` FPL API endpoint returns rich per-gameweek manager data — points, rank progression, bank, squad value, transfer costs, bench points, chips used, and past seasons — but the current implementation only captures 4 fields from `current` and 2 from `chips`. This leaves critical data on the table that downstream pipeline nodes need:

1. **Chips remaining** — the Chip Interaction Node cannot determine which chips are still available without knowing what's been used and what the season allows.
2. **Risk tolerance** — the Synthesis Node needs rank trajectory and GWs remaining to calibrate aggressive vs. safe transfer advice.
3. **Bench points waste** — high average bench points signal the manager needs bench upgrades, which affects Bench Boost timing.
4. **Transfer cost patterns** — a manager who frequently takes hits may need different advice than one who always rolls.
5. **Transfer decision history** — the `/entry/{team_id}/transfers/` endpoint reveals who the manager bought/sold, at what prices, and when — enabling detection of knee-jerk patterns, value destruction, position bias, and short hold durations that should inform future recommendations.

## Proposed Change

Expand the manager history data layer to capture the full API response and derive actionable signals:

- **New types**: `BootstrapChip`, `ManagerGameweekHistory`, `ChipUsage`, `ManagerPastSeason`, `ManagerHistory`, `ManagerTransfer`, `TransferPatterns`, `ChipsRemaining`, `RiskProfile`, `ManagerProfile`
- **Updated fetch functions**: `fetchBootstrap()` includes chip allowances, `fetchHistory()` returns full normalized data
- **New fetch functions**: `fetchTransferHistory()` fetches and normalizes all transfer records from `/entry/{team_id}/transfers/`
- **New derived functions**: `deriveChipsRemaining()` (from bootstrap allowances minus usage), `analyzeTransferPatterns()` (knee-jerk detection, value tracking, position bias, hold duration), `buildManagerProfile()` (composite with risk profile and transfer patterns)
- **Updated route**: `/api/squad` returns chips remaining, risk profile, and transfer patterns alongside squad data

## Capabilities Added

1. `manager-history-types` — Full TypeScript types for manager history, transfer records, chip usage, and derived profiles
2. `manager-history-fetcher` — Expanded fetch and derivation functions including transfer history and pattern analysis
3. `manager-history-route` — Squad route enriched with chips, risk, and transfer pattern data
