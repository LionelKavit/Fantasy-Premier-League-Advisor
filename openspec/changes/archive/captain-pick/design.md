# Design

## Context

The Captain Pick Pipeline consumes the existing `SquadAnalysisResult` (ranked squad with `ScoredPlayer` signals, `picks` for XI/bench positions, `currentGw`) plus the `ManagerProfile` (risk profile for template-vs-differential bias). It produces a `CaptainResult` per gameweek and a multi-GW horizon. It reuses the squad pipeline's already-computed signals — it does **not** re-fetch or re-score from scratch.

## Key Decisions

### 1. Captaincy uses a separate, ceiling-weighted score — not the transfer composite
The transfer composite optimizes sustained value (floor, 5-GW fixtures, price-value). Captaincy optimizes a single GW's **ceiling**. A consistent defender is a good hold and a poor captain; an explosive penalty-taking forward is the reverse. We therefore compute a distinct `captainScore` that up-weights goal threat, penalty duty, and home attacking fixtures, and down-weights value/price entirely. This is the central reason captain pick is its own pipeline rather than a sort of the existing ranking.

### 2. Minutes certainty is a multiplicative gate, not an additive signal
A captain who is benched or subbed early is catastrophic (you keep their low score, doubled). Rotation risk and `chanceOfPlayingNext` therefore act as a **multiplier in [0,1]** on the whole score, not a small additive term. A 50%-to-start premium striker should rank below a nailed-on good pick.

### 3. DGW is a multiplier; captaincy strongly favors two fixtures
Two fixtures means the captain's doubled return applies across both. `captainScore` for a genuine DGW player is scaled by a DGW multiplier (≈ 1.7–2.0, discounted by the weaker of the two fixtures), which usually makes a DGW player the captain even over a stronger single-fixture player.

### 4. Captain candidates = likely starting XI only
Captaincy is chosen from the manager's own squad, and realistically from the starting XI (`picks` positions 1–11). The pipeline still computes a vice-captain as an automatic fallback (the highest-scoring *different* XI player whose fixture is in a different match, so a single postponement can't wipe out both).

### 5. Template vs differential is a rank-strategy decision, applied at ranking/synthesis — not baked into the base score
Effective ownership drives captaincy EV relative to rank. The base `captainScore` is ownership-blind. The ranker additionally surfaces a **differential captain** (high ceiling, low effective ownership). Synthesis then chooses emphasis using `riskProfile.rankTrend`: protect rank → template (safe, highly-owned) captain; chase rank → differential. This mirrors the optimizer's risk-aware posture.

### 6. Captain horizon feeds the triple-captain chip — single source of truth
Rather than the chip node independently guessing a TC target, `captain-horizon` scores captaincy for each of GW+1..GW+N and reports the best `captainScore` and its GW. The triple-captain branch of `evaluateChipInteractions` consumes this: recommend TC when the horizon's peak materially exceeds a normal week's best (e.g. a strong DGW). This removes the ad-hoc `squad[0]` heuristic and keeps captaincy logic in one place.

### 7. Synthesis fail-safe mirrors the optimizer
If the Claude API key is missing or the call fails, return a valid `CaptainResult` built deterministically from the ranker's top pick, with `confidence: "low"` and an alert — same pattern as the optimizer synthesis node.

## Reused functions
- `getPlayerFixtures`, `computeFdrRun`, `detectGameweekFlags` from `lib/gameweek.ts`
- `computeFixtureSignals` from `lib/pipeline/fixture-analyzer.ts` (for horizon rescoring at shifted GWs)
- `runSquadAnalysisPipeline` (called first to obtain `SquadAnalysisResult`)
- `ScoredPlayer` signals already on the squad result (statistical, fixture, market, llm)
