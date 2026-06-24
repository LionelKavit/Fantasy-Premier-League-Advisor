# Restructure — ep-native, ep-gated, and part of the free-transfer allocation

## Why
The Restructure section in This Week is out of step with the rest of the transfer engine, which the
0–5 free-transfer work made obvious:
- Its **net** is a composite 0–1 score while everything else — the transfer-hold gate, the N-move
  stacking — is denominated in **expected points (ep)**. A row like "net +0.42 · −4 pts" mixes a composite
  gain with a points cost.
- It **bypasses the ep-bar gate** every straight transfer must clear, so it can surface very marginal chains.
- It is computed **independently of the recommended free moves**: it can't see how many transfers those
  spent, and the engine never *chooses* a restructure even when the two-move chain would out-project simply
  replacing the weakest players.

A restructure is a two-transfer maneuver (downgrade a funder → buy a cheaper replacement, freeing cash to
buy a dream upgrade the manager couldn't otherwise afford). Making it ep-native, gating it like every other
transfer, and letting the allocator weigh it against straight swaps closes the gap.

## What changes
- **`restructure-ep-allocation`** — three coupled changes:
  1. **ep-native net and cost.** Restructure net becomes ep (`(dream − weak) + (replacement − funder)` from
     `epNext`); chains with a null `epNext` are skipped (consistent with the hold-on-missing-ep rule). The
     displayed cost is already FT-aware; net and cost are now the same unit (points).
  2. **The free-transfer ep-bar gate, applied to restructures.** A restructure spends two transfers, so its
     bar is the sum of the per-move bars it consumes (free move 1.5, hit move 4). The free/hit split — hence
     both the bar and the cost — is computed against the transfers actually available to it: 2 free in the
     primary allocation (bar 3.0), or the FT left **after** the recommended moves for chains shown in the
     section.
  3. **Optimal allocation across swaps and restructures.** The free-transfer recommendation chooses the
     **max-ep** conflict-free set of moves within the FT budget, where a straight swap costs 1 transfer and a
     restructure costs 2. So the engine recommends a restructure when it beats replacing the N weakest
     players, and the Restructure section shows only the chains **not** chosen — each priced and gated
     against the remaining FT budget.

## Impact
- Engine: `lib/optimizer/restructure.ts`, a new `lib/optimizer/allocate.ts` (optimal allocator replacing the
  greedy `buildFreeMoves`), `lib/optimizer/single-transfer.ts`, `lib/optimizer/index.ts`,
  `lib/optimizer/types.ts`, minor `lib/optimizer/synthesis.ts`.
- Display: `components/panel/ThisWeekDetail.tsx` (net in points; remaining-FT cost on section chains).
- **Behaviour change:** recommended moves for a given squad can shift — that is the intent. Existing
  composite-based restructure tests are re-expressed in ep.
- Depends on the shipped free-transfer work (`free-transfer-nmove-strategy` for `freeMoves`/the weak-spot
  pool, `free-transfer-banking-cost-hygiene` for the FT-aware cost shape).

## Out of scope
- Hit strategy beyond the existing single/double hit evaluation (restructures that would need hits are shown
  in the section, not auto-selected into the free plan).
- Captain / chip logic; the composite scoring model itself (only the transfer *decision* moves to ep).

## Depends on
The archived `free-transfer-nmove-strategy` and `free-transfer-banking-cost-hygiene` changes.
