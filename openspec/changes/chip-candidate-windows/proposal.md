# Chip candidate windows — sound deterministic triggers

## Why

The deterministic chip detector (`evaluateChipInteractions`) generates the candidate windows that both the Chips tab and (later) the LLM orchestrator read — but its triggers are weak, so the substrate is poor:

- **Wildcard fires on the wrong signal.** `evaluateWildcard` recommends a Wildcard whenever there are "≥3 upgrades available now" ([chip-interaction.ts:77](../../../lib/optimizer/chip-interaction.ts)) — not the `chips.md` principle (*before a fixture swing*, or to set up a Double). It has **no** fixture-swing detection despite `computeFdrRun` existing.
- **No expiry / half-awareness.** The season rules in `chips.md` (two sets; first expires GW19, second unlocks GW20 and expires GW38; one chip per gameweek; *don't hoard*) are entirely absent. The strongest `chips.md` claim — *a chip unused by its deadline is ~10–15 wasted points* — has no representation.
- **Myopic look-ahead.** Free Hit / Bench Boost / Triple Captain only look `currentGw + 2..3` ahead, so the engine can't plan a window further out.

These are **deterministic** improvements (calendar + fixture arithmetic the app already computes). Better windows make the Chips tab sound on their own and give the orchestrator a trustworthy substrate.

## What changes

- **Real Wildcard trigger** (`chip-windows`): key off a **fixture swing** (a team's FDR run improving materially, via `computeFdrRun`) and/or a **Double-Gameweek setup**, not "≥3 upgrades." Emits a `window` at the relevant gameweek.
- **Expiry / half-awareness:** encode the season calendar (GW19 first-set expiry, GW20 unlock, GW38; one-per-gameweek) and surface **deadline pressure** as a window nears its expiry ("use-it-or-lose-it").
- **Wider look-ahead:** detect Double/Blank windows across the remaining half, not just the next ~3 gameweeks.
- **Minor:** Free Hit also on a big Double (one-week ceiling); Triple Captain on a single great fixture, not only a Double.

## Scope & decisions

- **Deterministic only** — improves the candidate-window generator; still emits `window` / `hold` (never `play-now`, per N2). No LLM.
- Detection acts on **confirmed** fixtures (the FPL fixture list), so windows are real — the "hold until the PL reschedules" caveat applies to *not-yet-scheduled* doubles, which the detector won't flag anyway.
- Depends on `chip-single-source-of-truth` (the window/`status` model).

## Out of scope

- The LLM orchestrator + sequencing + activation (`chip-orchestrator`).
- The whole-squad Wildcard candidate *set* (the draft); this change is about *when* a chip is worth a window, not rebuilding the squad.
