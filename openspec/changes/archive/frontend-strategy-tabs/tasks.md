## Tasks

**Status: ✅ Complete (implemented + design-reviewed).** Built the prose-left / data-right tab-as-lens layout (controlled tabs, `ScoutVerdict` + pinned `AlertsCard` left, `ThisWeekDetail` / `LongTermDetail` right, deterministic long-term summary). Verified in-browser across both lenses; a follow-up `fpl-design-review` pass applied the typography/depth/accent refinements recorded in `design.md` ("As-built design notes"). tsc + lint + build clean; backend tests still 130 passing. No backend changes.

> No backend changes — all content comes from the existing `/api/plan` `GameweekPlan`.
> This revised the interim build (tabbed *right* panel) into the **prose-left / data-right, tab-as-lens** layout. Existing pieces are reused where noted.

### Task 1: Lens layout + controlled tabs
**Capability:** strategy-tabs
**Files:** `components/ui/tabs.tsx`, `app/page.tsx`

Make `Tabs` **controlled** (optional `value` / `onValueChange`). Lift the active-tab state into `app/page.tsx`. Lay out two columns: **left** = `Pitch` + `ScoutVerdict` + `AlertsCard`; **right** = the tab bar + the active `*Detail`. Pitch pinned; mobile stacks pitch → prose/alerts → detail. Ask The Scout stays a disabled tab.

### Task 2: Left prose zone + pinned alerts
**Capability:** this-week-tab / long-term-tab
**Files:** `components/panel/ScoutVerdict.tsx`, `components/panel/AlertsCard.tsx`, `lib/client/longTermSummary.ts`

`ScoutVerdict` (tab-aware): This Week → `transfers.narrativeSummary` + `hitVerdict.reasoning` (+ optional `captaincy.narrativeSummary`); Long Term → a deterministic summary from `buildLongTermSummary(plan)` (composed from horizon/chips/TC advice/chipsRemaining/currentGw), with a reasoned fallback sentence when empty. `AlertsCard` renders merged, de-duplicated alerts and is pinned left across tabs (hidden when none). The AI-offline chip shows here when confidence is low.

### Task 3: This Week detail (right)
**Capability:** this-week-tab
**File:** `components/panel/ThisWeekDetail.tsx` (refactor of `ThisWeekTab.tsx`)

Right column only (no paragraphs): the transfer move (out→in + confidence badge + a one-line hit status), restructure chains (hidden when empty), and captaincy picks (C/V/differential) + the expandable `CaptainRanking` top-5. Move the narrative/hit-reasoning/alerts OUT to the left (Task 2).

### Task 4: Long Term detail (right)
**Capability:** long-term-tab
**File:** `components/panel/LongTermDetail.tsx` (refactor of `LongTermTab.tsx`)

Right column only: `HorizonSparkline` list + `ChipTimeline` (windows + chips-remaining), with the four reasoned empty states. Reuse the existing `HorizonSparkline` / `ChipTimeline` components.

### Task 5: Cleanup
Remove the superseded `StrategyTabs.tsx` / `ThisWeekTab.tsx` / `LongTermTab.tsx` once their content is split into the left prose + right detail components. Keep `HorizonSparkline`, `ChipTimeline`, `CaptainRanking`, `parts.tsx`.

### Task 6: Verify
- `npm run dev`, load a real manager (e.g. `10815578`): prose sits under the pitch on the left, structured detail on the right; switching tabs changes **both** columns; alerts stay pinned left; columns are roughly balanced (left may run longer).
- Long Term left shows the deterministic summary (or reasoned fallback at GW38); right shows horizon/chips with reasoned empties.
- Mobile stacks pitch → prose/alerts → detail.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` clean; `npm test` unaffected (130 passing).
