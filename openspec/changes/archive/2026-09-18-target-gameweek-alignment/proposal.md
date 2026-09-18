# Target-gameweek alignment — score, plan and talk about the gameweek being prepared, not the one just played

## Why

The app defines "current gameweek" as FPL's `is_current` flag (`lib/fpl-api.ts` → `bootstrap.currentGameweek`). FPL keeps that flag on the gameweek that just finished until the next deadline passes, so for the whole preparation week — the only time the app is used — every consumer runs one gameweek behind. On 2026-09-18 (GW5 deadline day) the chat welcomed the manager to GW4 and quoted a deadline six days gone; the header read 4; and, more seriously, the fixture window in `lib/gameweek.ts` (`event >= currentGwId`) started at the already-played GW4 match, so the captain fixture multiplier, the fixture-adjusted transfer ordering, the "poor fixture run" weak-spot reasons, blank/double-gameweek detection, the composite's fixture term, and the live universe dataset's fixture columns all described last weekend's opponents as the upcoming ones. The historical backtest (which fitted the shipped weights) and both research replays pass the **target** round to every scorer, so the runtime has been running the fitted `fixture` weight on data one gameweek out of phase with what it was fitted on. `ep_next`-gated decisions were unaffected (FPL's projection is always for the upcoming gameweek), and the transfer horizon happened to be correct because it started at `currentGw + 1`.

## What Changes

- **Three gameweek values, each named for what it is.** The bootstrap exposes `targetGameweek` (the first unfinished gameweek whose deadline is still in the future — the one being prepared), `inPlayGameweek` (a gameweek whose deadline has passed but which is not yet finished; null otherwise — the brief live window between kick-off and the final whistle), and keeps `currentGameweek` (FPL's `is_current`; the last locked gameweek, whose picks are public).
- **The analysis gameweek becomes the target.** `SquadAnalysisResult.currentGw` and `deadline` now mean the target gameweek and its deadline — the same meaning the backtest and replays already use — and every scorer, planner, chip window, alert, prompt and label inherits it. A new `squadGw` carries the last locked gameweek, used only to fetch the picks (the manager's in-progress changes for the target are never public). `inPlayGw` is carried for display.
- **Horizon offsets follow the new origin.** The transfer horizon rescored `currentGw + 1 … + 5`; it now rescores the target and the four gameweeks after it (same gameweeks as before during the preparation window — the output does not move). The captain horizon keeps `target + 1 … + 5` as genuinely future weeks and stops applying `ep_next` to its first entry, since `ep_next` describes the target only.
- **Chip last-call fires on time.** "Last playable gameweek" checks compare the target to GW19/GW38, so the first-half last-call now appears while GW19 can still be played rather than after its deadline.
- **API routes split the same way.** `/api/squad` keeps fetching picks for the locked gameweek; `/api/fixtures` computes its runs from the target.
- **Harness records alignment going forward.** Captures write `squadAsOfGw = squadGw`, `pipelineGw = target`, and a `fixture_gw` column (= the gameweek the fixture signals were computed from) on every pool and universe row. Files already captured are left exactly as they are.
- **The fit honours alignment.** `fit_live.py` uses a row only when `fixture_gw == gw`; rows without the column (everything captured before this change) are excluded from the fit and counted in the report. *(Default proposed here — see Open Questions in the design; Kavit's call.)*

## Capabilities

### New Capabilities
- `target-gameweek-alignment`: the system distinguishes the target, in-play and last-locked gameweeks; all scoring, planning and presentation key off the target; the live dataset records which gameweek its fixture signals describe.

### Modified Capabilities
<!-- None under openspec/specs/. Related archived changes: composite-clamp-relax (weights fitted on target-aligned fixtures), live-dataset-universe (dataset schema), squad-eval-captain-live (record fields). -->

## Impact

- `lib/types.ts`, `lib/fpl-api.ts`, `lib/gameweek.ts` (detectors), `lib/pipeline/index.ts`, `lib/pipeline/types.ts`, `lib/plan/context.ts` (manager + demo paths), `lib/optimizer/horizon.ts`, `lib/captain/horizon.ts`, `app/api/fixtures/route.ts`, `lib/__tests__/factories.ts` + test literals, `research/squad-eval/capture.ts`, `research/squad-eval/live-types.ts`, `research/squad-eval/transfer-replay.ts` + `calibrate-tauc.ts` (literal gains `squadGw`), `research/composite-backtest/fit_live.py` (+ test).
- Behaviour that changes on purpose: header/greeting/deadline label; every fixture-driven signal during the preparation week; chip last-call timing; captain-horizon first entry no longer uses `ep_next`. Behaviour that must not change: both research replays (byte-identical), `ep_next`-gated transfer/captain decisions, picks fetched for the locked gameweek.
