## Tasks — new-season readiness (trigger: 2026-27 GW1, ~mid-Aug 2026)

### Task 1: Cold-start composite fix (runtime — BEFORE GW1)
**Capability:** new-season-readiness
- [x] `lib/pipeline/composite-scorer.ts`: remove/relax the flat `insufficientDataFallbackScore` early-return so low-minute players still get the `epNext`-anchored score (zero the noisy per-90 deterministic signals if minutes are thin, but keep the `epNext` term). Fall back to the constant only when `ep_next` is also null.
- [x] `lib/config.ts`: keep `minMinutes` as the gate for *deterministic* signals; document the new behavior.
- [x] Verify: GW1 pitch shows a spread (not all 3.0/10); `tsc`/`eslint`/`vitest` clean; update tests that assert the flat-0.3 path.

> **As-built (2026-08-01):** design option (a) — one scoring path. Added `MarketSignals.epNextAvailable` (null `ep_next` was indistinguishable from a genuine 0.5 signal); under `minMinutes` the per-90 signal-map entries are zeroed but `epNext` + `fixture` (needs no accrued minutes) are kept; flat 0.3 only when `ep_next` is null. Verified against live 2026-27 bootstrap (GW1 deadline 2026-08-21) with minutes zeroed: 564 players → 135 distinct scores, range 1.8–10.0/10, Spearman ρ=0.924 vs `ep_next`, 0 flat fallbacks. 334 tests green.

