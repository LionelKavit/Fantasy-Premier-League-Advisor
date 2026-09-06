## 1. Guard logic

- [x] 1.1 `research/squad-eval/live-types.ts`: add `CaptureWritePlan`, `isPreDeadlineRecord`, and pure `planCaptureWrite({ gw, deadline, now, existing })` implementing: pre-deadline → write record + `gwNN.csv`; post-deadline → `gwNN.post-deadline.csv`, and write the record only when no clean record exists; human-readable `note`.
- [x] 1.2 `research/squad-eval/capture-guard.test.ts`: cover the six cases in the spec plus `isPreDeadlineRecord`'s treatment of a missing `captureMode`.

## 2. Capture applies the plan

- [x] 2.1 `capture.ts`: re-read the clock after the pipeline (`writeAt`), call `planCaptureWrite` with the existing record, use `writeAt` as `capturedAt` and `plan.postDeadline` as the record flag.
- [x] 2.2 `capture.ts`: add `post_deadline` to `POOL_COLUMNS`/`poolRow`; write the pool to `plan.poolFile`; record `pool.file` accordingly.
- [x] 2.3 `capture.ts`: write `live-log.json` only when `plan.writeRecord`; print `plan.note` to stderr when set; console summary states whether the record was flagged or withheld.

## 3. Builder quarantines

- [x] 3.1 `score-live.ts`: read only `^gw\d+\.csv$`; drop rows with `post_deadline === "1"`; treat a missing column as clean.
- [x] 3.2 `score-live.ts`: console line reports dropped-row count and ignored `*.post-deadline.csv` files.

## 4. Verify

- [x] 4.1 `npx vitest run` green including the new suite; research harness typechecks under the scratch research tsconfig; app `tsc`/`eslint` unaffected.
- [x] 4.2 `score-live.ts` runs against the existing `pool/gw04.csv` (no `post_deadline` column) and ingests all 55 rows with no dropped/ignored notice.
- [x] 4.3 Simulate a late run without waiting for a real one: copy `pool/gw04.csv` to a scratch `gw99.post-deadline.csv` sidecar plus a scratch `gw99.csv` with one row flagged `post_deadline=1`, run the builder, confirm the sidecar is ignored, the flagged row is dropped and counted, then delete the scratch files.
- [x] 4.4 As-built note; archive via `/opsx:archive`.

> **As-built (2026-09-06):** `planCaptureWrite` + `isPreDeadlineRecord` in `live-types.ts`; 7 tests in `capture-guard.test.ts` (suite now 351/351, 49 files). `capture.ts` re-reads the clock after the pipeline (`writeAt` = `capturedAt`), routes the pool to `plan.poolFile`, writes the record only when `plan.writeRecord`, prints the plan note to stderr. `score-live.ts` ingests `^gw\d+\.csv$` only, drops `post_deadline=1` rows, reports drops + ignored sidecars. Verified: existing `gw04.csv` (no column) ingests all 55 rows with no notice; simulated late run (scratch `gw99.csv` with 1 of 3 rows flagged + `gw99.post-deadline.csv` sidecar) → builder reported `Dropped 1 post-deadline row(s). Ignored 1 post-deadline sidecar file(s): gw99.post-deadline.csv.`, dataset held 57 rows with 2 from gw99 and none flagged; scratch removed, dataset restored to 55. Research harness typechecks; app `tsc`/`eslint` unaffected (0 errors). Not exercised: a genuinely late scheduled run — the guard's write-time branch is covered by the unit tests, not by a real deadline crossing. Second leak closed under the same rule: a flagged record no longer overwrites a clean one in `live-log.json` (previously it did, because `postDeadline` was computed from the run-start clock and nothing checked it before the write).
