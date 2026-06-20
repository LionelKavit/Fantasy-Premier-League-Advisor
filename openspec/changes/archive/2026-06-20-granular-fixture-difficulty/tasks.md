## Tasks — granular fixture difficulty (FPL strength, composite-only)

### Task 1: Calibrate replace-vs-blend (report-only)
**Capability:** fixture-difficulty
- Script over the existing `composite-backtest` dataset (has `fdrScore` + `opponentStrength` + `next3_points`): compare within-(season,gw,position) rank-correlation of the label against `fdr-only`, `strength-only`, and blends `α·strength + (1−α)·fdr` for `α ∈ {0.25,0.5,0.75,1.0}`, on fixture-complete + gate-clean rows. Pick the best, stable variant; write a short report. If `fdr-only` wins, stop here and record it.

### Task 2: Apply the chosen signal (runtime)
**Capability:** fixture-difficulty
- `lib/pipeline/fixture-analyzer.ts`: expose `fixtureScore` (= `opponentStrength` or the calibrated blend); leave `fdrScore`/`opponentStrength`/`gw5AvgFdr` intact for other consumers.
- `lib/pipeline/composite-scorer.ts` (`buildSignalMap`): `fixture:` reads `fixtureScore`.
- `lib/config.ts`: blend constant if a blend won.

### Task 3: Re-validate (+ refit only if needed)
**Capability:** fixture-difficulty
- Rebuild dataset + run the benchmark; confirm within-position ranking does not regress vs the current composite (~0.53). Refit the composite weights only if it regresses; otherwise keep them.
- Update fixture-analyzer / composite tests that assert on the fixture signal.
- App gate clean (`tsc` / `eslint` / `next build` / `vitest`).

### Verify
- [ ] Calibration report shows the chosen variant beats (or ties) `fdr-only`; choice recorded.
- [ ] Composite `fixture` reads `fixtureScore`; other `FixtureSignals` consumers untouched.
- [ ] Backtest ranking ≥ current; weights refit only if regressed.
- [ ] Scope held: captain `fixtureMultiplier` / horizon `gw5AvgFdr` unchanged.
- [ ] App gate clean.

### Notes
- Sanity-check the 1000–1400 strength normalization band still fits 2026-27 (promoted clubs) during the new-season calibration.

---

## As-built outcome (run 2026-06-19) — NO-SHIP (the Task 1 gate fired)

**Task 1 calibration** (`research/composite-backtest/calibrate-fixture.py`, 40,064 eligible rows 2020-25): within-position rank-corr of realized next-3 points vs each fixture variant —

| variant | overall | GK | DEF | MID | FWD |
|---|---|---|---|---|---|
| **fdr-only (current)** | **0.0566** | 0.0356 | **0.0793** | 0.0533 | 0.0580 |
| strength-only | 0.0469 | 0.0344 | 0.0562 | 0.0419 | 0.0552 |
| blend α=0.25 | 0.0580 | 0.0382 | 0.0773 | 0.0532 | 0.0636 |

**Decision: do NOT change the runtime.** `strength-only` is worse than FPL's crude 1–5 FDR in *every* position — decisively so for DEF (0.079 vs 0.056), the position where fixtures matter most. The best blend is a noise-level +0.0014 overall and makes DEF slightly worse. FPL's hand-curated FDR already encodes the strength information better than the raw `strength_*` ratings do.

**Why the hypothesis failed:** FPL *derives* its FDR from these strengths but also hand-adjusts it; the raw ratings are noisier. So `opponentStrength` (already computed) is correctly left unused by the composite.

**The genuine upgrade is the deferred option:** true results-based **Elo** (more responsive, objective) — not FPL's own strength fields. Revisit only if a future fixture-accuracy push is warranted. Tasks 2–3 (runtime swap, re-validate) were correctly **not executed** — the gate prevented shipping a non-improvement.
