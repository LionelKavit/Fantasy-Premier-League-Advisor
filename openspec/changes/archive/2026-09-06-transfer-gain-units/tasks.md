## 1. State the unit at the type

- [x] 1.1 `lib/optimizer/types.ts`: doc comments on `ValidTransfer.gw1Gain`, `gw5Gain`, and `TransferAction.netGain` — composite-score delta (0–1), display ordering only; decision is ep-denominated (`allocate.ts` `epDelta`, `single-transfer.ts` `deltaEp`).
- [x] 1.2 `lib/optimizer/synthesis.ts`: one-line comment at the `netGain: Σ gw1Gain` sites saying the field is composite, not ep (JSON contract unchanged).

## 2. Brief prints ep

- [x] 2.1 `scripts/deadline-brief.ts`: replace the `gains` map (keyed by names → `gw1Gain`) with a per-move ep delta from `t.candidate.player.epNext − t.weakPlayer.player.epNext` (null if either is null); per-move line `(+X.X ep next GW)` or `(ep unavailable)`.
- [x] 2.2 Net line: sum of per-move ep deltas, labelled `ep`; omitted when any move's delta is null. Remove the `primary.netGain` print.
- [x] 2.3 `BRIEF_DRY_RUN=1 BRIEF_FORCE=1 npx tsx scripts/deadline-brief.ts` (no send): confirm the composed text shows ep deltas that match the allocator's (spot-check one move against bootstrap `ep_next`), and no composite figure is labelled ep.

## 3. Capture records the gate's projection

- [x] 3.1 `research/squad-eval/live-types.ts`: add `epOut: number | null`, `epIn: number | null`, `epDelta: number | null` to `MoveRecord` (comment: the gate's quantity; `gw1Gain` stays composite).
- [x] 3.2 `research/squad-eval/capture.ts` `toAction`: populate the three fields from the move's players; console summary prints `Δep +X.X` and `composite +0.xxx` with explicit labels.
- [x] 3.3 Run `capture.ts` once (GW4 window is open until 2026-09-12 12:30Z; the scheduled 5h capture will overwrite it later) and confirm the record's moves carry the fields and the console labels are correct.

## 4. Score reports projected vs realized

- [x] 4.1 `research/squad-eval/score-live.ts`: captured-recommendations table gains `projected Δep` (sum over moves; `unavailable — captured before transfer-gain-units` when any move lacks `epDelta`) and `realized next-1` (existing `appG1`, `pending` if unfinished).
- [x] 4.2 Add a line under the table: `mean projected Δep` vs `mean realized next-1` over rows that have both, with `n`; omit when `n = 0`.
- [x] 4.3 Run `score-live.ts`; confirm the GW4 row (pre-change capture, if not yet overwritten by 3.3) reads `unavailable — …` and a post-change capture reads a number. *(Post-change row verified: `+6.7`. The pre-change `unavailable — captured before transfer-gain-units` branch was NOT exercised live — task 2.3's brief dry-run spawned the capture and overwrote GW4 before scoring ran, and GW2/GW3 predate the transfer leg entirely so they never reach this table. Verified by code read only.)*

## 5. Verify and close

- [x] 5.1 App gate: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` green.
- [x] 5.2 `npx tsx research/squad-eval/transfer-replay.ts`; `diff` `transfer-report.md` against the committed file — byte-identical.
- [x] 5.3 Research harness typechecks under the scratch research tsconfig (`research/squad-eval/*.ts` + `lib/**`).
- [x] 5.4 Grep check: no remaining string that labels `gw1Gain` / `netGain` as `ep`/`pts` in `scripts/`, `research/squad-eval/`, `components/`, `app/`.
- [x] 5.5 Append an as-built note (dry-run brief excerpt, one spot-checked ep delta vs bootstrap, diff result); archive via `/opsx:archive`.

> **As-built (2026-09-06):** Brief dry-run (`BRIEF_DRY_RUN=1 BRIEF_FORCE=1`, no send) now composes `OUT Scherpen → IN Tzolakis (+6.7 ep next GW)` / `Net projected gain: +6.7 ep`; spot-check against live `bootstrap-static` at the same minute: Scherpen `ep_next` 2.0, Tzolakis 8.7 → 6.7 ✓ (the previous email would have printed `+0.3 ep` — the composite delta 0.274). GW4 record (captured 21:02Z by the brief's spawned capture) carries `epOut: 2, epIn: 8.7, epDelta: 6.7` alongside composite `gw1Gain: 0.274`; `live-transfer-report.md` shows `projected Δep +6.7 | realized next-1 pending`; the calibration line is omitted (n=0 until GW4 finishes). Invariance: `transfer-report.md` byte-identical after re-running the replay; `tsc` clean, `eslint` 0 errors, `vitest` 344/344; research harness typechecks. `netGain`/`gw1Gain` names unchanged (synthesis JSON contract intact) — unit comments added at the type and at both `Σ gw1Gain` sites. The only grep hit for `gw1Gain|netGain` near "ep" is the brief's comment stating they are NOT ep. Not exercised live: the `unavailable — captured before transfer-gain-units` branch (see 4.3).
