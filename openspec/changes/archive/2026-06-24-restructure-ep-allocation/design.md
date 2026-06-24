# Design — restructure ep-native + optimal allocation

## Current shape (what we're changing)
- `lib/optimizer/restructure.ts` `findRestructureOptions` builds chains from composite score:
  `gainFromDream = dream.score.total − weak.score.total`, `lossFromDowngrade = replacement − downgraded`,
  `netScoreChange = gain + loss`, kept if `> 0`. Cost is `Math.max(0, 2 − freeTransfers) × 4`. Only the
  `dreamTarget` is built as a `ValidTransfer`; the downgrade leg lives as `downgradedPlayer` /
  `downgradeReplacement`.
- `lib/optimizer/single-transfer.ts` `buildFreeMoves` greedily stacks single swaps up to `freeTransfers`,
  each clearing `TRANSFER_THRESHOLDS.freeTransferEp`. It never considers restructures.
- `lib/optimizer/index.ts` computes `singleResult`, then `hitResult`, then `restructureOptions`
  independently. Restructure is display-only; it is never chosen into `primaryRecommendation`.
- `components/panel/ThisWeekDetail.tsx` renders the Restructure section from `transfers.restructureOptions`
  with `net {netScoreChange}` and `{totalCost === 0 ? "free" : "−{n} pts"}`.

## 1. ep deltas (`restructure.ts`)
Compute everything from `player.epNext`:
```
epDelta(inP, outP) = inP.epNext − outP.epNext        // null if either epNext is null
netEp = epDelta(dream, weak) + epDelta(replacement, funder)
```
Skip a chain if any of the four `epNext` is null (matches the hold-on-missing-ep behaviour in
`single-transfer.ts`). `RestructureOption` gains `netEp: number` (replacing the composite `netScoreChange`
for the decision; the composite stays available only if needed for tie-break display). `findCheapestReplacement`
is unchanged structurally, but the downgrade **loss** that feeds `netEp` is ep; its `insufficientDataFallbackScore`
composite floor remains a squad-quality sanity filter on the replacement.

Build a real `ValidTransfer` for the **downgrade leg** (funder → replacement) alongside the existing dream
`ValidTransfer`, so a chosen restructure can flow through `freeMoves` / `groupTransferMoves` as two lines.
Keep `gw1Gain` **composite** on both (display ordering only) — ep is carried separately for the decision so
the composite `gw1Gain` invariant (a squashed 0–1 score) is never overwritten.

## 2. The shared ep-bar gate
A move's bar = `freeTransferEp (1.5)` if taken free, `hitCostEp (4)` if taken as a hit. A restructure spends
two transfers, so its bar is the sum over its two moves given how many are free vs hit:
```
bar(freeCount) = min(2, freeCount)·1.5 + max(0, 2 − freeCount)·4
cost(freeCount) = max(0, 2 − freeCount)·4          // points actually paid (display)
```
- **Primary allocation:** a restructure draws 2 from the free budget → `freeCount = 2` → bar 3.0, cost 0.
- **Section (non-chosen):** `remainingFT = FT − (transfers used by the recommended freeMoves)`. Each
  alternative is judged **independently** against this same `remainingFT` (alternatives do not stack), so
  `freeCount = min(2, remainingFT)` → bar/cost from the formulas above. Keep a section chain only if
  `netEp > bar(freeCount)`.
  - FT=5, 4 recommended moves → remainingFT=1 → freeCount=1 → bar 5.5, cost −4.
  - remainingFT≥2 → bar 3.0, free. remainingFT=0 → bar 8.0, cost −8.

## 3. Optimal allocator (`lib/optimizer/allocate.ts`, new)
A `Move` is either a swap (one `ValidTransfer`, cost 1) or a restructure (linked pair, cost 2), each with a
precomputed `epGain` (swap: `epDelta(candidate, weak)`; restructure: `netEp`), the set of sold/bought player
ids, and team deltas.

```
allocateFreeTransfers(swaps, restructures, freeTransfers, bank, squadTeamCounts)
  → { freeMoves: ValidTransfer[], chosenRestructureKeys: Set<string> }
```
- **Objective:** maximize total **surplus** = `Σ epGain − freeTransferEp · (transfers used)` over conflict-free
  sets with `Σ cost ≤ freeTransfers`. This generalizes the single-move gate (swap worth it iff `epGain > 1.5`,
  restructure iff `netEp > 3.0`) and **banks** any transfer whose marginal surplus is negative — so the
  pure-swap case reduces to today's greedy result and early-stop.
- **Feasibility of a candidate set:** no player sold or bought twice (and no overlap between the two);
  final bank ≥ 0 using sells-first cash (`bank + Σ sold − Σ bought ≥ 0`); every club ≤ 3 after applying all
  team deltas. Per-move legality reuses `validateTransfer` (`setup.ts`) at construction time.
- **Search:** bounded DFS / branch-and-bound over the candidate list (≤ ~5 swaps from the weak spots + a
  handful of restructures; `freeTransfers ≤ 5`). Sort candidates by surplus, prune branches that can't beat
  the best-so-far or that violate cost/feasibility. Exhaustive is trivially fast at these sizes.
- **Output:** `freeMoves` = the chosen moves flattened to `ValidTransfer[]` (a restructure contributes both
  its transfers); `chosenRestructureKeys` identifies which restructures were selected.

`evaluateSingleTransfer` keeps its top-level decision logic (sort, the seed ep-bar gate, roll/hold,
`holdReason`, FT=0 hit framing with `bestSingle` set and `freeMoves` empty) and delegates "which/how many
free moves" to `allocateFreeTransfers`. `bestSingle = freeMoves[0] ?? topSwap`, `bestSecond = freeMoves[1] ?? null`.

## 4. Wiring (`lib/optimizer/index.ts`)
Reorder so restructures are computed **before** allocation and passed in:
```
validTransfers     = buildValidTransfers(...)
restructureCands   = findRestructureOptions(...)        // ep-native, full candidate list
{ freeMoves, chosenRestructureKeys } = allocateFreeTransfers(validTransfers, restructureCands, ft, bank, counts)
singleResult       = evaluateSingleTransfer(... using freeMoves ...)
hitResult          = evaluateHitTransfers(validTransfers minus freeMoves, ...)
restructureOptions = restructureCands NOT in chosenRestructureKeys, re-priced/gated at remainingFT
```
`remainingFT = freeTransfers − (transfers consumed by freeMoves)`.

## 5. Display (`ThisWeekDetail.tsx`)
The chosen restructure already renders in the Transfer section (its two lines, counted in "Make N free
transfers"). The Restructure section iterates `restructureOptions` (now non-chosen only); each row shows
`net +X.X pts` (ep) and the `remainingFT`-aware cost (`free` / `−4 pts` / `−8 pts`).

## Risks / edges
- **Unit safety:** ep is used only for the *decision* and the section display; `ValidTransfer.gw1Gain`
  stays composite so `hit-transfer.ts` and `alternatives` keep their meaning.
- **Behaviour shift:** with ep gating, some chains that passed the old composite `> 0` check now don't, and
  the primary plan can now contain a restructure. Existing composite-based tests are re-expressed in ep.
- **Determinism:** ties in surplus broken by (fewer transfers, then higher ep, then lower id) for a stable
  recommendation.
