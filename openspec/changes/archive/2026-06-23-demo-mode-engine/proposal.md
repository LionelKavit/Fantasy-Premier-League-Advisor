# Demo-mode engine — a season-aware sample squad for ID-less visitors

## Why
Today the only way into Pocket Scout is an FPL manager ID. A visitor without a team — a recruiter following a portfolio link, or a manager kicking the tires before committing — hits a wall at the `ManagerIdForm` and never sees the engine or the chat. That's a real usability and conversion blocker: the hero feature (the knowledge-grounded, tool-using Scout) is gated behind data most first-time visitors don't have to hand.

The fix is a **demo mode**: synthesize a strong, believable squad from the live player pool and let the visitor explore the pitch, the ratings, and — above all — the chat, without an ID. This change is the **engine half**: everything server-side that produces a demo plan and grounds the demo brief/chat. The UI half lives in `demo-mode-shell`.

The key insight from the codebase: the entire deterministic engine and the Scout chat are *manager-agnostic* — they operate on `Player[]` and a `picks` array. "Manager-ness" only enters via `fetchPicks` (the squad) and `buildManagerProfile` (rank, held chips, history). So a demo plan is, mechanically, a **synthesized `picks` array + a stubbed manager profile**; the rest of the pipeline flows unchanged.

## What changes
- **A season-aware dream-team builder** (`lib/demo/`). Selects a valid 15-man FPL squad (2 GK · 5 DEF · 5 MID · 3 FWD) from `bootstrap-static`, **budget-valid (≤ £100.0m) and ≤ 3 per club**, via a greedy value fill. The ranking metric is **season-aware**: FPL's `ep_next` in a live season, falling back to **last-season total points / points-per-game** off-season. Crucially, season state is decided by the **gameweek calendar** (is there an upcoming unfinished gameweek?), *not* by `ep_next` presence — in the summer break the API keeps serving last season's finished GW38 feed whose players still carry stale `ep_next`. The builder records which basis it used so downstream copy can be honest about it.
- **A demo analysis context** (`buildDemoContext` / `getCachedDemoContext` in `lib/plan/context.ts`). Builds an `AnalysisContext` from the synthesized squad — scored with the existing scorers — with a **stubbed `managerProfile`** (no rank, no held chips, no history) and normally-computed `gwFlags`. No `fetchPicks`, no `buildManagerProfile`.
- **A demo plan path** (`lib/plan/index.ts`). The base phase returns squad + 0–10 ratings + the deterministic captain, exactly as today. The insights phase is **trimmed to captaincy only** (deterministic + LLM synthesis): it **omits the transfer recommendation, the long-term transfer horizon, the chip plan, and all of their LLM syntheses** — the optimizer is not run at all in demo. (The "Long Term" tab is the optimizer's *transfer* horizon — `HorizonEntry` is candidate-vs-weak transfer timing — so it is transfer strategy by another name and is dropped with the rest; demo's `transfers` field stays `null`.) This bounds demo LLM spend to the captain synthesis (plus the brief and chat).
- **A demo opening brief** (`lib/scout/brief.ts`). A welcome/explainer variant — season-aware ("built from last season's returns" vs "from this week's projections"), not the deadline-and-action brief.
- **Demo-aware chat grounding** (`lib/scout/context.ts`, `system-prompt.ts`). The Scout knows it is in demo mode and frames answers as **general FPL advice about a sample squad**, never "your squad." `simulate_transfer` stays available but as a **hypothetical/educational** tool — never a "you should transfer" recommendation.
- **A `demo` signal on the existing routes** (`/api/plan/base`, `/api/plan/insights`, `/api/ask`, `/api/brief`). When set, `team_id` is not required and the route uses the demo context/plan/brief.

## Impact
- New code under `lib/demo/`; branches in `lib/plan/context.ts`, `lib/plan/index.ts`, `lib/scout/{context,brief,system-prompt}.ts`; `demo` param handling in the four routes.
- No change to the deterministic scoring, the optimizer, or the captain models themselves — demo reuses them.
- Additive and behind an explicit `demo` flag: the existing ID-based flow is untouched.
- The optimizer (transfer + chip + long-term horizon) is never invoked in demo; LLM cost per demo visit is bounded to **brief + captain synthesis + chat**.

## Out of scope
- All UI: the entry point, panel gating, demo starters, conversion CTA (those are `demo-mode-shell`).
- A real-manager "template" / world-#1 squad — demo builds a *computed* dream team, not a real entry.
- The interactive build-a-squad sandbox (a future change).
- Any change to the composite/optimizer/captain methodology.

## Depends on
- **`new-season-readiness` item 1 (cold-start composite fix)** for *August* quality: at 2026-27 GW1–3 every player is sub-`minMinutes`, so the composite collapses to the flat fallback and the demo pitch would show a uniform rating. Demo ships fine **now** (2025-26 final bootstrap has full minutes, so the composite works) and the season-aware metric fallback covers the no-`ep_next` gap, but the in-season-start experience needs that fix to land before GW1.
- **`demo-mode-shell`** consumes this change's `demo` route contract and trimmed plan shape.
