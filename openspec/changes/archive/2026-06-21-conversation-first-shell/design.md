# Design

## Context

The loaded screen (`app/page.tsx`) is a two-column grid: left = `Pitch` + `ScoutVerdict` (tab-aware prose) + `AlertsCard`; right = a 3-tab bar (`This Week` / `Long Term` / `Ask The Scout`) driving `ThisWeekDetail` / `LongTermDetail` / `AskTheScout`. The lens state (`lens`) lives on the page. All content derives from one `GameweekPlan`; there is no per-tab fetch. `AskTheScout` is already a self-contained, client-state chat panel.

This change re-weights that layout so the conversation leads, without removing anything. It is layout/IA only — the chat behaves exactly as today after it lands (the proactive open is the next change). Shipping the shell first separates "where things live" from "the Scout speaks first", de-risking the bet.

## Key Decisions

### 1. Conversation is promoted out of the tab set into a permanent hero slot
`AskTheScout` stops being one of three tab targets and becomes always-rendered as the prominent surface. The "Ask The Scout" tab trigger is removed (it would be redundant — chat is always present). The remaining lens (`This Week` / `Long Term`) no longer gates the chat.

### 2. Structured detail moves into a collapsible drawer labelled "This week & long-term plan" — always collapsed on load
`ThisWeekDetail` and `LongTermDetail` render **unchanged** inside a disclosure. The existing `components/ui/tabs.tsx` toggle moves *inside* the drawer to switch between the two. The drawer **always starts collapsed** — no persisted open/closed state — so every load leads with the conversation; the full dashboard is one deliberate click away, never competing for first read. (Decision locked with the user: simplicity over a remembered preference.)

The drawer's header label is **"This week & long-term plan"** (not a bare "Full breakdown") so it reads as *what's inside* — the full This Week + Long Term detail — rather than a generic toggle. (User feedback: make the affordance point at the two sections it reveals.)

### 3. Layout: 2×2 grid — pitch | conversation (row 1), plan | alerts (row 2); the conversation matches the pitch height
The two-column grid holds **four cells**. **Row 1:** pitch (left) and the Scout conversation (right). **Row 2:** the collapsible plan drawer (left, under the pitch) and the alerts (right, under the conversation). The pitch stays top-left because it is the app's signature **instant-paint** visual (base phase), so the screen looks populated the moment it loads while the conversation fills in (its brief arrives with insights / Change 4) — best perceived load with the least restructure.

The conversation is **stretched to match the pitch's height** (`lg:self-stretch` on the chat as a grid item; the pitch defines the row-1 track height). This makes the hero feel deliberate and balanced rather than a fixed-height card floating next to a taller pitch. (User feedback.)

The **alerts move out of the left column to under the conversation** (row 2 right). They stay always-visible and time-sensitive, but no longer sit between the pitch and the plan drawer — the left column is now a clean pitch → plan stack. (User feedback.)

### 4. Resolve the two-prose-surfaces problem — relocate `ScoutVerdict`, don't duplicate it
Today the left `ScoutVerdict` shows tab-aware narrative. With the conversation (and the opening brief) now carrying the Scout's reasoning, an always-visible prose card would say the same thing twice. Decision (locked): **`ScoutVerdict` is no longer rendered in the always-visible area.** The **weekly** verdict prose is dropped from the screen entirely — it is exactly what the brief/conversation covers (the This Week breakdown shows only `ThisWeekDetail`, structured). The **long-term outlook** prose has no other home (the opening brief is about *this week*), so it is relocated **into the drawer's Long Term view**, above `LongTermDetail`. This also reinforces the This Week vs Long Term separation: the brief owns the week, the drawer owns the horizon.

### 5. No data/behaviour change
The lens still derives entirely from the loaded `GameweekPlan`; opening the drawer or switching its tab triggers no fetch. `AskTheScout`'s internals are untouched here beyond moving to the hero slot and receiving the props the next change will need (plan access + a ready signal) — wired but inert this change.

## Design constraints

- **Nothing removed** — every panel that exists today is still reachable; only placement and default visibility change.
- **Reuse, don't rewrite** — `ThisWeekDetail`, `LongTermDetail`, `AskTheScout`, and the `Tabs` primitive render as-is; this change edits `app/page.tsx` and adds at most a thin disclosure wrapper.
- **No new fetch** — single-source-from-`GameweekPlan` is preserved.
- **Responsive** — desktop: 2×2 grid (pitch | conversation, then plan-drawer | alerts), conversation stretched to the pitch height; mobile: stack pitch → conversation → plan drawer → alerts.
- **Always-collapsed drawer** — starts collapsed on every load; no localStorage/remembered state.
- **Chat height tracks the pitch** — the conversation stretches to the pitch's height on desktop (with a sensible `min-h` floor for mobile/short pitches); no fixed `h-[34rem]`.
- **Accessible** — the drawer exposes correct expanded/collapsed semantics and is keyboard-operable; the in-drawer tab bar keeps its existing ARIA roles/selected state.
- **Behaviour-frozen chat** — the brief auto-open is explicitly *not* in this change; the chat must still work for manual questions immediately after this lands.

## Component map

```
app/page.tsx                       // 2×2 grid: pitch | conversation, plan-drawer | alerts; drops the Ask tab; owns drawer open state
components/panel/AskTheScout.tsx    // promoted to hero slot; gains an optional `className` and stretches to the pitch height (min-h floor, no fixed h-[34rem])
components/panel/FullBreakdown.tsx  // the collapsible drawer; header label "This week & long-term plan"
components/ui/tabs.tsx              // unchanged primitive — now used INSIDE the drawer for This Week / Long Term
components/panel/ThisWeekDetail.tsx // unchanged — the This Week detail (structured only, no prose)
components/panel/LongTermDetail.tsx // unchanged — the Long Term detail (structured)
components/panel/ScoutVerdict.tsx   // unchanged component; NO longer rendered always-visible. Reused once, in long-term mode, inside the drawer's Long Term view (above LongTermDetail)
components/panel/AlertsCard.tsx     // unchanged component — moved to the RIGHT column, under the conversation
```

## Reused
- The single `GameweekPlan` and its sub-types; the controlled `Tabs` primitive; `Pitch` / `AlertsCard` / `*Detail` panels; FPL CSS variables and existing layout utilities.

## Follow-ups
- `proactive-scout-brief-ui` consumes the props wired here to auto-fire the brief into the hero chat and swap in contextual starters.
