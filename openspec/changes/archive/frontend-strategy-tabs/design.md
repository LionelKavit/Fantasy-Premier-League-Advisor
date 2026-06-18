# Design

## Context

All content is already in the single `GameweekPlan` from `/api/plan`:
- `transfers` (`OptimizerResult`): `primaryRecommendation`, `hitVerdict`, `restructureOptions[]`, `horizon[]`, `chipPlan[]`, `alerts`, `confidence`, `narrativeSummary`.
- `captaincy` (`CaptainResult`): `captain`, `viceCaptain`, `differentialOption`, `rankedCandidates[]`, `tripleCaptainAdvice`, `narrativeSummary`, `alerts`.
- `chipsRemaining`, `currentGw`, plan-level `alerts`.

**No new fetch, no new backend.** This is a layout/IA change: the tab is a *lens* applied to both columns — **prose on the left, structured data on the right** — fixing the empty space under the pitch and giving the LLM synthesis room to breathe.

## Key Decisions

### 1. The tab is a lens over both columns; the pitch is pinned
The active tab state lifts up to `app/page.tsx`. The pitch stays fixed (top-left) across tabs. Switching the tab re-renders **both**:
- **Left column** = pitch + a tab-aware **prose zone** + **pinned alerts**.
- **Right column** = the tab bar + **tab-aware structured detail only** (no paragraphs).

Tabs: **This Week** (default) · **Long Term Strategy** · **Ask The Scout** (disabled, "coming soon"). On mobile, columns stack: pitch → prose → structured detail.

### 2. Left column: prose only (the scout's writing)
- **This Week lens** → the weekly verdict prose: `transfers.narrativeSummary` (the LLM synthesis) plus the `hitVerdict.reasoning`, and optionally `captaincy.narrativeSummary`.
- **Long Term lens** → a **deterministic, client-side summary** composed from data we already have (horizon timings/gains, chip windows + each chip's `reason`, `tripleCaptainAdvice.reasoning`, `chipsRemaining`, `currentGw`). Reads naturally, works offline, **no backend**.
- A genuine LLM-written long-term narrative is **deferred** to a later small backend change (a `longTermNarrative` synthesis field), to land alongside wiring a real API key — with this deterministic summary as the offline fallback.

### 3. Right column: structured detail only (scannable, no paragraphs)
- **This Week** → the transfer move (out→in + confidence badge), restructure sell-to-fund chains, captaincy picks (C/V/differential) + the expandable **top-5** ranking.
- **Long Term** → horizon **sparklines** + timing badges, and the **chip timeline** + chips-remaining status.

### 4. Alerts are pinned left, always visible
Alerts (price rises, doubtful players, multiple weak spots) live in the left column **regardless of the active tab** — they're time-sensitive warnings the user shouldn't have to tab to find. Merged + de-duplicated from `plan.alerts`, `transfers.alerts`, `captaincy.alerts`.

### 5. Column balance
Because grid columns are independent in height, moving the prose + alerts left balances the two columns and consumes the dead space under the pitch. The left may run longer than the right (allowed) to fit the synthesis; columns are top-aligned.

### 6. No charting dependency; reasoned empty states
Sparklines are hand-rolled inline **SVG**; the chip timeline is a **CSS** GW axis. Empty sections explain *why* (final GW vs mid-season; chips used vs no window) — see `long-term-tab`. The Long Term **left prose** also degrades to a reasoned sentence when there's nothing to plan.

## Component map

```
app/page.tsx                          // owns the active-tab (lens) state; left = Pitch + ScoutVerdict + Alerts; right = tab bar + detail
components/ui/tabs.tsx                 // Tabs primitive — made CONTROLLED (value / onValueChange) so the page owns lens state
components/panel/ScoutVerdict.tsx      // LEFT prose zone, tab-aware: This-Week narrative(+hit reasoning) | Long-Term deterministic summary
components/panel/AlertsCard.tsx        // LEFT pinned alerts (always visible)
components/panel/ThisWeekDetail.tsx    // RIGHT structured: transfer move, restructure chains, captaincy + top-5
components/panel/LongTermDetail.tsx    // RIGHT structured: horizon sparklines + chip timeline + chips-remaining
components/panel/HorizonSparkline.tsx  // inline-SVG cumulative-gain sparkline + timing badge
components/panel/ChipTimeline.tsx      // CSS GW axis of recommended chip windows + chips-remaining row
components/panel/CaptainRanking.tsx    // expandable top-5 from rankedCandidates
lib/client/longTermSummary.ts          // deterministic Long-Term prose builder (no backend)
```

(Refactor of the interim build: the prose + alerts move out of `ThisWeekTab`/`LongTermTab` into the left column; those tab components become the right-side `*Detail` components. `RecommendationPanel.tsx` remains superseded.)

## Reused
- `GameweekPlan` / sub-types from `lib/plan/types.ts`, `lib/optimizer/types.ts`, `lib/captain/types.ts`.
- `scoreToRating` / `ratingTier` from `lib/client/formation.ts`; `cn()`, `lucide-react`, FPL CSS variables.

## As-built design notes (post design-review)
A `fpl-design-review` pass on the implemented layout produced these refinements (verified in-browser):
- **Typography fix (P1):** the app was rendering in the serif fallback because `--font-sans` self-referenced in `globals.css`. Wired `--font-sans: var(--font-geist-sans)` so the whole UI uses **Geist sans** (FPL-crisp). The single biggest visual lift.
- **Depth (P2):** deepened the page background to `#1a0032` (FPL deep purple) so the `#37003c` header and `#2d0032` cards layer cleanly off it.
- **Shirt pop (P2):** player-token card backing raised from `bg-white/10` → `bg-white/15` so kits read clearly on the frosted card.
- **Accent discipline (P3):** the header **Re-analyze** action is an outline pill with a green icon (not a solid-green fill), keeping green for active-state/captain accents. (The onboarding "Analyze my team" CTA stays solid green — it's the single primary action.)
- **Restructure grouping (P3):** funding options are grouped under one "To afford {dream}" heading rather than repeating it per option.
- **Misc (P3):** token price text contrast `white/55` → `white/70`; page/header container widened `max-w-5xl` → `max-w-6xl` to reduce bare side margins.
- **Deliberately not changed:** the offline two-line fail-safe verdict (per user) — it fills out into real prose once a Claude key is wired.
