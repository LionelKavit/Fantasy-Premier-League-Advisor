## Tasks

> Pure frontend layout change in `app/page.tsx`. The chat keeps working as today; this change does not add the proactive brief.

### Task 1: Promote the conversation to the hero slot
**Capability:** strategy-tabs
**File:** `app/page.tsx`

Restructure the loaded view so `AskTheScout` is always rendered as the prominent surface (its own column/region, full height), no longer one of three tab targets. Keep the manager Header, the Pitch, and the AlertsCard.

### Task 2: Collapse the structured detail into a "Full breakdown" drawer
**Capability:** strategy-tabs
**Files:** `app/page.tsx` (+ a small disclosure wrapper if needed)

Move `ThisWeekDetail` and `LongTermDetail` behind a collapsible "Full breakdown" disclosure, collapsed by default. The existing `Tabs`/`components/ui/tabs.tsx` toggle between This Week / Long Term may live inside the drawer. The panels themselves render unchanged.

### Task 3: Remove the "Ask The Scout" tab + de-duplicate prose
**Capability:** strategy-tabs
**Files:** `app/page.tsx`, `components/panel/ScoutVerdict.tsx` (usage only)

Drop the "Ask The Scout" tab trigger. Keep the long-term narrative reachable inside the breakdown drawer rather than as a second always-visible prose card alongside the conversation (avoid two prose surfaces saying the same thing).

### Task 4: Responsive + a11y
**File:** `app/page.tsx`

- Desktop: conversation prominent beside pitch/alerts; breakdown drawer spans appropriately.
- Mobile: stack pitch → conversation → "Full breakdown".
- The drawer is keyboard-operable with correct expanded/collapsed semantics; the in-drawer tab bar keeps its existing ARIA.

### Task 5: Verify
- `npm run dev` → load a manager: conversation is the hero and usable; "Full breakdown" expands to the unchanged This Week / Long Term panels; pitch + alerts still paint; Re-analyze + change-manager still work.
- `npx tsc --noEmit`, `eslint .`, `vitest` green. Capture a screenshot of the new landing via the preview MCP tools.
- (The brief does not yet auto-fire — that is `proactive-scout-brief-ui`.)
