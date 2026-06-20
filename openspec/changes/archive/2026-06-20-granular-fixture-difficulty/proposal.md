# Granular fixture difficulty — use the strength signal we already compute

## Why
The composite's `fixture` weight uses FPL's crude **1–5 FDR** (`fdrScore = 1 − (avgFdr−1)/4`) — a coarse bucketing. Yet the app **already computes a finer, position-aware fixture signal** and throws it away for scoring: `opponentStrength` (fixture-analyzer) maps FPL's continuous `strength_attack_*` / `strength_defence_*` ratings (~1000–1400) into 0–1, scoring attackers (FWD/MID) against the opponent's *defensive* strength and defenders/GK against the opponent's *attacking* strength. Experts consistently say fixture difficulty is the variable models most underweight — so feeding the composite the granular signal (instead of the 1–5 bucket) is a near-free accuracy win.

Chosen source: **FPL's own strength ratings** (already fetched, official, backtestable from 2019-20+) — not an external Elo dataset. True results-based Elo is more responsive but adds a dependency/compute for uncertain gain; deferred unless this proves insufficient.

## What changes
- **`fixture-difficulty`** — the composite's `fixture` input switches from the crude `fdrScore` to the strength-based signal (either `opponentStrength` directly or a calibrated blend of the two), with the variant chosen by the `composite-backtest` benchmark. Deterministic; no LLM, no external data, no new fetch.
- **Scope: composite only.** The crude 1–5 FDR still drives the captain `fixtureMultiplier` and horizon `gw5AvgFdr` for now (a possible follow-up).

## Impact
- Runtime change in `lib/pipeline/fixture-analyzer.ts` + `buildSignalMap` (composite-scorer), maybe a blend constant in `lib/config.ts`.
- **Measurable:** the existing dataset already emits both `fdrScore` and `opponentStrength`, so replace-vs-blend is calibrated directly; the composite weight may shift, re-validated by re-running the backtest (refit only on regression vs the current ~0.53).

## Out of scope
- External / results-based Elo (deferred).
- The captain `fixtureMultiplier` and horizon `gw5AvgFdr` (still 1–5 FDR; follow-up).
- A full weight refit unless the swap regresses ranking.

## Depends on / relates to
`composite-backtest` (validation) and `new-season-readiness` item 4 (calibration freshness — this is one such recalibration).
