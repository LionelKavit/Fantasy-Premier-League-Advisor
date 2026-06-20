# Design — chip strategist (scope B: narrative grounding)

## Current state
- **ChipTimeline** ← `transfers.chipPlan` ← deterministic `evaluateChipInteractions` (DGW/BGW-aware, interaction logic). **Unchanged by this change.**
- **longTermNarrative** ← `synthesizeLongTerm(input)` (LLM, `maxTokens 600`). Input already carries `chipRecommendations` (the deterministic plan), `chipsRemaining`, `currentGw`, `horizon`, `riskProfile`. It writes chip prose **without expert grounding** — that's the gap we close.

## The knowledge-file mechanism (established here, reused by #4)
- `lib/knowledge/chips.md` — curated markdown, repo-authored (trusted).
- `lib/knowledge/index.ts` — a tiny loader: `loadKnowledge(name)` reads `lib/knowledge/<name>.md` once and caches the string in-process. Read via `readFileSync(join(process.cwd(), "lib/knowledge", ...))` (server-only; the long-term synthesis runs server-side). **Fallback if Next.js bundling drops the file:** co-locate the content as an exported string constant — decide at implementation by confirming the file resolves in `next build`/runtime.

## Grounding the narrative
`buildLongTermPrompt` gains the `chips.md` text as a **system/context block** ("Use these expert chip principles; the manager's actual facts follow"), with the deterministic facts (chipsRemaining, the GW19 deadline, chipRecommendations, DGW/BGW from the recs) as the case-specific data. The model reasons within the principles but about the real squad/calendar. No schema change — it still returns prose.

## `chips.md` content (from the Sources)
- **2025/26 two-halves rule** (authoritative): 8 chips total, one of each per half; **first set expires at the GW19 deadline (30 Dec 2025)** and doesn't carry over; second set unlocks GW20; **one chip per gameweek**; no Assistant Manager chip. ⇒ use-it-or-lose-it framing for unused first-half chips near GW19.
- **Canonical timing** (per half): Wildcard before the biggest fixture swing; Bench Boost on a DGW (ideally right after a wildcard rebuild); Free Hit on a blank; Triple Captain on a premium's DGW.
- **Judgment** (FFScout 16-scenario): "roughly right beats perfect" (≈3 pts best-vs-2nd, 20–30 optimal-vs-random); chip *sequencing*; hit-stacking around a wildcard/free-hit; second-wildcard timing for the run-in.
- Written as **principles, not a fixed plan** — durable, season-agnostic where possible; the dated GW19 fact is flagged as season-specific.

## Validation
- Unit: the loader reads `chips.md` and caches; `synthesizeLongTerm` includes the text in its prompt (assert the prompt contains a known principle marker).
- Qualitative smoke (live key): the narrative correctly references the two-halves/GW19 rule and gives per-half timing — not generic chip advice.
- App gate: `tsc`/`eslint`/`next build`/`vitest`; `longTermNarrative` still produced; ChipTimeline byte-identical (deterministic, untouched).

## Pitfalls / notes
- **Don't touch `chipPlan`** — the structured timeline must stay deterministic (scope B).
- **Trusted content** — `chips.md` is repo-authored, so no untrusted-input hardening needed (unlike team-news).
- **Stale season facts** — the GW19 date is 2025/26-specific; keep such dated facts in one clearly-labelled section so they're easy to update each season (ties to `new-season-readiness`).
- **Chip-count correctness** is a separate concern (the GW19 half-expiry verify item lives in `new-season-readiness`) — if the facts are wrong, grounding can't save the narrative.
