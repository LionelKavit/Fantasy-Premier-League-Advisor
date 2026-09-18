## 1. Types and config

- [x] 1.1 `lib/config.ts`: `HORIZON_TIMING = { nearGws: 2, thresholdSteps: 0.5, dgwBonusSteps: 2, blankPenaltyFdr: 7 }` with a pre-registered comment (changed only via a new change).
- [x] 1.2 `lib/optimizer/types.ts`: `HorizonEntry` — add `fixtureEdge: number[]`, `nearEdge: number`, `farEdge: number`; `timing: "BUY_NOW" | "WAIT" | "SHORT_TERM"`; remove `fixtureSwing`; document each field's unit.

## 2. Horizon logic

- [x] 2.1 `lib/optimizer/horizon.ts`: per entry, `computeFdrRun` for both teams from `currentGw` (5 GWs); `effective()` per D1; `fixtureEdge`, `nearEdge`, `farEdge`; timing per D2 (blank-at-target ⇒ WAIT).
- [x] 2.2 Level gate: drop entries with `cumulativeGain[last] ≤ 0` (keep `gwScores`/`cumulativeGain` for the survivors).
- [x] 2.3 Selection: sort by `gw1Gain` desc → dedupe by candidate id (first wins) → one-per-position pass → backfill to 5.
- [x] 2.4 `lib/optimizer/synthesis.ts`: serialise `timing`, `nearEdge`, `farEdge`, `fixtureEdge`, `cumulativeGain`; drop `fixtureSwing`; note in the prompt that `SHORT_TERM` replaces the old label.

## 3. UI

- [x] 3.1 `components/panel/HorizonSparkline.tsx`: `TIMING` map for the three timings with fixture glosses; sparkline over `fixtureEdge` (zero baseline kept; colour by timing); remove the `fixture swing` badge.

## 4. Tests

- [x] 4.1 Rewrite `lib/__tests__/optimizer/horizon.test.ts`: the four spec scenarios for timing (hard-first ⇒ WAIT; fades ⇒ SHORT_TERM; steady ⇒ BUY_NOW; blank ⇒ WAIT; double edge = bonus); level gate; dedupe; one-per-position + backfill; fewer-than-five; ranking still by `gw1Gain`; end-of-season length.
- [x] 4.2 Fix any other test referencing `fixtureSwing`/`BUY_NOW_SELL_LATER` (grep: `lib/__tests__/tc-coherence.test.ts`).

## 5. Verify

- [x] 5.1 `tsc`/`eslint`/`vitest` green; both replays byte-identical (horizon is not in the replays — invariance is a sanity check).
- [x] 5.2 Live run on the current squad (scratch script): print each entry's `fixtureEdge`, `nearEdge`, `farEdge`, `timing`; confirm no duplicate candidate, positional spread with backfill, and that the board is no longer uniformly `BUY_NOW`. Compare against D7's expected verdicts, noting any FDR changes since 2026-09-18.
- [x] 5.3 Dev server: Long Term tab shows the edge sparklines and new labels/glosses; no `fixture swing` badge.
- [x] 5.4 As-built note (live board before/after); archive via `/opsx:archive`.

> **As-built (2026-09-18):** `HORIZON_TIMING` pre-registered in `lib/config.ts` (nearGws 2, threshold 0.5 steps, DGW bonus 2, blank penalty 7); `HorizonEntry` gains `fixtureEdge`/`nearEdge`/`farEdge`, `timing` ∈ {BUY_NOW, WAIT, SHORT_TERM}, `fixtureSwing` removed; `computeHorizon` rewritten — rank by `gw1Gain` (unchanged) → dedupe by candidate → level gate (`cumulativeGain[4] > 0`) → one-per-position pass → backfill to five; timing from `computeFdrRun` edges via `effectiveFdr`; synthesis prompt serialises the edge fields; `HorizonSparkline` plots `fixtureEdge` with fixture glosses and no badge. Tests: `horizon.test.ts` rewritten (11 cases: the four spec timing scenarios incl. blank/double, level gate, dedupe, one-per-position + backfill, fewer-than-five, season-end padding); suite 391/391 (53 files); `tsc` clean; `eslint` 0 errors; both replays byte-identical; no stale `fixtureSwing`/`BUY_NOW_SELL_LATER` references. **Live board (target GW6, 13 valid transfers) before → after:** five entries all `BUY_NOW` (Kelleher/Kinsky, De Cuyper/Cash, Emersonn/João Pedro, Emersonn/Wissa, Trafford/Kinsky) → five entries, three timings, no duplicate candidate: WAIT Kelleher/Kinsky (edge 0,−2,+2,0,0; near −1.00 far 0.67), SHORT_TERM De Cuyper/Cash (0,0,0,−3,+1; 0.00/−0.67), WAIT Emersonn/João Pedro (+1,−2,0,+2,0; −0.50/0.67), BUY_NOW Ajayi/Cash (0,0,+1,0,−1; 0.00/0.00 — a transfer that became valid after the spec's D7 table and backfills the DEF slot), WAIT Trafford/Kinsky (−1,−2,+1,0,0; −1.50/0.33 — GK backfill). Emersonn/Wissa deduped as designed. D7's three named verdicts match exactly. `/api/plan?team_id=2558300` through the dev server returns the same five with the edge fields and no `fixtureSwing`; page compiles with 0 errors. **Honest caveat:** four of five verdicts are WAIT/SHORT_TERM because this week's candidates have hard early fixtures — the discrimination is real, but the 0.5-step threshold has no data behind it yet; it is pre-registered and the drift report is where it gets tested once labelled live rows exist.
