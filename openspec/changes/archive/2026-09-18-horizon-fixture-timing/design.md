# Design — horizon fixture timing

## Context

`computeHorizon(validTransfers, fixtures, teams, currentGw)` (`lib/optimizer/horizon.ts`): sorts valid transfers by `gw1Gain`, keeps five, and for each rescores candidate and weak player for `currentGw … currentGw+4` (target-gameweek-alignment) with only the fixture signal varying, accumulates the gain, and derives `timing` from the signs at index 0 and 4. `HorizonSparkline.tsx` renders `cumulativeGain` and a `TIMING` map of label + gloss; `synthesis.ts` serialises `timing`, `fixtureSwing`, `cumulativeGain` into the LLM prompt. `computeFdrRun(teamId, fixtures, gw, n)` (`lib/gameweek.ts`) already returns per-gameweek `fdr: number | number[] | null` (single, double, blank) for a team — the raw, pre-squash quantity the horizon needs.

Live anatomy (2026-09-18, target GW6):

| entry | level gap | per-GW gain | cand FDR | weak FDR |
|---|---|---|---|---|
| Kelleher for Kinsky | 0.475 | 0.475 0.455 0.466 0.438 0.447 | 4 4 2 3 3 | 4 2 4 3 3 |
| De Cuyper for Cash | 0.456 | 0.456 0.438 0.421 0.403 0.425 | 3 3 4 5 3 | 3 3 4 2 4 |
| Emersonn for João Pedro | 0.229 | 0.229 0.223 0.226 0.227 0.226 | 2 5 3 2 3 | 3 3 3 4 3 |
| Emersonn for Wissa | 0.328 | 0.328 0.337 0.339 0.345 0.339 | 2 5 3 2 3 | 2 3 3 3 3 |
| Trafford for Kinsky | 0.425 | 0.425 0.407 0.426 0.395 0.411 | 5 4 3 3 3 | 4 2 4 3 3 |

Squash slope at these composites: 0.012–0.052 composite per raw unit; a one-step FDR change is 0.19–0.72 raw → 0.006–0.02 composite.

## Goals / Non-Goals

**Goals:**
- Timing that reads the fixture edge directly, on the raw difficulty scale, so a hard week or a blank actually changes the verdict.
- A board with no duplicate candidate and positional spread, without changing what "best" means (composite `gw1Gain`).
- Honest handling of swaps that never gain: dropped, not labelled.
- A sparkline that shows something that varies.

**Non-Goals:**
- Changing the ranking metric (Kavit: keep composite delta).
- Touching the transfer gate (ep-denominated), the captain horizon, or scoring.
- Fitting the threshold now — there is no labelled live data yet; it is pre-registered and revisited with the drift report.

## Decisions

**D1 — Edge from `computeFdrRun`, not from the composite.** For each side, `computeFdrRun(teamId, fixtures, currentGw, 5)`; `effective(fdr)` = the number for a single, `mean(list) − dgwBonusSteps` for a double, `blankPenaltyFdr` for a blank. `edge_k = effective(weak_k) − effective(cand_k)`. This is the only per-gameweek information the horizon has; reading it pre-squash restores its magnitude. *Alternative rejected:* rescoring with the squash removed — still weights the edge by the fitted fixture coefficient, which was never meant to encode timing.

**D2 — Near/far split with a pre-registered threshold.** `near = mean(edge[0..1])`, `far = mean(edge[2..4])`, `δ = 0.5` steps. WAIT if `near < far − δ` or the candidate blanks at index 0; SHORT_TERM if `near > far + δ`; else BUY_NOW. Constants in `lib/config.ts`:
```
HORIZON_TIMING = { nearGws: 2, thresholdSteps: 0.5, dgwBonusSteps: 2, blankPenaltyFdr: 7 }
```
Documented as pre-registered; changed only by a new change. *Alternative rejected:* sign-based tests on the edge — a single easy week would flip verdicts; averaging two vs three gameweeks is the smallest window that reads as "now vs later".

**D3 — Level gate before timing.** If `cumulativeGain[last] ≤ 0` the entry is dropped. The old third branch is retired; `SHORT_TERM` replaces `BUY_NOW_SELL_LATER` with a name that says what it means.

**D4 — Rank, then dedupe, then diversify, then take five.** Sort by `gw1Gain` desc (unchanged). Keep the first occurrence of each candidate id. First pass: the best entry per position (≤ 4). Backfill: remaining entries in rank order until five. Kavit chose both filters; the backfill keeps the board at five when fewer than four positions qualify.

**D5 — Sparkline plots `fixtureEdge`.** Values in difficulty steps (typically −3…+3, blanks/doubles beyond), zero baseline meaningful (candidate easier above, harder below), colour by timing. Glosses: BUY_NOW "Fixtures favour the move now and hold." · WAIT "Candidate's fixtures improve later — hold the transfer." · SHORT_TERM "Fixture edge now, fades after GW+2 — plan to flip." `fixtureSwing` and its badge are removed.

**D6 — `HorizonEntry` shape.** Add `fixtureEdge: number[]`, `nearEdge: number`, `farEdge: number`; keep `gwScores` and `cumulativeGain` (the LLM prompt and the level gate use them); change `timing` union; drop `fixtureSwing`. `synthesis.ts` serialises `timing`, `nearEdge`, `farEdge`, `fixtureEdge`, `cumulativeGain`.

**D7 — Worked expectation on today's board** (D1–D4 applied to the table above; edges = weak − cand):
- Kelleher/Kinsky: edges 0,−2,2,0,0 → near −1.0, far 0.67 → WAIT
- De Cuyper/Cash: 0,0,0,−3,1 → near 0, far −0.67 → SHORT_TERM
- Emersonn/João Pedro: 1,−2,0,2,0 → near −0.5, far 0.67 → WAIT
- Emersonn/Wissa: deduped (lower `gw1Gain` pairing of the same candidate)
- Trafford/Kinsky: −1,−2,1,0,0 → near −1.5, far 0.33 → WAIT
Board: 4 entries (GK, DEF, FWD, then backfill GK). Verification checks this, allowing for FDR changes between spec and apply.

## Risks / Trade-offs

- [Threshold too tight/loose] → pre-registered at 0.5 steps; the drift report and the live dataset can test edge-vs-realized later; not tunable by the loop.
- [Doubles/blanks dominate] → 2-step bonus and 7 penalty are deliberately large: a blank is the one thing a horizon must not miss.
- [Fewer than five entries] → allowed (level gate + dedupe); the UI already handles any length.
- [Prompt consumers expect `fixtureSwing`] → only `synthesis.ts`; updated in the same change.

## Migration Plan

Single PR; no persisted data. Rollback is a revert.

## Open Questions

- None blocking.
