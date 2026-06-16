## MODIFIED Requirements

### Requirement: Squad route includes manager profile data
The `/api/squad` route SHALL use `buildManagerProfile` to fetch the manager entry, history, chips remaining, risk profile, and transfer patterns in a single call. The response SHALL include `chipsRemaining` (object with `wildcard`, `freeHit`, `benchBoost`, `tripleCaptain` counts), `riskProfile` (object with `currentRank`, `bestRank`, `rankTrend`, `gwsRemaining`, `totalHitsTaken`, `totalHitCost`, `avgBenchPoints`), and `transferPatterns` (object with `totalTransfers`, `kneeJerkRate`, `netValueChange`, `positionBias`, `avgHoldDuration`, and `transfers` — the full normalized `ManagerTransfer[]` array for downstream use by the Synthesis Node) alongside the existing `manager`, `squad`, `bank`, `freeTransfers`, `currentGameweek`, and `activeChip` fields.

#### Scenario: Successful squad response with profile data
- **WHEN** a client requests `/api/squad?team_id=123456&free_transfers=1`
- **THEN** the response JSON includes all existing fields (`manager`, `squad`, `bank`, `freeTransfers`, `currentGameweek`, `activeChip`) plus `chipsRemaining` (e.g., `{ wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 }`), `riskProfile` (e.g., `{ currentRank: 177000, bestRank: 120000, rankTrend: "falling", gwsRemaining: 0, totalHitsTaken: 4, totalHitCost: 16, avgBenchPoints: 8.9 }`), and `transferPatterns` (e.g., `{ totalTransfers: 99, kneeJerkRate: 0.15, netValueChange: -2.3, positionBias: { GKP: 0.1, DEF: 0.25, MID: 0.4, FWD: 0.25 }, avgHoldDuration: 5.2, transfers: [...] }`)

#### Scenario: Error handling unchanged
- **WHEN** a client requests `/api/squad` without a `team_id` parameter
- **THEN** the response is `{ error: "team_id is required", status: 400 }` with HTTP status 400

#### Scenario: Manager not found
- **WHEN** a client requests `/api/squad?team_id=999999999` and the FPL API returns 404
- **THEN** the response is `{ error: "...", status: 404 }` with HTTP status 404