### Task 2: Forward full-pipeline evaluation (from GW1)
**Capability:** new-season-readiness
- [x] Implement `squad-eval-captain-live` (its own spec) — capture from GW1. *(Harness built + dry-run validated 2026-08-01; captures structurally start GW2 — the public API never exposes picks pre-deadline, so no GW1 pre-deadline capture exists. See that change's as-built note.)*
- [x] Add the **transfer** sibling: capture the live optimizer's recommendation pre-deadline; score realized `in − out` over next-1/next-3 vs hold and vs actual; reuse `research/squad-eval/` reconstruct + metrics. Report full-pipeline vs the floor numbers.

> **As-built (2026-09-04):** one capture run now records both legs. `capture.ts` runs `runOptimizerWithContext` after the captain pipeline with free transfers derived the same way the deadline brief does (`deriveFreeTransfers` → `clampFt`) and stores `transfer` (FT assumed, bank, primary/secondary action with per-move projected `gw1Gain`/`gw5Gain`, hit verdict, `dataNotice`, LLM confidence + prose; `unavailable — <reason>` string on GW1 or optimizer failure). The transfer aggregation was extracted from `transfer-replay.ts` into `metrics.ts` (`summarizeTransfers`; replay re-run → `transfer-report.md` byte-identical) and generalised for multi-move actions + `null` gains while a span is still being played. `score-live.ts` scores each captured GW's realized (in − out) over next-1/next-3 **net of the hit each side paid**, vs hold (0) and vs the manager's actual moves (`fetchTransferHistory` + exact `event_transfers_cost`), and writes `live-transfer-report.md` with the floor side-by-side (0/35 transfers, 0.00/0.00 vs manager 3.49/5.83, 2W/19T/14L net −204). Shared record types moved to `live-types.ts` (side-effect free — importing a value from `capture.ts` runs a capture). First transfer capture: **GW4** (2026-09-04 19:05Z, squad as locked for GW3, 1 FT, £1.5m): FREE Cash→Ajayi, +0.6 ep; scored once GW4 (next-1) / GW6 (next-3) finish. GW2/GW3 captures predate the leg and are listed as excluded. 341 tests green; harness typechecks under a research tsconfig.

### Task 3: Tier-2 DC evaluation (~GW8+)
**Capability:** new-season-readiness
- [ ] Re-run the Tier-2 augmentation eval including `t2_dc_threshold_prob` on live 2026-27 data; record a fold-in decision.

### Task 4: Calibration freshness (after a few GWs)
**Capability:** new-season-readiness
- [x] Recompute the composite weight fit + transfer-threshold curve on 2026-27 data; compare to shipped weights and `τ=1.5`; refit only if rules/meta moved materially. Document the comparison. *(Automated 2026-09-07 by `composite-refit-gate`: weekly `live-drift.md` + rolling refit + pre-registered gate; the transfer-bar calibration readout lives in `live-transfer-report.md` and is not yet a gate — the τ decision stays a human call once n is meaningful.)*

> **Data source landed (2026-09-04):** the historical backtest never had real `ep_next`; the live capture now builds the dataset that does. `runSquadAnalysisPipeline` exposes `scoredCandidatePool` (the top-10-per-position pool scored exactly like the squad — optional field, no ranking change), and each `capture.ts` run writes `research/squad-eval/pool/gwNN.csv`: one row per scored player (15 squad + 40 candidates = 55/GW) in the composite-backtest `dataset.csv` schema (`sm_*` signal-map columns, `sm_epNextSignal`, `xP` = live `ep_next`, `ppg`, `low_minute`, flags) plus live-only extras (`in_squad`, `ep_this`, price, ownership, availability, LLM rotation/injury, `llm_adj`, `trend_class`). `t2_*` columns are present but blank (`unavailable` — Tier-2 features come from the archive). `score-live.ts` joins realized labels (`next1_points`, `next3_points`, `label_gws` = finished GWs in the window; 3 = complete) into `research/squad-eval/live-dataset.csv`. At ~55 rows/GW that is ~1,000 complete-label rows by GW20 — enough for a per-position ridge refit of the non-ep weights with `fit.py` pointed at it (fit.py still reads the archive parquet; parametrise when there is data). First dump: GW4 (55 rows). Note (corrected 2026-09-06): an earlier draft of this note claimed candidates were scored inconsistently with the squad because `findCandidates` omits the element summary. That was wrong — `computeStatisticalSignals` never reads its `_elementSummary` parameter, so the two paths are identical; the only fidelity difference anywhere is the deliberate trend + LLM tier (full vs `scorePlayerLite`). The real, smaller tidy-up (dead parameter, duplicated neutral-LLM constants, a hand-rolled lite scorer in `restructure.ts`, unlabelled mixed-fidelity comparisons) is specced separately as `scoring-path-consolidation`.

### Task 5: Verify chip-count two-halves expiry (around GW19)
**Capability:** new-season-readiness
- [ ] After the GW19 deadline, confirm `deriveChipsRemaining` drops an unused first-half chip (check FPL `bootstrap-static` `chips` no longer advertises it; adjust the derivation if not). Prevents the chip narrative (`chip-strategist`) from recommending an expired chip.

### Task 6: Restructure ↔ long-term coherence (season live)
**Capability:** new-season-readiness
- [ ] Judge the restructure **dream** over the planning horizon, not just next-GW ep: reuse `computeHorizon` / `HorizonEntry.cumulativeGain` (`lib/optimizer/horizon.ts`) for the dream leg in `findRestructureCandidates` (`lib/optimizer/restructure.ts`), so a restructure is pitched only when the premium pays off across the window. Keep the downgrade leg near-term.
- [ ] Share context between the views so This Week's **Restructure** and the **Long Term** horizon never contradict: a recommended restructure's dream agrees with (and is visible in) the Long Term tab — surface the link in the UI (`components/panel/{ThisWeekDetail,LongTermDetail}.tsx`), e.g. the Restructure row carries the horizon timing.
- [ ] Verify: a dream the horizon tags WAIT is not pitched as a buy-now restructure; the two tabs reference the same target/timing; `tsc`/`eslint`/`vitest` clean.

### Notes
- Item 1 is the only pre-GW1, demo-facing piece — prioritize it.
- Items 2–4 accrue value through the season; partial reports must state `n` and read as provisional.
- Item 5 (restructure ↔ long-term) needs a meaningful in-season horizon — land it once early-GW fixtures + `ep_next` make the horizon real.
