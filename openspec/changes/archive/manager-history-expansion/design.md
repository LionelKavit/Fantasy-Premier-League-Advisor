## Context

The FPL AI Transfer Advisor's data layer (`lib/fpl-api.ts`, `lib/types.ts`) currently fetches manager history but discards most fields. The Optimizer Pipeline's Chip Interaction Node and Synthesis Node both need chips remaining and risk profile data that can only come from the full history response. The bootstrap-static API also provides chip allowance definitions that should be used as the source of truth (not hardcoded counts) to handle season-to-season rule changes.

## Goals / Non-Goals

**Goals:**
- Capture all fields from the history endpoint's `current`, `chips`, and `past` arrays
- Normalize bank/value to £m at the fetch boundary (consistent with existing patterns)
- Derive chips remaining from bootstrap allowances minus usage history (no hardcoding)
- Compute a risk profile (rank trend, hit patterns, bench waste) for the Synthesis Node
- Surface chips remaining and risk profile through the `/api/squad` route

**Non-Goals:**
- Using risk profile or transfer patterns to alter scoring weights — that's the Synthesis Node's job downstream
- UI components for displaying chips/risk/transfer patterns — separate frontend change

## Decisions

### Decision 1: Derive chip allowances from bootstrap API, not hardcoded

**Choice:** Parse the `chips` array from bootstrap-static to compute total allowances per chip name. The 2025/26 season defines 8 entries (each chip appears twice across two GW windows with `number: 1` each, totaling 2 per chip).

**Alternatives considered:**
- Hardcode `{ wildcard: 2, freeHit: 2, benchBoost: 2, tripleCaptain: 2 }` — breaks if FPL changes rules next season
- Fetch a separate config endpoint — no such endpoint exists

**Rationale:** The bootstrap API already provides this data. Deriving from it means zero maintenance when allowances change between seasons.

### Decision 2: Composite `ManagerProfile` type for downstream consumption

**Choice:** A single `ManagerProfile` object bundles entry, history, chips remaining, and risk profile. Pipeline nodes receive one object instead of four separate pieces.

**Alternatives considered:**
- Pass `entry`, `history`, `chipsRemaining`, `riskProfile` as separate arguments — verbose, error-prone at call sites
- Store derived data in the cache separately — adds cache management complexity for data that's always needed together

**Rationale:** Every downstream consumer (Chip Interaction, Synthesis) needs all four pieces. A composite type makes the dependency explicit and the API clean.

### Decision 3: Transfer pattern analysis from `/entry/{id}/transfers/`

**Choice:** Fetch the full transfer history and derive four behavioral signals: knee-jerk rate (players held ≤2 GWs), net value change (sum of sell price minus buy price across all transfers), position bias (transfer frequency per position), and average hold duration (GWs between buying and selling the same player).

**Alternatives considered:**
- Only use aggregate hit stats from history endpoint — misses WHO was transferred and WHY, can't detect behavioral patterns
- Analyze transfers in the LLM Synthesis Node directly — too many records (99+ for an active manager), better to pre-compute signals
- Track individual player P&L — too granular for strategy-level advice, aggregate net value is sufficient

**Rationale:** The Synthesis Node needs behavioral signals, not raw transfer logs. Pre-computing patterns into a compact `TransferPatterns` object keeps the LLM context focused. Knee-jerk rate directly informs whether to recommend patience; net value change reveals if the manager is destroying squad value through poor timing; position bias highlights blind spots.

### Decision 4: Rank trend uses 5% threshold over last 5 GWs

**Choice:** Compare overall rank at the start and end of the last 5 gameweeks. If rank decreased by >5%, it's "rising" (improving). If increased by >5%, "falling". Otherwise "stable".

**Alternatives considered:**
- Linear regression slope over all GWs — overcomplicates for a directional signal
- Last 3 GWs — too volatile, a single bad week swings the trend
- Absolute rank change threshold — doesn't scale (1000 rank change means different things at 10K vs 1M)

**Rationale:** 5 GWs smooths noise while staying recent. Percentage-based threshold scales across rank ranges.

## Risks / Trade-offs

**[History endpoint returns unexpected fields]** → The FPL API is unofficial. New fields may appear or names may change. Mitigation: TypeScript types surface breakages at compile time, and the normalization layer isolates API shape from downstream code.

**[Chip allowance structure changes]** → FPL could restructure how chips are defined in bootstrap. Mitigation: `deriveChipsRemaining` is ~20 lines of focused logic, easy to update.
