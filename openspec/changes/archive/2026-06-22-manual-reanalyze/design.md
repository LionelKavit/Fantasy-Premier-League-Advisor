# Design

## Context

`Home` owns analysis state ([app/page.tsx](app/page.tsx)). `load(id, ft, opts)` runs the two-phase pipeline and (among other things) calls `setFreeTransfers(ft)` and resets the chat. `handleFreeTransfers(n)` currently persists `n` and immediately calls `load(managerId, n)` ([:97–100](app/page.tsx)). The Re-analyze button already calls `load(managerId, freeTransfers, { force: true })` ([:145](app/page.tsx)). The header renders the FT toggle and the Re-analyze button ([components/Header.tsx](components/Header.tsx)).

## Key decisions

### 1. Selected vs applied free-transfers
Introduce `appliedFt` — the FT value the currently-displayed plan was computed with — alongside the existing `freeTransfers` (the toggle's selected value). `load` sets `appliedFt = ft` (it already sets `freeTransfers = ft`), so after any analysis the two agree. The toggle changes only `freeTransfers`, so they diverge until the next analysis. `dirty = status === "loaded" && freeTransfers !== appliedFt`.

### 2. The toggle no longer loads
`handleFreeTransfers(n)` becomes: persist `n` to localStorage and `setFreeTransfers(n)` — nothing else. No fetch, no chat reset. Re-analysis happens only via the Re-analyze button, which reads the now-updated `freeTransfers`.

### 3. Pending signal on Re-analyze
Pass `dirty` to `Header`. When dirty, style the Re-analyze button to stand out (solid FPL green instead of the ghost outline) and give it a title like "Apply the new free-transfer count" so the pending state is legible. No new button or copy churn.

### 4. Chat grounded on the applied value
The page passes `freeTransfers` to `AskTheScout` today; switch that to `appliedFt` so the chat's simulations match the plan currently on screen (not a pending toggle the user hasn't applied). After re-analysis the two converge, so this only matters in the dirty window.

## Files
```
app/page.tsx          // add appliedFt; load() sets it; handleFreeTransfers stops calling load; pass dirty to Header; pass appliedFt to AskTheScout
components/Header.tsx  // accept dirty?: boolean; highlight Re-analyze when dirty
```

## Tests / verification
- No existing unit test covers the page wiring; verify in the browser: toggling FT does not reload or reset the chat, the Re-analyze button highlights, clicking it re-runs with the new FT and clears the highlight; Reset / change-manager unchanged.
- `tsc`/`eslint`/`vitest` green.
