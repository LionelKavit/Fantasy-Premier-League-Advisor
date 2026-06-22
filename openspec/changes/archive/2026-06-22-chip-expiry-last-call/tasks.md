## Tasks

### Task 1: Last-call window generator
**Capability:** chip-candidate-windows
**File:** `lib/optimizer/chip-interaction.ts`

Add `pushLastCallWindows(recs, chips, currentGw, squad, picks, validTransfers)`, run before `applyExpiryPressure`. Fires only when `currentGw === half deadline`. For each held chip with no existing window, emit a `status: "window"` at `currentGw`:
- Triple Captain — always (on `squad[0]`).
- Bench Boost — when the bench (`picks.position >= 12`) has positive average score.
- Free Hit / Wildcard — only when the XI (`picks.position <= 11`) has an availability hole (`status !== "available"` or `chanceOfPlayingNext <= 50`); prefer Free Hit, Wildcard only if Free Hit isn't held and a beneficial transfer exists. Reasons omit the expiry tail (`applyExpiryPressure` adds it).

### Task 2: Tests
**File:** `lib/__tests__/optimizer/chip-expiry-last-call.test.ts` (new)

- GW38 + Bench Boost + scoring bench → BB window at 38 with the expiry suffix.
- GW38 + Triple Captain → TC window at 38.
- GW38 + Free Hit + injured starter → FH window; fully fit XI → none.
- GW20 (not deadline) + no fixtures → no last-call windows.
- Existing fixture window not duplicated.

### Task 3: Verify
- `npx tsc --noEmit`, `eslint .`, `vitest` green.
- Sanity: on the final gameweek with chips held, `transfers.chipPlan` is non-empty so the Chips tab no longer says "no upcoming gameweek clears the bar," and the orchestrator can play one this week.

## Verification
On the half-deadline gameweek, a held Bench Boost / Triple Captain (and a Free Hit / Wildcard when the XI is unfit) appears as a play-now-able window with explicit expiry urgency, instead of nothing.
