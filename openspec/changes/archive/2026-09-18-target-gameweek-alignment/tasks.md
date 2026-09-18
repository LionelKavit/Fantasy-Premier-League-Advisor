## 1. Gameweek detection

- [x] 1.1 `lib/gameweek.ts`: add `detectTargetGameweek(events, now)` (first `!finished` with `deadline_time > now`; fallback `detectCurrentGameweek`) and `detectInPlayGameweek(events, now)` (`is_current && !finished && deadline_time <= now`, else null). Keep `detectCurrentGameweek`.
- [x] 1.2 `lib/types.ts`: `BootstrapData` gains `targetGameweek: Gameweek | null` and `inPlayGameweek: Gameweek | null`; `SquadAnalysisResult` gains `squadGw: number | null` (required) and `inPlayGw: number | null`; comment the three meanings.
- [x] 1.3 `lib/fpl-api.ts` `fetchBootstrap`: populate both new fields with `Date.now()`.
- [x] 1.4 Unit tests (`lib/__tests__/gameweek-detect.test.ts`): preparation week, live round, pre-season, season over, mid-rollover.

## 2. Analysis on the target

- [x] 2.1 `lib/pipeline/index.ts`: `currentGw`/`deadline` from `targetGameweek`; `squadGw` from `currentGameweek` for `fetchPicks`; pass `inPlayGw`; team-news cache keyed by target.
- [x] 2.2 `lib/plan/context.ts` (manager and demo paths): same split; demo profile uses the target.
- [x] 2.3 `lib/optimizer/horizon.ts`: offsets 0–4 from `currentGw`; `horizonLength = min(5, 38 − currentGw + 1)`.
- [x] 2.4 `lib/captain/horizon.ts`: keep offsets 1–5; `immediate` false for every entry; update `lib/__tests__/captain/horizon.test.ts` to state it.
- [x] 2.5 `app/api/fixtures/route.ts`: use `detectTargetGameweek`; `/api/squad` unchanged (locked picks). If the header is to show the in-play gameweek, thread `inPlayGw` through `plan` → `components/Header.tsx` (design open question 2).
- [x] 2.6 Test literals: `lib/__tests__/factories.ts` `makeSquadAnalysisResult` (`squadGw` default = `currentGw − 1`, `inPlayGw: null`), `research/squad-eval/transfer-replay.ts` and `calibrate-tauc.ts` literals (`squadGw: gw − 1`).

## 3. Harness and fit

- [x] 3.1 `research/squad-eval/capture.ts`: `squadAsOfGw = analysis.squadGw`, `pipelineGw = analysis.currentGw`; add `fixture_gw` to `POOL_COLUMNS`/`poolRow` (value `analysis.currentGw`). `live-types.ts`: document that pre-change `pipelineGw` carried the locked gameweek.
- [x] 3.2 `research/composite-backtest/fit_live.py` `eligible()`: require `fixture_gw == gw` (missing column ⇒ excluded); count and report exclusions; `test_fit_live.py` case for legacy rows. *(Confirm D7 with Kavit before implementing; alternative (b) is a one-line change.)*
- [x] 3.3 Do NOT modify `pool/gw04*.csv`, existing `pool/gw05*.csv`, or existing `live-log.json` records.

## 4. Verify

- [x] 4.1 `tsc`/`eslint`/`vitest` green (app); research harness typechecks; Python tests green.
- [x] 4.2 Replays: `replay.ts` and `transfer-replay.ts` byte-identical to committed.
- [x] 4.3 Live run on the current squad (scratch script): `currentGw = target`, `squadGw = locked`, `deadline` = target's; for three players `gw1Fdr` equals their target-gameweek fixture; record the before/after captain fixture multiplier for the top two captains and the before/after transfer ordering as the as-built evidence.
- [x] 4.4 `BRIEF_DRY_RUN=1 BRIEF_FORCE=1` brief names the target gameweek and its deadline; the scout system prompt's "Current situation" line names the target.
- [x] 4.5 One capture after the change (pre-deadline): record `pipelineGw = gw`, `squadAsOfGw = gw − 1`, `fixture_gw = gw` on every row; earlier files byte-identical.
- [x] 4.6 As-built note; archive via `/opsx:archive`. After merge: `git checkout main && git pull` in the checkout before the next capture window so the tick carries the fix.

> **As-built (2026-09-18):** `detectTargetGameweek` / `detectInPlayGameweek` in `lib/gameweek.ts` (6 unit tests over preparation week, live round, deadline day, pre-season, season over, rollover); `BootstrapData.targetGameweek`/`inPlayGameweek`; `SquadAnalysisResult.currentGw` = target, `squadGw` = locked (picks fetch only), `inPlayGw` (display; header shows `GW · GW<n> in play` while non-null); manager, lite-base and demo contexts split the same way; transfer horizon offsets 0–4 (same gameweeks as before in the preparation window); captain horizon never uses the ep blend (test added); `/api/fixtures` on the target, `/api/squad` unchanged. Harness: `pipelineGw` = target, `squadAsOfGw` = locked, `fixture_gw` column on every pool/universe row; `fit_live.eligible()` excludes rows lacking or mismatching `fixture_gw` and the report states the count + reason (option a, Kavit 2026-09-18). **Evidence (live squad, run in the GW5 live-round state — the GW5 deadline passed during the session, so the preparation-week case is the 08:00Z screenshot/bootstrap dump in the proposal):** before → `currentGw 5`, first fixtures GW5 (Groß ARS H fdr 4, Haaland SUN H fdr 2), captain Haaland 8.20 ×1.17; after → `currentGw 6, squadGw 5, inPlayGw 5, deadline 2026-10-10`, first fixtures GW6 (Groß SUN A fdr 3, Haaland LIV A fdr 4), captain B.Fernandes 6.19 ×1.05 with Haaland 5.71 ×0.88; transfer ordering moved (Kinsky→Kelleher 0.479 top); horizon GW6–10 both before and after (as designed). Brief dry-run: `GW 6 · deadline Sat 10 Oct, 10:00 GMT`. Capture after the change: GW6 record `pipelineGw 6, squadAsOfGw 5`, `fixture_gw = 6` on all 55 + 659 rows; `gw04.*` (mtime 2026-09-12) and `gw05.*` (byte-identical, no `fixture_gw` column) untouched. Gate: `tsc` clean (app + research), `eslint` 0 errors, `vitest` 373/373, Python tests green, both replays byte-identical. **Operational note:** the Mac slept through the entire GW5 capture window (no tick between 08:11Z and 17:30:00Z); the only GW5 record is the manual 06:40Z capture — no alert fired because that clean record exists. This branch is checked out, so the hourly tick now runs the aligned code; after merge run `git checkout main && git pull`.
