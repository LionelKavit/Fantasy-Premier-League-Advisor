# Design

## Context

- The drawer's lens is `"this-week" | "long-term"`, owned by `app/page.tsx` and rendered by [FullBreakdown.tsx](../../../components/panel/FullBreakdown.tsx).
- [LongTermDetail.tsx](../../../components/panel/LongTermDetail.tsx) renders two independent `Section`s: **Transfer horizon** (`HorizonSparkline`) and **Chip strategy** (`ChipTimeline` + `chipsRemaining`). They're already cleanly separable.
- [ThisWeekDetail.tsx](../../../components/panel/ThisWeekDetail.tsx) maps `transfers.primaryRecommendation.transfers` to one `TransferLine` (`out → in`) each. Each element is a `ValidTransfer { weakPlayer, candidate, gw1Gain, … }`. A Wildcard surfaces many of these, several sharing the same `weakPlayer`.

## Key Decisions

### 1. Chips is a third lens; chip strategy relocates out of Long Term
Extend the lens to `"this-week" | "long-term" | "chips"` (in `app/page.tsx` and `FullBreakdown`). Add a **Chips** tab trigger. Move the **Chip strategy** `Section` (timeline + chips-remaining) into a new `ChipsDetail` rendered for the chips lens; **Long Term** then renders only the Transfer Horizon. No data changes — both already read from `plan`.

### 2. The Wildcard/Free Hit draft stays in This Week
Only the chip *timeline/timing* moves to Chips. The transfer draft a Wildcard produces is this deadline's action, so it stays in the This Week transfer section (where the grouping fix below applies). (Locked in discussion: action stays where you act; planning moves to Chips.)

### 3. Group transfer moves by out-player — a pure, testable transform
Extract `groupTransferMoves(transfers: ValidTransfer[])` → `{ out: string; candidates: string[] }[]`:
- group by `weakPlayer.player.id`,
- within a group, candidates ordered by `gw1Gain` desc, capped to the top **3** (web names),
- groups ordered by their best candidate's `gw1Gain` desc.
A single move yields one group with one candidate (unchanged render). `TransferLine` renders `Out → A / B / C`. Keeping the transform pure (its own module) makes it unit-testable without a component harness.

### 4. Presentation only
No change to `chip-interaction.ts`, the optimizer, or which transfers are computed. Grouping is a display transform; the Chips tab is a relocation. The hit verdict / restructure / captaincy sections of This Week are untouched.

## Files (indicative)

```
app/page.tsx                          // Lens type adds "chips"
components/panel/FullBreakdown.tsx     // 3 tabs; render ChipsDetail for the chips lens
components/panel/LongTermDetail.tsx     // drop the Chip strategy Section (horizon only)
components/panel/ChipsDetail.tsx        // (new) Chip strategy Section: ChipTimeline + chipsRemaining
components/panel/ThisWeekDetail.tsx     // render grouped moves via groupTransferMoves + multi-candidate TransferLine
lib/client/transferMoves.ts             // (new) pure groupTransferMoves()
lib/__tests__/client/transferMoves.test.ts  // (new)
```

## Reused
- `ChipTimeline` (unchanged) and `HorizonSparkline` (unchanged); the existing `Tabs` primitive and `Section` wrapper; `GameweekPlan` data already on the client.

## Tests
- `groupTransferMoves`: single move → one group/one candidate; multiple candidates for one out → grouped, ordered by gain, capped to 3; multiple out-players → ordered by best-candidate gain.
- Tab relocation + multi-candidate rendering are verified in-app (no React component-test harness in this repo).
