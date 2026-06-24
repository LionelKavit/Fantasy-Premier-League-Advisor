# Design — N-move free-transfer strategy

## Current shape (what we're generalizing)
`evaluateSingleTransfer` (in `lib/optimizer/single-transfer.ts`):
1. sorts `validTransfers` by `gw1Gain` then `gw5Gain`;
2. gates the top move on the ep bar (`needsHit = freeTransfers < 1` → `hitCostEp 4` else `freeTransferEp 1.5`);
3. if it clears, sets `bestSingle = sorted[0]` and, **only when `freeTransfers >= 2`**, calls
   `findBestSecond` for one additional move (budget/team-count aware, including restructure-unlocked targets).

Downstream, `synthesis.ts` `mapTransferAction` `FREE` returns `transfers: bestSingle ? [bestSingle] : []`
— so `bestSecond` never reaches the structured output; it only appears in the LLM prompt context. This is
the core gap: the structured `FREE` action is single-move regardless of FT.

## 1. `freeMoves` on the result type
`lib/optimizer/types.ts` — extend `SingleTransferResult`:
```ts
freeMoves: ValidTransfer[]; // 0..freeTransfers moves, in priority order
```
Keep `bestSingle`/`bestSecond` and define them as `freeMoves[0] ?? null` / `freeMoves[1] ?? null`. This
keeps `lib/scout/*`, the prompt formatting, and existing tests compiling while the structured action moves
to `freeMoves`.

## 2. Greedy N-move builder (`buildFreeMoves`)
Generalize `findBestSecond` into an iterative loop that picks the best legal move, applies it to a running
budget/counts snapshot, and repeats up to `freeTransfers` times:

```
moves = []
bank' = analysis.bank ; counts' = squadTeamCounts.clone()
usedWeakIds = {} ; usedCandidateIds = {}
seed: push bestSingle; apply its price delta + team-count delta to bank'/counts'; mark ids used
while moves.length < freeTransfers:
  best = null
  for each weak spot ws (analysis.weakest3, skipping used weak ids):
    for each target of ws.targets (skip used candidate ids):
      vt = validateTransfer(ws.player, target.candidate, bank', counts', {gw1Gain, gw5Gain})
      if !vt or vt.gw1Gain <= 0: continue
      if deltaEp(vt) <= freeTransferEp: continue   // every free move must still clear the bar
      if !best or vt.gw1Gain > best.gw1Gain: best = vt
  if !best: break              // stop early — no more worthwhile free moves
  push best; apply deltas to bank'/counts'; mark ids used
return moves
```

Notes:
- **Bar applies to every move, not just the first.** A 4th free transfer that only adds +0.3 ep is below
  the noise floor and should be left as a roll/bank, not forced. So each stacked move independently clears
  `freeTransferEp`.
- **deltaEp** = `candidate.epNext − weak.epNext` (same calc as the seed gate). When ep is null for a
  candidate it can't clear the bar → naturally excluded (consistent with the existing hold-on-missing-ep rule).
- **Reuse:** `validateTransfer`, `adjustedBank`, and `adjustedCounts` already exist in `findBestSecond` —
  lift them into the loop body. Restructure-unlocked targets (`!target.fitsBudget`) are picked up for free
  because the running `bank'` already reflects prior sales, so the explicit "unlock" search in
  `findBestSecond` folds into the same pass.
- **FT=0/1:** `buildFreeMoves` is only entered after the seed gate passes; for FT=1 it returns `[bestSingle]`
  (loop body never runs). For FT=0 the seed gate uses the hit bar (`needsHit`), so the FREE path produces
  no free moves — hits handle it. Behaviour at 0 and 1 is unchanged.

`alternatives` (the `sorted.slice(1, 4)` shown as swap options) stays as-is — it's the "other ideas" list,
distinct from the committed `freeMoves`.

## 3. Hit pool excludes all free moves
`lib/optimizer/hit-transfer.ts`: `usedIds` currently adds `bestSingle` and `bestSecond`. Change to iterate
`singleResult.freeMoves` and add every `transferKey`. Prevents recommending a −4 hit for a move already in
the free set when FT≥3.

## 4. Synthesis carries the full set
`lib/optimizer/synthesis.ts`:
- `mapTransferAction` `FREE` → `transfers: singleResult.freeMoves`, `netGain: Σ gw1Gain`, `netPointsCost: 0`.
- `buildFailSafe` `FREE` branch → same (`freeMoves` with summed gain) instead of the single `bestSingle`.
- Prompt: replace the singular framing and the "rolling for 2 FTs" line with N-aware language — pass the
  full `freeMoves` list, state the manager has `freeTransfers` available, and instruct that beyond the
  recommended free moves the remainder is banked/rolled (cap surfaced by `free-transfer-banking-cost-hygiene`).
- The narrative still must not restate the moves (they render as chips); it explains *why this set*.

## 5. Plural display
- `components/panel/ThisWeekDetail.tsx` `primaryHeadline`: `FREE` →
  `Make ${n} free transfer${n === 1 ? "" : "s"}` where `n = action.transfers.length`.
- `lib/scout/brief.ts` `transferHeadline`: same, from `BriefTransfer.moves.length` (the brief's grounding
  already carries the moves array).
- The transfer **rows** need no change — `ThisWeekDetail` already maps
  `primaryRecommendation.transfers` through `groupTransferMoves`, so N lines render today.

## Risk / edge cases
- **Budget exhaustion mid-stack:** handled — each pick re-checks `validateTransfer` against the running bank.
- **Same player sold twice / 3-per-club breach:** handled — used-id sets + `adjustedCounts` carry forward.
- **All N clear the bar but later ones are marginal:** acceptable by design — the per-move bar keeps only
  worthwhile moves; the rest roll. This is the intended "don't burn transfers for noise" behaviour.
