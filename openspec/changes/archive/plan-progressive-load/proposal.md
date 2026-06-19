# Plan progressive load + LLM result caching

## Why
With a live `ANTHROPIC_API_KEY`, the dashboard's first paint is slow. `GET /api/plan` → `runGameweekPlan` blocks on the **whole** pipeline before returning anything: the deterministic squad analysis (which already includes a batched LLM-context call + dozens of `fetchElementSummary` requests) **plus three more LLM synthesis calls** (optimizer weekly, long-term, captain). The page shows a full-screen `Skeleton` until all of it resolves. FPL HTTP responses are cached 1h in-memory (`lib/fpl-api.ts`), but **LLM results are never cached** and there is **no plan-level cache**, so every load and every "Re-analyze" repays the full multi-call LLM latency.

The squad/pitch + meta are fully known after the deterministic phase — none of it needs the LLM. So we can paint the pitch immediately and fill the LLM-derived verdict/detail in afterward, and cache the expensive parts so repeat loads are instant.

## What changes
- **Phasing (`plan-phasing`):** split the plan into a fast **base** phase and a slow **insights** phase. The base is a **lightweight squad-only computation** — it scores just the 15 squad players (statistical + fixture + market, no trend/LLM) and skips the transfer candidate pool, the per-player element-summary fan-out (~100+ FPL requests), and the `batchComputeLlmContext` call, none of which the pitch needs. The insights phase does the full analysis + the three syntheses. Keep `runGameweekPlan` / `GET /api/plan` as a merged wrapper for back-compat; add `GET /api/plan/base` and `GET /api/plan/insights`.
- **Caching (`plan-caching`):** a shared, TTL'd in-memory `AnalysisContext` cache (reused by the Scout chat so the squad analysis + its batched LLM call run once), plus an insights-result cache keyed by team+GW+freeTransfers+horizon. "Re-analyze" forces a fresh run.
- **Progressive dashboard (`progressive-dashboard`):** the client fetches base first and renders the pitch + header + alerts immediately; the verdict + detail panels show a tasteful, **step-aware "Scout is analyzing…" indicator** until insights arrive — explicitly *not* a full-screen blocking loader.

## Impact
- Touches `lib/plan/context.ts`, `lib/plan/index.ts`, `lib/scout/context.ts`, `lib/client/plan.ts`, `app/page.tsx`, and adds `app/api/plan/base/route.ts` + `app/api/plan/insights/route.ts`.
- Presentation + caching + request-shape only — no change to the scoring pipeline, the tools, or the LLM prompts.

## Out of scope
- **Tactical-accuracy evaluation** (backtest vs realized points / LLM-as-judge) — a separate future `scout-eval` change.
- True per-section streaming of the three insights (they run in parallel and finish together; two-phase fetch already captures the perceived-load win).
