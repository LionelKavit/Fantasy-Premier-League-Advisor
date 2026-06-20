# Design — granular fixture difficulty (FPL strength, composite-only)

## Current state
`computeFixtureSignals` produces both, but the composite only uses the first:
- `fdrScore = 1 − (avgFdr − 1)/4` — from the crude 1–5 FDR (`team_h/a_difficulty`). **This is what `buildSignalMap` feeds the composite's `fixture` weight.**
- `opponentStrength = clamp(1 − (avgOppStrength − 1000)/400)` — from FPL's continuous `strength_attack_*`/`strength_defence_*`, **position-aware** (attackers vs opp defence, defenders/GK vs opp attack). Computed, returned on `FixtureSignals`, but **unused in scoring**.

## The change
Point the composite's `fixture` input at the granular signal — either `opponentStrength` directly, or a blend `α·opponentStrength + (1−α)·fdrScore` — chosen by the backtest. Everything else about the composite stays the same.

## Calibration (Task 1, report-only — settles replace-vs-blend)
The `composite-backtest` dataset already emits `fdrScore` and `opponentStrength` per row alongside `next3_points`. A small script compares within-(season,gw,position) rank-correlation of the realized label against each fixture variant — `fdr-only` (current), `strength-only`, and blends across `α ∈ {0.25,0.5,0.75,1.0}` — on the fixture-complete, gate-clean rows (2020–25, where team strengths exist). Pick the variant with the best, stable ranking; report the curve so the choice is auditable.

> Expectation-setting: FPL *derives* the 1–5 FDR partly from these strength ratings, so the gain may be **modest** — the win is the finer granularity + position-awareness. Ship it if it is a non-regression improvement; if `fdr-only` already wins, record that and make no change.

## Apply (Task 2)
- `fixture-analyzer.ts`: expose the chosen `fixtureScore` (either `opponentStrength`, or a blend computed from the two). Keep `fdrScore`/`opponentStrength`/`gw5AvgFdr` on `FixtureSignals` unchanged (other consumers still read them).
- `buildSignalMap` (composite-scorer): `fixture:` reads the new `fixtureScore` instead of `fdrScore`.
- `lib/config.ts`: a blend constant if a blend wins.

## Re-validate (Task 3)
Rebuild the dataset + run the benchmark. The composite's learned `fixture` weight was fit on `fdrScore`; switching the signal shifts its meaning, so re-validate against the current composite (~0.53). **Refit the weights only if the swap regresses** (ties into `new-season-readiness` calibration freshness); otherwise keep the shipped weights and just swap the signal.

## Notes / caveats
- **Position-awareness is already handled** by `opponentStrength` — no new logic needed.
- **FPL strength updates occasionally** (not per match) and is partly subjective; true results-based Elo (more responsive) is the deferred upgrade if this underperforms.
- **Scope discipline:** the captain `fixtureMultiplier` and horizon `gw5AvgFdr` still use the 1–5 FDR — intentionally unchanged here (measured differently; a clean follow-up).

## Pitfalls
- Don't break the other `FixtureSignals` consumers — add `fixtureScore`, don't repurpose `fdrScore`.
- The strength normalization band (1000–1400) is hard-coded; sanity-check it still holds for 2026-27 (promoted clubs) during the freshness check.
