# Design

## Context

The loaded screen (`app/page.tsx`) is a two-column grid: left = `Pitch` + `ScoutVerdict` (tab-aware prose) + `AlertsCard`; right = a 3-tab bar (`This Week` / `Long Term` / `Ask The Scout`) driving `ThisWeekDetail` / `LongTermDetail` / `AskTheScout`. The lens state (`lens`) lives on the page. All content derives from one `GameweekPlan`; there is no per-tab fetch. `AskTheScout` is already a self-contained, client-state chat panel.

This change re-weights that layout so the conversation leads, without removing anything. It is layout/IA only — the chat behaves exactly as today after it lands (the proactive open is the next change). Shipping the shell first separates "where things live" from "the Scout speaks first", de-risking the bet.

## Key Decisions

### 1. Conversation is promoted out of the tab set into a permanent hero slot
`AskTheScout` stops being one of three tab targets and becomes always-rendered as the prominent surface. The "Ask The Scout" tab trigger is removed (it would be redundant — chat is always present). The remaining lens (`This Week` / `Long Term`) no longer gates the chat.

### 2. Structured detail moves into a collapsible "Full breakdown" drawer, collapsed by default
`ThisWeekDetail` and `LongTermDetail` render **unchanged** inside a disclosure. The existing `components/ui/tabs.tsx` toggle moves *inside* the drawer to switch between the two. Collapsed-by-default is the core usability act: the one decision (in the conversation) leads; the full dashboard is one click away, not competing for first read.

### 3. Keep the pitch and alerts as the supporting region
The pitch is the app's signature instant-paint visual and the alerts are time-sensitive — both stay always-visible. Only the *prose/detail* hierarchy changes. This is the locked "lowest-risk" variant: nothing removed, hierarchy re-weighted.

### 4. Resolve the two-prose-surfaces problem
Today the left `ScoutVerdict` shows tab-aware narrative. With the conversation (and soon the brief) now carrying the Scout's reasoning, an always-visible prose card alongside it would say the same thing twice. Decision: the long-term narrative stays reachable **inside** the breakdown drawer; the weekly reasoning lives in the conversation. One prose surface in the default view, not two.

### 5. No data/behaviour change
The lens still derives entirely from the loaded `GameweekPlan`; opening the drawer or switching its tab triggers no fetch. `AskTheScout`'s internals are untouched here beyond moving to the hero slot and receiving the props the next change will need (plan access + a ready signal) — wired but inert this change.

## Design constraints

- **Nothing removed** — every panel that exists today is still reachable; only placement and default visibility change.
- **Reuse, don't rewrite** — `ThisWeekDetail`, `LongTermDetail`, `AskTheScout`, and the `Tabs` primitive render as-is; this change edits `app/page.tsx` and adds at most a thin disclosure wrapper.
- **No new fetch** — single-source-from-`GameweekPlan` is preserved.
- **Responsive** — desktop: conversation prominent beside pitch/alerts; mobile: stack pitch → conversation → "Full breakdown".
- **Accessible** — the drawer exposes correct expanded/collapsed semantics and is keyboard-operable; the in-drawer tab bar keeps its existing ARIA roles/selected state.
- **Behaviour-frozen chat** — the brief auto-open is explicitly *not* in this change; the chat must still work for manual questions immediately after this lands.

## Component map

```
app/page.tsx                       // hero conversation + supporting pitch/alerts + "Full breakdown" disclosure; drops the Ask tab; owns drawer open state
components/panel/AskTheScout.tsx    // promoted to hero slot (internals unchanged); gains props the next change consumes
components/ui/tabs.tsx              // unchanged primitive — now used INSIDE the drawer for This Week / Long Term
components/panel/ThisWeekDetail.tsx // unchanged — rendered inside the drawer
components/panel/LongTermDetail.tsx // unchanged — rendered inside the drawer
components/panel/ScoutVerdict.tsx   // usage trimmed: long-term narrative lives in the drawer, not a 2nd always-on prose card
components/panel/AlertsCard.tsx     // unchanged — stays in the supporting region
```

## Reused
- The single `GameweekPlan` and its sub-types; the controlled `Tabs` primitive; `Pitch` / `AlertsCard` / `*Detail` panels; FPL CSS variables and existing layout utilities.

## Follow-ups
- `proactive-scout-brief-ui` consumes the props wired here to auto-fire the brief into the hero chat and swap in contextual starters.
