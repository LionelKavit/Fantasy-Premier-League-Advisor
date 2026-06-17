# Frontend Data Prep

## Why

The frontend v1 will render the manager's team on a pitch (starting XI vs bench, real club shirts) alongside the AI recommendations. To draw the pitch it needs the full 15-player squad with pick slots — but `GET /api/plan` currently returns only the recommendation outputs (`transfers`, `captaincy`), not the squad.

The naive fix — having the UI also call `/api/analysis` — would re-run squad analysis a second time, undoing the single-analysis-pass design of `gameweek-plan`. Instead, this change enriches the existing `GameweekPlan` with display data the aggregator **already has in hand** (`ctx.analysis` + `ctx.managerProfile`), so the UI gets everything in one call with no extra computation.

It also surfaces each player's `team_code`, which the raw FPL API returns but our normalized `Player` drops — needed to build real FPL shirt image URLs (`shirt_<teamCode>-66.png`).

This change is **prep only**: data-layer additions to unblock the UI. No frontend components are built here.

## What Changes

- **New capability `player-team-code`** — the normalized `Player` exposes `teamCode`, mapped from the raw API's `team_code`.
- **New capability `plan-display-fields`** — `GameweekPlan` gains `squad` (15 players in pick order with display + flag fields), `bank`, `chipsRemaining`, and `manager` (name, rank, team name), all derived from the already-computed `AnalysisContext`.
- Test suite updated for the additive fields (factory + plan/e2e assertions).

## Non-Goals

- No frontend UI (pitch, player tokens, recommendation panel, onboarding) — that is a separate, later change.
- No change to pipeline scoring/decision behavior; this is purely additive data exposure.
