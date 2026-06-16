## Context

The FPL AI Transfer Advisor's data layer fetches and normalizes all available FPL API data — 50+ player fields, per-GW history, fixtures with FDR, manager profile with risk and transfer patterns. The Squad Analysis Pipeline is the first computation layer that transforms raw data into actionable scores and recommendations. Its output (`SquadAnalysisResult`) is consumed by the Optimizer Pipeline and the UI.

## Goals / Non-Goals

**Goals:**
- Score every player using statistical, trend, fixture, market, and contextual signals
- Apply position-specific weight vectors (different scoring formulas for GK/DEF/MID/FWD)
- Normalize all signals to 0-1 range for weighted combination
- Rank the manager's 15 squad players and identify the weakest 3
- Find top 5 replacement candidates per weak spot within budget and club-rule constraints
- Produce full score breakdowns so downstream nodes can explain WHY a player scored high/low

**Non-Goals:**
- Optimizer Pipeline logic (single transfer, hit analysis, restructure, chip interaction) — separate future change
- Captain pick scoring — separate capability
- UI components for displaying scores or recommendations — separate frontend change
- Real-time live GW scoring — pipeline runs on cached data with 1-hour TTL

## Decisions

### Decision 1: Static normalization bounds, not dynamic percentiles

**Choice:** Use predefined min/max bounds in `NORMALIZATION_BOUNDS` for 0-1 normalization (e.g., xGI/90: 0 to 0.8, form: 0 to 12, BPS/90: 0 to 40).

**Alternatives considered:**
- Dynamic percentile-based normalization across all 500+ players — more "fair" but scores become unpredictable when the player pool changes between gameweeks
- Z-score normalization — produces negative values, does not naturally map to 0-1 weighting

**Rationale:** Static bounds make scores interpretable and reproducible. A player scoring 0.7 on goalThreat always means the same thing. Bounds can be tuned once per season from historical data ranges. Clamping at 0 and 1 handles outliers gracefully.

### Decision 2: LLM context node is optional and fail-safe

**Choice:** If `ANTHROPIC_API_KEY` is not set or the Claude API call fails, the pipeline continues with neutral default signals (all zeros/midpoints). No error thrown, warning logged.

**Alternatives considered:**
- Make LLM mandatory — blocks entire analysis if API key missing or Claude has an outage
- Run LLM asynchronously and merge later — adds complexity for marginal benefit

**Rationale:** Base statistical + trend + fixture scoring provides ~90% of signal value. LLM context is a refinement layer adding at most ±0.15 to composite scores. Users should be able to run the pipeline without an API key during development.

### Decision 3: Insufficient data fallback score of 0.3

**Choice:** Players with fewer than 270 total minutes (3 full matches) get trend = null and composite score = 0.3.

**Alternatives considered:**
- Exclude players entirely — punishes new signings and returning-from-injury players
- Score at 0.5 (neutral) — too generous for unproven quantities
- Use bootstrap-only stats — this still happens for statistical signals, the 0.3 only applies when total minutes are critically low

**Rationale:** 0.3 signals "insufficient evidence, treat with caution" without completely eliminating the player from consideration.

### Decision 4: Batch fetchElementSummary, capped at ~45 calls

**Choice:** Fetch element summaries for 15 squad players + up to 30 pre-filtered candidates (top 10 per position by pointsPerGame). Use `Promise.all` for parallelism.

**Alternatives considered:**
- Fetch only for 15 squad players — candidates get no trend analysis
- Fetch for all 500+ players — 500 API calls, ~15 seconds
- Sequential with rate limiting — 45 seconds latency

**Rationale:** 45 parallel calls completes in ~1-2 seconds. 1-hour cache means 0 calls on subsequent runs.

### Decision 5: Single computeCompositeScore function for all positions

**Choice:** One function takes a `Position` parameter and selects the weight vector from `SCORING_WEIGHTS` config.

**Alternatives considered:**
- Four separate functions (`scoreGK`, `scoreDEF`, etc.) — code duplication
- Strategy pattern with position-specific classes — over-engineered

**Rationale:** The formula structure is identical across positions: normalize → weight → sum → add adjustments. Only the weight values differ, and those are data-driven from config.

### Decision 6: LLM calls batched per squad, not per player

**Choice:** One Claude API call with all 15 squad players' context → JSON array of 15 signal objects. Second call for ~30 candidates.

**Alternatives considered:**
- One call per player (15-45 calls) — expensive, slow, hits rate limits
- Skip LLM for candidates — valid trade-off but misses rotation/injury context

**Rationale:** A single prompt with 15 players fits within Claude's context window (~5,000 tokens). Two calls total keeps cost to ~$0.02-0.05 per analysis run.

## Risks / Trade-offs

**[FPL API rate limiting on parallel calls]** — 45 parallel `fetchElementSummary` requests could trigger undocumented rate limits. Mitigation: 1-hour cache means this only happens on first run. Add concurrency limiter if observed.

**[Normalization bounds may not suit all seasons]** — Static bounds tuned for one season might not fit if the meta shifts. Mitigation: Bounds isolated in `config.ts`, easy to update.

**[LLM hallucination in context signals]** — Claude might assign incorrect rotation risk or misparse injury news. Mitigation: Signals capped at small additive ranges (max ±0.15). Base scoring dominates.

**[Candidate search latency]** — Scoring ~30 additional players requires fetching and computing. Mitigation: Parallel fetches + cache. ~2-3 seconds first run, <100ms cached.
