# Design — pool-dump deadline guard

## Context

`capture.ts` runs: fetch bootstrap → pick target GW (first deadline still in the future) → full pipeline (minutes) → write record + pool. `postDeadline` was computed from the run-start clock at record-build time, and nothing consulted it before writing the pool. The scheduled brief ticks hourly inside `deadline − 5h`; the last tick can start at `deadline − 0:xx` and finish after it. The window between "target chosen" and "artefacts written" is exactly where contamination happens.

Contamination is real, not theoretical: `ep_next` for one player moved 12.5 → 8.3 → 9.0 across 2026-09-04/06, and post-lock it also absorbs confirmed lineups.

## Goals / Non-Goals

**Goals:**
- No post-deadline row ever reaches `live-dataset.csv`.
- No post-deadline record ever replaces a clean one in `live-log.json`.
- The decision is a pure, unit-tested function; `capture.ts` just applies its plan.
- Withheld artefacts are still kept (sidecar / flagged record) so a late run is auditable, and the builder says what it ignored.

**Non-Goals:**
- Preventing the late run itself (the scheduler is out of scope; the guard makes lateness harmless).
- Retro-validating old pool files (they predate the column and were pre-deadline by construction — recorded, not re-derived).
- Changing scoring semantics for post-deadline records (already excluded).

## Decisions

**D1 — Re-read the clock at write time.** The target-selection clock is the wrong one; the pipeline duration is the whole problem. `writeAt = new Date()` after the pipeline, and it is also the record's `capturedAt` (the more conservative stamp).

**D2 — Sidecar file, not just a flag.** A flag alone relies on every consumer remembering to filter. A distinct filename (`gwNN.post-deadline.csv`) means the builder's existing `^gw\d+\.csv$` regex excludes it with no new logic, and a human browsing `pool/` sees the quarantine. The `post_deadline` column is kept as a second line of defence for rows that somehow land in a clean file.

**D3 — Preserve a clean record; write a flagged one only into a vacuum.** A flagged record has audit value (what the pipeline said, even if late) but must never cost a clean one. "Clean" = `captureMode` pre-deadline (or absent, for pre-2026-09-04 records) and `postDeadline === false`; a retrospective backfill is not clean and does not block a write. *Alternative rejected:* never write post-deadline records — loses the audit trail for a GW with no other capture.

**D4 — Pure function in `live-types.ts`.** That module is side-effect-free by contract (importing a value from `capture.ts` runs a capture — the 2026-09-04 lesson), so it is the right home for logic the test suite must import.

**D5 — Existing pool files are treated as clean.** They have no `post_deadline` column; the builder reads `r.post_deadline === "1"` and absence is not `"1"`. Recorded in the proposal rather than back-filling the column into files the capture did not write this way.

## Risks / Trade-offs

- [Clock skew between the machine and FPL's deadline] → the guard uses the deadline string FPL publishes and the local clock; a machine clock minutes fast produces a false "post-deadline" quarantine (safe direction), minutes slow produces a leak of at most that skew. Acceptable; a check that NTP is on is the operational mitigation, not code.
- [Sidecar files accumulate] → they are tiny (≈10 KB) and only appear when a run is late; the builder lists them so they are visible.
- [A future consumer reads `pool/` directly] → the sidecar naming makes the quarantine self-describing; the `post_deadline` column catches the rest.

## Migration Plan

Additive. No changes to existing files in `pool/` or `live-log.json`. Rollback is a revert.

## Open Questions

- None blocking.
