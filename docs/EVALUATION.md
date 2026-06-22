# Evaluation

Most FPL tools ship hand-tuned weights and hope. Pocket Scout was built **eval-first**: a backtest harness answers "is this actually any good?" *before* anything ships — and a few times, the honest answer was "no," so it didn't.

All offline tooling lives under `research/` (gitignored data, excluded from the app build).

## The question

The app ranks players with a composite score. The first question was simply: **is that ranking reliable?** To answer it without fooling ourselves, the harness measures **rank correlation within position** (Spearman) of each predictor against players' **realized next-3-gameweek points**, point-in-time (no lookahead), across **10 seasons** of historical data, with FPL's own expected points (`xP`) and points-per-game (`ppg`) as baselines.

> **Honesty guardrails baked in:** point-in-time reconstruction (signals use only prior-gameweek data); an integrity gate that only counts `xP` on seasons where it's a genuine pre-deadline projection; and evaluation restricted to fixture-complete, non-low-minute rows.

## 1. A data-fit ranking model (0.33 → 0.53)

The original hand-tuned weights ranked at **~0.33** Spearman — barely better than noise, and well below FPL's `xP` (~0.59). So the weights were **fit from data** (ridge regression per position) instead of guessed.

| Predictor | Within-position Spearman (held-out) |
|---|---|
| Hand-tuned composite (original) | ~0.33 |
| **Data-fit composite (shipped)** | **~0.53** |
| FPL `xP` (baseline) | ~0.59 |

Two findings shaped the shipped model:
- **`ep_next` dominates.** The fit gave FPL's expected-points signal a far larger weight than everything else; the other signals became small **signed corrections** (notably, price is a *negative* per-point term — pricey players are docked slightly).
- **A hard `[0,1]` clamp was destroying the ranking.** Signed weights pushed ~37% of players below 0, where the clamp tied them together. Replacing it with a **strictly-monotonic logistic squash** recovered the full ordering (0.42 → ~0.53).

A subtle but critical bug surfaced here: the offline `ep` signal was normalised differently from the runtime's, which would have made every live rating saturate at 10/10. Fixing the **scale-consistency** between backtest and runtime was what made the fitted weights transfer to production.

## 2. Squad-relative evaluation (the decisions that matter)

Rank correlation measures "does it order the whole player pool well." But the app's real outputs are **squad-relative**: *which of your XI to captain*, *which of your 15 to sell*. Those need a manager-squad simulation — so two more harnesses replay real 2025-26 squads (fetched from the FPL API).

**Captain replay** — on the manager's real squad each gameweek, run the app's captain logic and compare to what *actually* happened:

| | Result (GW3–38) |
|---|---|
| App vs the manager's own armband | **6W / 26T / 4L → net +18 squad pts** |
| Hit-rate (picked the XI's top scorer) | 28% |
| Points captured (vs the perfect pick) | 57% |

So the app's captaincy modestly **beat the human** over a season and outscored every baseline (PPG, ownership, random).

**Transfer replay** — the same idea for transfers surfaced a *problem*: the optimizer recommended a move in **34 of 35** gameweeks and, measured against simply holding, **net-lost** points. Digging in, on the ep-absent floor the composite gain had **no positive predictive value** for realized transfer outcomes. That drove a fix:

- **A points-based hold gate.** Recommend a transfer only if its projected gain (`Δep = in − out`) clears a bar — **~1.5 pts** for a free transfer, **>4** for a hit (the exact cost of a hit). The bar was *derived*: the data's noise floor is ~0.5 pts, and the free-transfer opportunity cost pushes it to ~1.5 — which also matches the community heuristic.
- **Hold when `ep_next` is unavailable**, because transfers chosen on the composite alone are negative-EV.

Result: the over-transferring collapsed from **34/35 → 0/35**, and the net-loss disappeared.

> **Caveat (stated plainly):** these replays run on a *deterministic floor* — historical `ep_next` and the LLM context can't be faithfully reconstructed, so they measure the model's floor, not the full live pipeline. The genuine full-pipeline number needs a **forward** evaluation (logging live picks at the deadline), which is specced and parked for 2026-27.

## 3. The honest no-ship: granular fixtures

A proposed upgrade — replace FPL's crude 1–5 fixture-difficulty rating with the finer team-strength ratings the app already computes — was **calibrated before shipping**, and the data killed it:

| Fixture signal | Within-position rank-corr | …for defenders |
|---|---|---|
| FPL's crude FDR (current) | 0.0566 | **0.0793** |
| Team-strength signal | 0.0469 | 0.0562 |

The strength signal was **worse in every position** — decisively so for defenders, where fixtures matter most. FPL's hand-curated FDR already encodes the strength info better. So the change was **rejected and documented**, not shipped. (The genuine fixture upgrade — true results-based Elo — was noted as future work.)

## How it's done

- **Calibrate-first.** Every model change is gated by a report-only calibration on the backtest before it touches runtime — which is exactly how the fixture idea was caught.
- **Spec-first.** Built with [OpenSpec](https://github.com/Fission-AI/OpenSpec): ~45 change proposals under `openspec/changes/archive/`, each with the rationale, design, and as-built outcome — *including the no-ships and report-only results*.
- **Honest about limits.** The numbers above are within-position rank correlation on a point-in-time backtest, and deterministic-floor for the squad replays — not a live A/B. They're presented with those caveats rather than as marketing.

## Reproduce

The harnesses (`research/composite-backtest/`, `research/squad-eval/`) reuse the app's real signal code for parity, fit weights in Python (ridge), and benchmark with Spearman/top-K. Historical data comes from the public [vaastav FPL dataset](https://github.com/vaastav/Fantasy-Premier-League) and the live FPL API.
