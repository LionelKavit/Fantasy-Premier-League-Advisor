# Design — target-gameweek alignment

## Context

FPL's event flags across a week (verified 2026-09-18 08:00Z, GW5 deadline 17:30Z):

| Moment | `is_current` | `is_next` | `finished` on current |
|---|---|---|---|
| GW4 in play (Sat–Mon) | 4 | 5 | false |
| Preparing GW5 (Mon night → Fri 17:30) | **4** | 5 | true |
| After GW5 deadline | 5 | 6 | false |

The runtime reads `is_current` and calls it "current". The preparation window — where every recommendation is made — is the row where that is wrong by one. The capture harness (`research/squad-eval/capture.ts`) already computes the right thing (`!finished && deadline_time > now`), as does the demo-season derivation (`lib/demo/squad.ts`), so the definition exists; it was never applied to the analysis.

Who consumes the analysis gameweek today (from a full grep, 2026-09-18): fixture signals (`lib/pipeline/fixture-analyzer.ts` → `getPlayerFixtures`/`computeFdrRun`, window `event >= gw`), statistical signals (`starts / gw`, suspension thresholds), captain scoring and both horizons, gameweek flags (BGW/DGW), chip windows/expiry/last-call (`lib/optimizer/chip-interaction.ts`, `chip-orchestrator.ts`), team news cache key, plan cache keys, scout system prompt and brief, optimizer/captain synthesis prompts, header/verdict/long-term labels, `simulate.ts`, and — the one that must NOT move — `fetchPicks(teamId, gw)` in the pipeline and the demo/manager plan contexts.

## Goals / Non-Goals

**Goals:**
- One definition of the target gameweek, shared by runtime and harness; the analysis gameweek is the target.
- Locked-picks fetch stays on the last locked gameweek.
- An explicit in-play gameweek for display during a live round.
- Runtime fixture/statistical inputs aligned with how the shipped weights were fitted.
- Replays byte-identical (they never read the bootstrap); the change is a runtime input fix, not a model change.
- Dataset rows say which gameweek their fixture columns describe; nothing already captured is rewritten.

**Non-Goals:**
- Refitting weights, changing the fixture window length, or touching the composite.
- Retro-computing point-in-time fixture signals for GW4/GW5 rows (impossible faithfully; the user chose to leave them as captured).
- Reworking the risk profile's `gwsRemaining` (it uses `is_current`, which yields "remaining including the target" — already correct).

## Decisions

**D1 — Three named gameweeks on `BootstrapData`.**
`targetGameweek` = first event with `!finished && deadline_time > now`; `inPlayGameweek` = the event with `is_current && !finished && deadline_time <= now`, else null; `currentGameweek` unchanged (`is_current`). Detection lives in `lib/gameweek.ts` as pure functions taking `now` (unit-testable across the five states: pre-season, in play, preparing, season end, mid-rollover). `fetchBootstrap` computes them once. *Alternative rejected:* `is_next` — it is null pre-season and during rollover and does not encode "deadline still in the future".

**D2 — `SquadAnalysisResult.currentGw` keeps its name and takes the target meaning; `squadGw` and `inPlayGw` are added.**
Renaming `currentGw` would touch ~60 sites for no semantic gain; every consumer except the picks fetch *wants* the target, and the replays/backtest already pass the target under this name. `squadGw` is required (the one place it is used is the picks fetch, and tests must state it). `inPlayGw: number | null` is display-only. The type comment states all three meanings.

**D3 — Fallbacks at the season boundaries.**
Pre-season: `targetGameweek` = GW1; `squadGw` = null → the pipeline's picks fetch is skipped/404-tolerant as today (demo path). Season over / rollover: no future deadline → `targetGameweek` falls back to `currentGameweek` (GW38 or last finished) so `isFinalGw` and off-season demo behaviour hold. `deadline` = target's `deadline_time`.

**D4 — Transfer horizon rescores from the target (offsets 0–4); captain horizon keeps offsets 1–5.**
Transfer horizon: "next five including this one" — same gameweeks as before during the preparation window, so its output is unchanged; `horizonLength = min(5, 38 − target + 1)`. Captain horizon: "future weeks beyond this one" for the triple-captain comparison against this week's baseline — offsets 1–5 from the target are now genuinely future; its `immediate` flag becomes false for every entry because `ep_next` describes the target only (the target is scored separately with `immediate = true`). This is a deliberate behaviour change to the TC horizon's first entry, previously the target itself.

**D5 — Chip logic needs no edits, only the new origin.** `currentGw !== deadline` (last call), `gameweek >= currentGw` (windows), `deadline − currentGw` (expiry pressure) all read correctly with the target: a first-half chip's last call now fires when GW19 is the target, not after its deadline.

**D6 — Harness: record alignment, never rewrite.** `capture.ts` sets `squadAsOfGw = analysis.squadGw`, `pipelineGw = analysis.currentGw` (now the target — equal to the record's `gw` for a clean capture), and adds `fixture_gw` to every pool/universe row. `live-types.ts` documents that `pipelineGw` before this change carried the locked gameweek. `pool/gw04*.csv`, `pool/gw05*.csv`, `live-log.json` records are not modified.

**D7 — Fit eligibility: aligned rows only (proposed default).** `fit_live.eligible()` requires `fixture_gw == gw`; a missing column counts as misaligned. The report states how many rows were excluded and why. The only rows this affects today are GW4/GW5 (≈1,300 universe rows, ~80 eligible), which cannot be aligned point-in-time. See Open Questions.

**D8 — API routes.** `/api/squad` keeps `detectCurrentGameweek` for picks; `/api/fixtures` uses the target detector for FDR runs and flags. `detectCurrentGameweek` stays for the picks case; a new `detectTargetGameweek` sits beside it.

## Risks / Trade-offs

- [A consumer that truly wanted "last played" now gets the target] → the grep-derived consumer list found exactly one (picks fetch), handled by `squadGw`; the risk profile stays on `currentGameweek`. Tests pin the statistical `starts / gw` denominator to the target (as the backtest does).
- [Captain-horizon first entry loses `ep_next`] → intended; the TC advice compares future-week deterministic scores to this week's ep-blended baseline. The captain horizon tests are updated to state this.
- [Behaviour shifts mid-week for the tick] → the tick runs whatever is checked out; landing this on `main` and pulling before a capture window means that capture and every later one carry aligned fixture columns. Earlier records keep `pipelineGw = locked` semantics, documented.
- [Fixture-driven recommendations change visibly the day this lands] → expected and the point; the as-built note records a before/after captain multiplier and transfer ordering on the live squad.

## Migration Plan

Single PR. No persisted-format break: new optional CSV column, new record fields, existing rows untouched. Rollback is a revert.

## Open Questions

_Both resolved by Kavit on 2026-09-18: D7 → option (a); header → show both only while `inPlayGw` is non-null._

- **D7 is Kavit's call.** Options: (a) exclude rows without/with mismatched `fixture_gw` from the fit (proposed — honest, costs ~80 eligible rows); (b) keep them in and accept the `fixture` coefficient is fitted on mixed alignment for the first two gameweeks. Both leave the captured files untouched, per the decision to keep them as they are.
- Whether the header shows the in-play gameweek alongside the target during a live round ("GW5 · GW4 in play") or only the target. Proposed: show both only while `inPlayGw` is non-null.
