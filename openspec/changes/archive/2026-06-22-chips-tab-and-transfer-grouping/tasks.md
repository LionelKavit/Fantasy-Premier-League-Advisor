## Tasks

> Presentation-only. No chip-logic or optimizer changes.
>
> Status: implemented on branch `claude/musing-hoover-ef5e36`. `tsc` clean, `eslint` 0 errors, `vitest` 236 passed (+4 `transferMoves`). New `lib/client/transferMoves.ts` + `components/panel/ChipsDetail.tsx`; `LongTermDetail` now horizon-only; drawer has a third **Chips** tab. In-app pass pending the user's browser.

### Task 1 — ✅ Done: Pure grouping transform
**Capability:** this-week-tab
**Files:** `lib/client/transferMoves.ts` (new), `lib/__tests__/client/transferMoves.test.ts` (new)

`groupTransferMoves(transfers)` → `{ out: string; candidates: string[] }[]`: group by out-player, candidates ordered by `gw1Gain` desc and capped to 3, groups ordered by best-candidate gain desc.

### Task 2: Grouped transfer lines in This Week
**Capability:** this-week-tab
**File:** `components/panel/ThisWeekDetail.tsx`

Render one line per out-player using `groupTransferMoves`; `TransferLine` shows `Out → A / B / C`. Single-move output is unchanged. Hit verdict / restructure / captaincy sections untouched.

### Task 3: Chips tab
**Capability:** strategy-tabs
**Files:** `app/page.tsx` (Lens adds `"chips"`), `components/panel/FullBreakdown.tsx`, `components/panel/ChipsDetail.tsx` (new), `components/panel/LongTermDetail.tsx`

Add a **Chips** tab trigger (This Week | Long Term | Chips). Move the Chip strategy `Section` (ChipTimeline + chipsRemaining) into `ChipsDetail`, rendered for the chips lens. `LongTermDetail` keeps only the Transfer Horizon.

### Task 4: Verify
- `groupTransferMoves` unit tests green; `npx tsc --noEmit`, `eslint .`, `vitest` green.
- In-app: a third **Chips** tab shows the chip timeline; **Long Term** shows only the horizon; a Wildcard's transfers render as one line per out-player with slash-separated candidates.

## Verification
- Off-season GW38 wildcard: the This Week transfer section collapses repeated out-players (João Pedro, Ballard, Welbeck) into one line each; the Chip Strategy timeline lives under the new Chips tab.
