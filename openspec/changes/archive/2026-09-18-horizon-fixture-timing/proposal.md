# Horizon fixture timing — timing from the fixture edge, not the squashed composite; one candidate, one position per entry

## Why

Every Long Term horizon entry reads "Buy now". The timing test in `lib/optimizer/horizon.ts` asks only whether the cumulative composite gain is positive at gameweek one and at gameweek five. It cannot fail for any entry that reaches the horizon: entries are the top five by today's composite gain from candidates at the top of their position, so the level gap is positive by construction (0.23–0.48 on 2026-09-18); the only input that varies across the five gameweeks is the fixture term (raw weight 0.8–2.9); and the logistic squash flattens it — at the composites these candidates sit on (0.89–0.98) a full one-step change in fixture difficulty moves the composite by 0.006–0.02, twenty to seventy times smaller than the level gap. Live example: Emersonn for Wissa has fixture difficulties 2,5,3,2,3 against Wissa's 2,3,3,3,3 — a difficulty-5 week in GW7 — and the per-gameweek gain *rises* that week (0.328 → 0.337). The sparkline is a straight line, `fixtureSwing` never fires, and the third branch ("Buy now, sell later") also swallows swaps that never gain at all (João Pedro → Calvert-Lewin, negative at every gameweek, was labelled "buy now, sell later" on 2026-09-12). Separately, the GW4 board showed Tzolakis twice (against Scherpen and against Kinsky) and five goalkeepers: the ranking has no dedupe and no positional diversity.

## What Changes

- **Timing comes from the raw per-gameweek fixture edge**, computed from each side's `computeFdrRun` for the target gameweek onward: `edge_k = effective(weak FDR_k) − effective(candidate FDR_k)` in difficulty steps (positive = the candidate has the easier week). A blank counts as a difficulty of 7 (two steps worse than the hardest fixture); a double counts as the mean difficulty minus a 2-step bonus. Near = mean of the first two gameweeks, far = mean of the last three. **WAIT** when near trails far by more than the threshold, or the candidate blanks in the target gameweek; **SHORT_TERM** (renamed from `BUY_NOW_SELL_LATER`) when near leads far by more than the threshold; **BUY_NOW** otherwise. Threshold 0.5 steps, pre-registered in `lib/config.ts` (`HORIZON_TIMING`).
- **A level gate, not a label.** Entries whose five-gameweek cumulative composite gain is not positive are dropped rather than labelled.
- **Ranking stays composite `gw1Gain` (Kavit's decision), then dedupe and diversify:** one entry per candidate (the highest-gain pairing wins) and a first pass of one per position, backfilled to five from the remaining ranked entries if fewer than four positions qualify.
- **The sparkline plots the fixture edge** (which varies) instead of the cumulative composite gain (which cannot); the timing glosses describe fixtures; the `fixture swing` badge is removed (its meaning is now the timing itself).
- `HorizonEntry` gains `fixtureEdge: number[]`, `nearEdge`, `farEdge`; `fixtureSwing` is removed; the optimizer synthesis prompt serialises the new fields.
- **Expected live outcome** on the 2026-09-18 board (checked in verification): four entries instead of five duplicated ones — Kelleher for Kinsky WAIT, De Cuyper for Cash SHORT_TERM, Emersonn for João Pedro WAIT, Trafford for Kinsky WAIT — instead of five "Buy now".

## Capabilities

### New Capabilities
- `horizon-fixture-timing`: a horizon entry's timing is decided by the per-gameweek fixture edge between candidate and weak player; non-gaining swaps are dropped; the board carries at most one entry per candidate and prefers one per position; the sparkline shows the edge.

### Modified Capabilities
<!-- None under openspec/specs/. -->

## Impact

- `lib/optimizer/horizon.ts`, `lib/optimizer/types.ts` (`HorizonEntry`), `lib/config.ts` (`HORIZON_TIMING`), `components/panel/HorizonSparkline.tsx`, `lib/optimizer/synthesis.ts` (prompt fields), `lib/__tests__/optimizer/horizon.test.ts` (rewritten), `lib/__tests__/tc-coherence.test.ts` if it references `fixtureSwing`.
- No change to the transfer decision (ep-gated), captaincy, the captain horizon, scoring, or replays.
