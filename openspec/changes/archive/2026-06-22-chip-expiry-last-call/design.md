# Design

## Context

`evaluateChipInteractions` ([chip-interaction.ts:13](lib/optimizer/chip-interaction.ts)) runs four forward-looking evaluators, applies a wildcard/bench-boost conflict rule, then calls `applyExpiryPressure` to append urgency to whatever recommendations exist. On the half-deadline gameweek the evaluators produce nothing (no future fixtures to key on), so the result is empty and the held chips expire unflagged. The deterministic windows feed `transfers.chipPlan`, which the orchestrator refines and both tabs read (single source).

## Key decisions

### 1. A terminal "last-call" generator, gated to the deadline GW
Add `pushLastCallWindows(recs, chips, currentGw, squad, picks, validTransfers)`. It runs only when `currentGw === deadline` (the half's last playable gameweek — GW19 or GW38), and only fills chips that have **no** existing window. This is deliberately narrower than `applyExpiryPressure`'s 4-GW urgency band: forcing a play-now window earlier could pre-empt a real future window (e.g. a GW37 Double) that the evaluators would otherwise find.

### 2. Per-chip last-GW value gates
- **Triple Captain** → always emit (on `squad[0]`, the top player, matching the existing TC fallback's notion of "best"). Tripling your captain is strictly ≥ a normal captain, so on the final GW it's always worth playing an expiring TC.
- **Bench Boost** → emit when the bench (`picks.position >= 12`) has positive average score. If the bench will score anything, boosting it is free points and the chip is otherwise lost.
- **Free Hit / Wildcard** → emit only when the starting XI (`picks.position <= 11`) has an availability hole — a starter whose `availability.status !== "available"` or `chanceOfPlayingNext <= 50`. With no future to set up, these chips only salvage points by fielding a fit XI. Prefer **Free Hit** (one-week, reversible) over **Wildcard**; emit Wildcard only if Free Hit isn't held and there's at least one beneficial transfer to make. This avoids recommending a pointless chip on an already-fit final-GW squad.

### 3. Status and ordering preserve the invariant
Every last-call entry is `status: "window"` with `triggerGw = currentGw` — never `play-now`. `pushLastCallWindows` runs after the evaluators and **before** `applyExpiryPressure`, so the expiry suffix ("⚠ Expires GW38 — use it or lose it.") decorates the new windows too. Promotion to `play-now` remains solely the orchestrator's job; keyless → windows shown, This Week inactive (N2). One-chip-per-gameweek is enforced downstream by the orchestrator (it sets at most one `play-now`).

### 4. No change beyond the generator
With windows now present at `currentGw`, the orchestrator's existing grounding guard finds `windowNow` for BB/TC/FH/WC and can promote one — no orchestrator, prompt, guard, type, or UI change is needed. The reasons are written without a trailing "before it expires" since `applyExpiryPressure` adds the explicit expiry line.

## Files
```
lib/optimizer/chip-interaction.ts   // add pushLastCallWindows; call it before applyExpiryPressure
lib/__tests__/optimizer/chip-expiry-last-call.test.ts   // (new)
```

## Tests
- Final GW (38), holds BB with a scoring bench, no DGW → a Bench Boost `window` at GW38 with the expiry suffix.
- Final GW, holds TC → a Triple Captain `window` at GW38.
- Final GW, holds Free Hit, an injured starter in the XI → a Free Hit `window` at GW38; a fully-fit XI → no FH/WC window.
- Non-deadline GW (20) with no future fixtures → no last-call windows (unchanged behaviour).
- An existing fixture window for a chip is not duplicated by last-call.
- `npx tsc --noEmit`, `eslint .`, `vitest` green.
