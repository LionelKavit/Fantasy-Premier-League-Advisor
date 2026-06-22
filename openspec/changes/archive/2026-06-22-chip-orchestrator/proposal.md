# Chip orchestrator — chips.md-grounded LLM judgment

## Why

`chips.md` only ever decorated output; it never shaped a decision, and we removed even that. The genuinely valuable part of chip strategy — **sequencing the half and judging *when* to commit** — is not deterministically encodable. This change adds the judgment layer: an LLM orchestrator that reasons over the **deterministic candidate windows** (the facts) using **`chips.md`** (the principles) to produce the season chip plan, and — per the N2 decision — is the **only** thing allowed to tell This Week to play a chip.

It is the headline of the chip rework, sitting on top of `chip-single-source-of-truth` (the single `chipPlan` + invariant) and `chip-candidate-windows` (sound windows). It also keeps `chips.md` as a **live grounding input** — the user's actual goal.

## What changes

- **A chip orchestrator** (new synthesis). Single LLM call: system grounding = `chips.md`; input = the deterministic candidate windows + chip state + fixture facts + the current GW's top captain-candidate signals (built deterministically — the orchestrator may only reason over provided facts, never invent gameweeks/Doubles). Output = a **structured** plan: for each remaining chip, promote a `window` to `play-now` (this gameweek), sequence it for a future gameweek, or hold — each with reasoning and confidence.
- **Single-fixture Triple Captain is judged here, not thresholded deterministically.** A TC on a single great fixture (no Double) is the highest-risk call, so `chip-candidate-windows` defers it. Using the captain signals in the grounding, the orchestrator may propose a single-fixture TC only when the ceiling is fixture-driven (very weak opponent), the player is in form and nailed on minutes, and there's no premium Double before the chip expires — otherwise hold.
- **The orchestrator's plan becomes the single `chipPlan`** both tabs read (it refines the deterministic windows; nothing else elects chips). This stops the model's sequencing from being discarded.
- **LLM-gated This Week activation (N2).** This Week surfaces a chip activation **only** when the orchestrator sets `play-now` at the current gameweek, with its draft. The deterministic layer never activates.
- **Keyless degradation.** No key → the orchestrator is skipped → `chipPlan` is the deterministic candidate windows → This Week shows no chip (N2) and the Chips tab shows the windows with **templated reasoning + an "AI reasoning offline" badge**. The invariant holds in both modes.

## Scope & decisions

- **Single-shot, grounded, structured** — not an agentic tool loop; the orchestrator reasons over provided facts, no tools, no invented fixtures (Option B from the design discussion).
- **N2 keyless** — chip activation in This Week requires the orchestrator; keyless shows windows only.
- **Cached** per team + gameweek (like insights); bounded tokens.
- **Honest framing** — chip decisions are sparse / not backtestable, so the plan is presented as reasoned, grounded guidance, never a fitted prediction.
- Depends on `chip-single-source-of-truth`; benefits from `chip-candidate-windows` (better substrate) but works on either.

## Out of scope

- Tool-using/agentic chip simulation (Option C) and the Scout-chat `plan_chips` tool (Option D) — possible follow-ups.
- The deterministic trigger quality itself (`chip-candidate-windows`).
