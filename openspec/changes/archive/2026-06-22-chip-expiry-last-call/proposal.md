# Chip expiry last-call — surface a play-now window on the final gameweek

## Why

On the last gameweek a chip can be played (a half deadline — GW19 or GW38), the app recommends nothing and tells the manager "no upcoming gameweek currently clears the bar." A held chip then silently expires (~10–15 points lost). The cause is structural, traced across three layers:

- **The deterministic generator is forward-looking.** Every evaluator in [chip-interaction.ts](lib/optimizer/chip-interaction.ts) needs a *future* DGW/BGW or a multi-GW hard fixture run bounded by the half end. On the deadline gameweek there is no "ahead," so all four return `null` → **zero windows**.
- **Expiry pressure is cosmetic.** `applyExpiryPressure` ([:93](lib/optimizer/chip-interaction.ts)) only appends an "use it or lose it" warning to recommendations that already exist; with zero recommendations it does nothing — it never *creates* a window.
- **The orchestrator can't rescue it.** The grounding guard ([chip-orchestrator.ts:127–138](lib/optimizer/chip-orchestrator.ts)) only promotes a `play-now` that has a window at the current gameweek (the single-fixture Triple Captain is the lone exception). With no window, a Bench Boost / Free Hit / Wildcard play-now is structurally dropped — the model has no accepted way to say "just play Bench Boost now, it expires tonight."

## What changes

- **Add a deterministic "last-call" window generator** in the chip layer. When the current gameweek **is** the half's chip deadline and a held chip has no fixture window, emit a `window` at the current gameweek for chips that have real last-gameweek value:
  - **Triple Captain** — always (it triples your best captain; strictly ≥ a normal captain).
  - **Bench Boost** — when the bench has positive projected value (it would score).
  - **Free Hit / Wildcard** — only when the starting XI has an availability hole to patch (a flagged/unlikely starter), so the chip salvages points by fielding a fit XI; otherwise skipped (with no future to set up, they're ~0 EV). Free Hit is preferred over Wildcard at season end.
- **The rest of the pipeline then works unchanged.** These windows are `status: "window"` (never `play-now`) per the single-source invariant; the orchestrator can now legitimately promote one to `play-now`, and `applyExpiryPressure` decorates them with the explicit expiry. Keyless, the Chips tab shows them with the expiry reason and This Week stays inactive (N2).

## Scope & decisions

- **Final gameweek only.** Last-call fires when `currentGw === half deadline` (GW19 or GW38) — the genuinely last chance — not earlier (where a real future window may still arrive). Existing `applyExpiryPressure` still raises urgency across the preceding `expiryPressureGws`.
- **Value-gated, not "use it blindly."** TC/BB are surfaced because they always have last-GW value; WC/FH only when they'd actually save points (an unfit XI). This avoids recommending a pointless Wildcard on an already-optimal final-GW squad.
- **Deterministic-only change.** No orchestrator, guard, prompt, type, or UI change — the fix is the missing windows.
- **Invariant preserved.** Emits `window` only; promotion to `play-now` remains the orchestrator's job (N2).

## Out of scope

- Changing the orchestrator's single-fixture Triple Captain gate or any prompt.
- Computing a bespoke Free Hit / Wildcard draft for the last-GW case beyond the existing draft handling.
