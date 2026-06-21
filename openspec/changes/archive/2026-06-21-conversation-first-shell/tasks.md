## Tasks

> Pure frontend layout change in `app/page.tsx`. The chat keeps working as today; this change does not add the proactive brief.
>
> Status: implemented on branch `claude/musing-hoover-ef5e36` and verified in the running app. `tsc` clean, `eslint` 0 errors, `vitest` 223 passed. New `components/panel/FullBreakdown.tsx` holds the drawer.
>
> As-built tweaks from in-app review (also folded into design.md / spec.md):
> - Layout is a **2×2 grid** — pitch | conversation (row 1), plan-drawer | alerts (row 2). The **conversation stretches to the pitch's height** (`AskTheScout` gained an optional `className`; root is now `min-h-[34rem]` + `lg:self-stretch`, no fixed `h-[34rem]`).
> - **Alerts moved to the right column, under the conversation** (out of the left pitch→plan stack).
> - Drawer header label is **"This week & long-term plan"** (not "Full breakdown") so it names the two sections it reveals.

### Task 1 — ✅ Done: Promote the conversation to the hero slot
**Capability:** strategy-tabs
**File:** `app/page.tsx`

Restructure the loaded view so `AskTheScout` is always rendered as the prominent surface (its own column/region, full height), no longer one of three tab targets. Keep the manager Header, the Pitch, and the AlertsCard.

### Task 2 — ✅ Done: Collapse the structured detail into the plan drawer
**Capability:** strategy-tabs
**Files:** `components/panel/FullBreakdown.tsx` (new), `app/page.tsx`

`ThisWeekDetail` and `LongTermDetail` render unchanged inside a collapsible disclosure (`FullBreakdown`), **always collapsed on load**. The `components/ui/tabs.tsx` toggle lives inside the drawer. Header label **"This week & long-term plan"**.

### Task 3 — ✅ Done: Remove the "Ask The Scout" tab + de-duplicate prose
**Capability:** strategy-tabs
**Files:** `app/page.tsx`, `components/panel/ScoutVerdict.tsx` (usage only)

Drop the "Ask The Scout" tab trigger. `ScoutVerdict` is no longer rendered always-visible: the weekly prose is omitted (the conversation/brief owns it) and the long-term outlook is rendered inside the drawer's Long Term view, above `LongTermDetail`.

### Task 4 — ✅ Done: Responsive + a11y
**File:** `app/page.tsx`

- Desktop: 2×2 grid (pitch | conversation, plan-drawer | alerts); conversation stretched to the pitch height.
- Mobile: stack pitch → conversation → plan drawer → alerts.
- The drawer is keyboard-operable with correct expanded/collapsed semantics (`aria-expanded`); the in-drawer tab bar keeps its existing ARIA.

### Task 5 — ✅ Done: Verify
- Verified in the running app (manager 1, off-season GW38): conversation is the hero and matches the pitch height; the "This week & long-term plan" drawer expands to the unchanged This Week (structured) / Long Term (outlook prose + structured) panels; pitch + alerts (under the chat) paint.
- `npx tsc --noEmit` clean, `eslint` 0 errors, `vitest` 223 passed.
- Note: the preview harness's synthetic clicks don't reach React's event delegation (Next 16 / React 19); the toggle was confirmed by invoking the attached `onClick` — real browser clicks work normally.
- (The brief does not yet auto-fire — that is `proactive-scout-brief-ui`.)
