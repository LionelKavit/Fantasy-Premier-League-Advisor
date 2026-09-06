# Pool-dump deadline guard — a late capture never contaminates the season log or the training set

## Why

The live-eval capture chooses its target gameweek by the clock at the *start* of the run, then spends minutes in the full pipeline (element summaries, LLM context, optimizer). The launchd tick nearest a deadline can therefore cross the deadline mid-run. When it does, the record is stamped `postDeadline: true` (scoring already excludes it) — but two things still leak: (1) the scored-pool dump is written to `pool/gwNN.csv` regardless, overwriting a clean pre-deadline dump with rows whose `ep_next`/ownership were read after picks locked, and `score-live.ts` would ingest them into `live-dataset.csv`; (2) the flagged record itself overwrites the clean pre-deadline record in `live-log.json`, so the captain/transfer eval loses that gameweek. Both violate the harness's one invariant: everything scored or trained on is point-in-time.

## What Changes

- **The clock is re-read at write time**, not only at target selection. A pure `planCaptureWrite` decides, from `now`, the deadline, and any existing record: whether the record may be written, and which pool file to write.
- **A post-deadline capture never overwrites a pre-deadline artefact.** If a clean (pre-deadline, non-retrospective) record exists it is preserved untouched; the flagged record is written only when nothing clean exists (audit value, still excluded from scoring).
- **Post-deadline pool rows go to a sidecar** `pool/gwNN.post-deadline.csv` that the dataset builder never reads. Every pool row also carries a `post_deadline` column (0/1), and the builder drops any row flagged `1` even if it appears in a clean file (belt and braces).
- **The builder reports what it withheld**: dropped-row count and ignored sidecar files in its console line.
- **Unit-tested**: the guard is a pure function in `live-types.ts` with a vitest suite under `research/squad-eval/` (already in the vitest include).

## Capabilities

### New Capabilities
- `pool-dump-deadline-guard`: capture artefacts written after a gameweek's deadline are quarantined from scoring and training and can never displace a pre-deadline artefact.

### Modified Capabilities
<!-- None under openspec/specs/. The archived `captain-live-eval` spec's "Capture timing is validated" requirement is extended here (new capability rather than delta, since the archive is closed). -->

## Impact

- `research/squad-eval/live-types.ts` (`planCaptureWrite`, `isPreDeadlineRecord`), `capture.ts` (guard + `post_deadline` column + sidecar), `score-live.ts` (ingest filter + report), new `capture-guard.test.ts`.
- No app code. Existing pool files lack the `post_deadline` column; the builder treats absence as clean (they were captured pre-deadline by construction).
