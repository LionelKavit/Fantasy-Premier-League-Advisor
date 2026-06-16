## Tasks

### Task 1: Add manager history and transfer types
**Capability:** manager-history-types
**File:** `lib/types.ts`

Add 10 new types (`BootstrapChip`, `ManagerGameweekHistory`, `ChipUsage`, `ManagerPastSeason`, `ManagerHistory`, `ManagerTransfer`, `TransferPatterns`, `ChipsRemaining`, `RiskProfile`, `ManagerProfile`) and update `BootstrapData` to include `chips: BootstrapChip[]`.

### Task 2: Update fetchBootstrap to include chips
**Capability:** manager-history-fetcher
**File:** `lib/fpl-api.ts`

Update `fetchBootstrap()` to parse and return the `chips` array from bootstrap-static as `BootstrapChip[]` in `BootstrapData`.

### Task 3: Expand fetchHistory return type
**Capability:** manager-history-fetcher
**File:** `lib/fpl-api.ts`

Update `fetchHistory()` to return a full `ManagerHistory` object with normalized `ManagerGameweekHistory[]` (bank/value ÷ 10), `ChipUsage[]`, and `ManagerPastSeason[]`.

### Task 4: Implement fetchTransferHistory
**Capability:** manager-history-fetcher
**File:** `lib/fpl-api.ts`

Add `fetchTransferHistory(teamId)` that fetches `/entry/{team_id}/transfers/` and normalizes each record into `ManagerTransfer` with costs ÷ 10. Cached with 1-hour TTL.

### Task 5: Implement analyzeTransferPatterns
**Capability:** manager-history-fetcher
**File:** `lib/fpl-api.ts`

Add `analyzeTransferPatterns(transfers, players)` that computes knee-jerk rate (sold within ≤2 GWs), net value change, position bias, and average hold duration from transfer history.

### Task 6: Implement deriveChipsRemaining
**Capability:** manager-history-fetcher
**File:** `lib/fpl-api.ts`

Add `deriveChipsRemaining(usedChips, bootstrapChips)` that computes remaining chips from bootstrap allowances minus usage history.

### Task 7: Implement buildManagerProfile
**Capability:** manager-history-fetcher
**File:** `lib/fpl-api.ts`

Add `buildManagerProfile(teamId, bootstrap)` that fetches entry + history + transfers in parallel, derives chips remaining, analyzes transfer patterns, computes risk profile (rank trend, hits, bench waste), and returns `ManagerProfile`.

### Task 8: Update squad route
**Capability:** manager-history-route
**File:** `app/api/squad/route.ts`

Replace `fetchEntry` with `buildManagerProfile`. Include `chipsRemaining`, `riskProfile`, and `transferPatterns` (including the full raw `transfers` array for Synthesis Node consumption) in the response.

### Task 9: Verification
Verify against real FPL team ID 123456:
- `fetchHistory()` returns all 11 fields per GW entry, chips with timestamps, past seasons
- `fetchTransferHistory()` returns 99 transfer records with normalized costs
- `analyzeTransferPatterns()` produces valid knee-jerk rate, net value, position bias, hold duration
- `deriveChipsRemaining` returns correct counts (all 0 for this team)
- `/api/squad` response includes `chipsRemaining`, `riskProfile`, and `transferPatterns`
- All monetary values normalized to £m
