# Captain Pick Pipeline

## Why

The squad analysis and optimizer pipelines decide *which players to own and which transfers to make*, but make no recommendation about **who to captain**. Captaincy roughly doubles one player's score every gameweek, so it is one of the highest-leverage decisions a manager makes — and it is currently unsupported.

The only captaincy-adjacent code is `evaluateTripleCaptain` in the chip-interaction node. It is **not** a general captain picker:

- It is gated on the triple-captain chip being available and a DGW being near.
- It selects `squad[0]` — the player with the highest **transfer composite score**. That score optimizes sustained, season-long value (floor, 5-GW fixture run, price-value). Captaincy wants the opposite: **single-gameweek ceiling and explosiveness**. The two rankings diverge.
- It applies no captain-specific signals: no penalty-taker premium, no home/away split, no minutes-certainty gate, no differential-vs-template reasoning.

This change adds a dedicated Captain Pick Pipeline that scores captaincy on its own terms, recommends a captain + vice-captain every gameweek, supports a differential option for rank-chasing, and produces a multi-GW captain horizon that feeds (and corrects) the triple-captain chip decision.

## What Changes

- **New capability `captain-types`** — type definitions for captain scoring and results.
- **New capability `captain-scoring`** — a ceiling-weighted, single-GW captaincy score distinct from the transfer composite, with a minutes-certainty gate and DGW multiplier.
- **New capability `captain-ranker`** — ranks the starting XI, selects captain + vice-captain (fallback), and a differential alternative based on effective ownership.
- **New capability `captain-horizon`** — scores captaincy across GW+1..GW+N to identify the best window/target for the triple-captain chip.
- **New capability `captain-synthesis`** — LLM narrative with risk-aware template-vs-differential reasoning, plus a deterministic fail-safe.
- **New orchestrator** `lib/captain/index.ts` and API route `app/api/captain/route.ts`.
- **Integration:** the triple-captain branch of `evaluateChipInteractions` is refactored to consume the captain horizon's top pick instead of its ad-hoc `squad[0]` + DGW heuristic.

Out of scope: auto-applying the captaincy to the FPL account (the app recommends; it never mutates the user's team).
