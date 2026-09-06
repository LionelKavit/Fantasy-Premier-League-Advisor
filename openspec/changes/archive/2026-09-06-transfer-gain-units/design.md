# Design — transfer gain units

## Context

Two numbers describe a recommended transfer and they live on different scales:

| Quantity | Where computed | Unit | Role |
|---|---|---|---|
| `epNext(in) − epNext(out)` | `allocate.ts` `epDelta`, `single-transfer.ts` `deltaEp` | FPL expected points | **the decision** — must exceed 1.5 (free) / 4 (hit) |
| `gw1Gain` → `netGain = Σ gw1Gain` | `squad-ranker.ts` `computeGw1ProjectedScore`, `setup.ts`, `synthesis.ts` | composite score (0–1) | display ordering, `sorted` in `single-transfer.ts`, savings-option filter |

The ep delta is computed inside the gate and discarded; only the composite delta travels on the `ValidTransfer`/`TransferAction` objects, and two consumers (the brief, the live-eval capture) print it with an "ep" label. The confusion is structural: nothing on the objects says which unit they carry.

Constraints: no change to any recommendation; the synthesis JSON contract (`netGain` field name in the LLM prompt/parse) stays; the research harness is outside the app build but is typechecked under the scratch research tsconfig.

## Goals / Non-Goals

**Goals:**
- Every surface that shows a manager a transfer gain in "points" shows the ep delta.
- The live-eval record carries `epOut`/`epIn`/`epDelta` per move so realized `in − out` can be compared to the projection that justified the move.
- The unit of `gw1Gain`/`gw5Gain`/`netGain` is stated on the type.
- Old records degrade honestly (`unavailable`), never back-filled from a later feed.

**Non-Goals:**
- Renaming `netGain` or `gw1Gain` (touches the LLM prompt contract and every consumer for no behavioural gain).
- Adding the ep delta to `ValidTransfer` itself. It is derivable from the two attached players in one line, and adding a field invites drift between the stored value and the players' `epNext` after cache refresh.
- Changing the bar, the allocator, or the composite.

## Decisions

**D1 — Derive ep at the consumer, don't store it on `ValidTransfer`.**
`candidate.player.epNext` and `weakPlayer.player.epNext` are already on the object. The brief and the capture compute `in − out` where they print/record it. *Alternative rejected:* a new `epDelta` field on `ValidTransfer` — one more number to keep consistent, and the allocator would then have two sources of truth for the same quantity.

**D2 — The capture stores all three (`epOut`, `epIn`, `epDelta`), not just the delta.**
The eval scores "did the projection hold?" — seeing 2.0 → 8.7 is more diagnosable than +6.7, and null-handling is explicit (`epDelta: null` when either side is null). Types: `number | null` each.

**D3 — Old records are `unavailable`, not recomputed.**
`epNext` moves within hours (12.5 → 8.3 → 9.0 for one player across 2026-09-04/06). Back-computing GW4's delta from a later bootstrap would record a number the gate never saw. `score-live.ts` prints `unavailable — captured before transfer-gain-units` for those rows and excludes them from the projected-vs-realized comparison.

**D4 — The brief prints ep per move and in total; the composite disappears from the email.**
Managers act on the email; the composite delta has no "worth it" line and no meaning to them. Per-move: `OUT X → IN Y (+6.7 ep next GW)`; net: `Net projected gain: +6.7 ep`. If any side is null: `(ep unavailable)` and the net line is omitted. *Alternative rejected:* show both — two numbers for one move invites the same confusion this fixes.

**D5 — Comments, not a rename, on the types.**
Doc comments on `ValidTransfer.gw1Gain`/`gw5Gain` and `TransferAction.netGain`: "composite-score delta (0–1 scale), display ordering only — the transfer decision is ep-denominated, see `allocate.ts`". Zero risk, and it is the reader-facing fix that would have prevented both mislabels.

**D6 — `score-live.ts` reports calibration, not a verdict.**
Add `projected Δep` and `realized (in−out), next-1` columns to the captured-recommendations table and a one-line mean projected vs mean realized over scored rows. No threshold judgement here — that is new-season-readiness Task 4's job once `n` is meaningful.

## Risks / Trade-offs

- [A consumer keeps reading `netGain` as points] → the type comment plus the brief change remove the two known misreads; a grep for `netGain`/`gw1Gain` next to "ep"/"pts" strings is a task-level check.
- [The brief's ep delta disagrees with the allocator's because `epNext` refreshed between calls] → both read the same in-memory `bootstrap` cache within one `runGameweekPlan`; no separate fetch. Documented in the code comment.
- [Harness typecheck drift] → tasks include the scratch research tsconfig run.

## Migration Plan

Single PR. Additive record fields; old records readable. Rollback is a revert; no persisted format is broken either way.

## Open Questions

- None blocking. Whether the composite `gw1Gain` should keep driving `sorted` in `single-transfer.ts` (display order of alternatives) versus the ep delta is a separate, behaviour-changing question for the calibration change — out of scope here.
