# Re-analyze only on demand — stop auto-reloading on the FT toggle

## Why

Toggling the free-transfer count immediately triggers a full re-analysis: `handleFreeTransfers` calls `load(managerId, n)` ([app/page.tsx:97–100](app/page.tsx)), which re-runs the base **and** the LLM insights phase (a real spend) and resets the chat. The manager often just wants to set the number and decide — every toggle shouldn't reload the app. Re-analysis should happen only when they click **Re-analyze**.

## What changes

- **The FT toggle updates the selected value only** — it persists the choice (localStorage) and updates the control, but does not call `load`. No fetch, no chat reset, no LLM spend.
- **Re-analyze applies the selected FT.** The existing Re-analyze button runs `load(managerId, freeTransfers, { force: true })` with the currently-selected value, so it picks up the toggle's new number.
- **A "pending" signal.** Because the on-screen plan still reflects the previously-analyzed FT, track the applied value and mark the controls dirty when the selection differs — the Re-analyze button is highlighted so it's clear the new number won't take effect until clicked.
- **Chat stays consistent with the displayed plan.** The chat is grounded with the *applied* FT (the one the current analysis used), not the pending selection, so its simulations match what's on screen until a re-analysis is run.

## Scope & decisions

- **Selected vs applied.** Track both: `freeTransfers` (the toggle's current value, shown in the header) and the applied value the current plan was computed with. `dirty = loaded && selected !== applied`.
- **Re-analyze is the only trigger** for an FT change. Initial load (manager submit) and Reset are unchanged; switching manager still loads as before.
- **Persistence unchanged.** The toggle still writes `fpl:ft` so the next session remembers the preference.
- **No new "Apply" button.** Re-use the existing Re-analyze button (highlighted when dirty) rather than adding a control.

## Out of scope

- Auto-applying the FT change after a debounce, undo, or any change to the insights cache key/TTL.
- Any change to what the analysis computes.
