## Tasks

### Task 1: Add held-chips + expiry grounding and the hit/Wildcard principle
**Capability:** ask-the-scout-backend
**File:** `lib/scout/system-prompt.ts`

In the chip section, render (when ≥1 chip held) the held chips and the current half's expiry gameweek (`currentGw <= CHIP_CALENDAR.firstHalfExpiryGw ? firstHalfExpiryGw : seasonEndGw`), plus a one-line principle: a held chip is use-it-or-lose-it near its deadline; a held Wildcard makes unlimited transfers for free, so when the manager weighs a hit for extra moves and holds an (expiring) Wildcard, point that out — still leading with the optimal call, not urging a chip be spent just to avoid losing it. Reuse the chip labels; import `CHIP_CALENDAR`. Omit when no chips are held.

### Task 2: Tests + verify
**File:** `lib/__tests__/scout/ask.test.ts`

- With chips held → system prompt lists them + expiry gameweek + the Wildcard/hit principle.
- With no chips held → no held-chip section (existing assertions still pass).
- `npx tsc --noEmit`, `eslint .`, `vitest` green. Manual: final GW holding a Wildcard, "should I take a hit?" → answer leads with free transfers + Bench Boost and notes the Wildcard as the free alternative.

## Verification
On the final gameweek with a Wildcard in hand, asking about a hit yields the optimal move plus the Wildcard-as-free-alternative aside — the chat no longer omits the expiring Wildcard.
