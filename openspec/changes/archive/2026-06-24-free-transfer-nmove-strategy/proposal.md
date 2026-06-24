# Transfer engine — full N-move free-transfer strategy

## Why
Once the input accepts 0–5 (`free-transfer-input-range`), the engine must actually *use* the count. Today
it does not: `single-transfer.ts` computes at most **two** free moves (a `freeTransfers >= 2` branch that
finds one `bestSecond`), and the synthesis schema only carries `FREE | HIT_SINGLE | HIT_DOUBLE | ROLL`.
Worse, even at FT=2 the **structured** `primaryRecommendation` of type `FREE` only ever includes
`bestSingle` (one move) — `bestSecond` exists solely to feed the LLM narrative. So a manager with 3, 4, or
5 free transfers is told to make a single move and waste the rest. This change generalizes the engine to
recommend **up to N stacked free moves**, so the structured recommendation matches the manager's real
capacity.

## What changes
- **`free-transfer-nmove-strategy`** — the optimizer recommends up to `freeTransfers` free moves:
  1. **`freeMoves` result list.** `SingleTransferResult` gains `freeMoves: ValidTransfer[]`; `bestSingle`/
     `bestSecond` become the first two elements for backward-compatible consumers.
  2. **Greedy N-move builder.** `findBestSecond` generalizes to `buildFreeMoves`: stack up to
     `freeTransfers` non-overlapping moves, each clearing the free-transfer ep bar
     (`TRANSFER_THRESHOLDS.freeTransferEp`), re-deriving the running bank and team-counts after each pick
     (reusing the existing `validateTransfer` + `adjustedBank`/`adjustedCounts` pattern). Stop early when
     no qualifying move remains — FT=5 with only two worthwhile upgrades returns two, not five.
  3. **Hit pool excludes all free moves.** `hit-transfer.ts` removes the entire `freeMoves` set from the
     hit search (today it only excludes `bestSingle`/`bestSecond`), so a hit is never double-counted
     against a move already taken for free.
  4. **Synthesis carries the full set.** The `FREE` action (and the keyless fail-safe) carries every
     `freeMoves` entry with a summed `netGain`; the prompt is rewritten to be N-aware (up to N free moves,
     bank/roll the remainder).
  5. **Plural display.** The This Week headline and the Scout's opening brief say "Make N free transfers"
     from the move count instead of the hardcoded singular "Make 1 free transfer".

## Impact
- Engine: `lib/optimizer/types.ts`, `lib/optimizer/single-transfer.ts`, `lib/optimizer/hit-transfer.ts`,
  `lib/optimizer/synthesis.ts`.
- Display: `components/panel/ThisWeekDetail.tsx`, `lib/scout/brief.ts` (headlines only — the transfer
  *rows* already render N moves via `groupTransferMoves`).
- Tests: `lib/__tests__/optimizer/setup-single.test.ts` (its FT=2 expectations now flow through
  `freeMoves`) plus new FT=0/3/4/5 cases.

## Out of scope
- The input field / API clamps (in `free-transfer-input-range`).
- The banking-copy cap and restructure-cost fix (in `free-transfer-banking-cost-hygiene` — they ship
  alongside this but are specced separately as bug-fix hygiene).
- Hit strategy beyond single/double, and any change to captain/chip logic.

## Depends on
`free-transfer-input-range` (the engine needs a real 0–5 value to act on).
