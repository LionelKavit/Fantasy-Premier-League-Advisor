## Tasks

### Task 1: Track applied FT; stop the toggle from loading
**Capability:** analysis-controls
**File:** `app/page.tsx`

- Add `appliedFt` state; set it in `load` alongside `setFreeTransfers(ft)`.
- `handleFreeTransfers(n)`: persist `n` and `setFreeTransfers(n)` only — remove the `load` call.
- Compute `dirty = status === "loaded" && freeTransfers !== appliedFt`; pass it to `Header`.
- Pass `appliedFt` (not the selected `freeTransfers`) to `AskTheScout` so the chat matches the displayed plan.

### Task 2: Pending highlight on Re-analyze
**Capability:** analysis-controls
**File:** `components/Header.tsx`

Accept `dirty?: boolean`; when dirty, render the Re-analyze button highlighted (solid FPL green) with a "pending" title. Leave Reset / FT toggle styling otherwise unchanged.

### Task 3: Verify
- Browser: toggling FT does not reload or reset the chat; Re-analyze highlights when the selection is pending; clicking it re-runs with the new FT and clears the highlight; Reset and change-manager behave as before.
- `npx tsc --noEmit`, `eslint .`, `vitest` green.

## Verification
The FT toggle sets the number without reloading; analysis runs only on Re-analyze, which applies the selected count and clears the pending highlight.
