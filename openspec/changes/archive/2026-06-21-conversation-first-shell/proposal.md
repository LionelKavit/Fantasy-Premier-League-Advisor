# Conversation-first shell — chat becomes the hero (UI)

## Why

The loaded screen is a flat dashboard: pitch + verdict + alerts + three equal-weight tabs (This Week / Long Term / Ask The Scout), all competing for attention. The engine already knows the one decision that matters, but the layout buries the agent — the thing that makes Pocket Scout a *scout* — as the third tab, started empty.

This change re-architects the shell so the **conversation is the primary, always-visible surface** and the dashboard becomes supporting reference. It is a layout change only: the chat still works exactly as today (manual questions) after this lands — the proactive opening brief is wired in by the separate `proactive-scout-brief-ui` change. Shipping the shell first de-risks the bet by separating "where things live" from "the Scout speaks first."

**Decision (locked):** lowest-risk variant — **keep** the pitch and **keep** the This Week / Long Term structured panels (moved into a collapsible drawer labelled **"This week & long-term plan"**). Nothing is removed; the hierarchy is re-weighted.

## What Changes

- **Modified capability `strategy-tabs`** — the screen is no longer "tabs as a lens over two columns". Instead:
  - The **conversation** (the existing `AskTheScout` panel) becomes the prominent, always-visible hero surface — not gated behind a tab.
  - **This Week** and **Long Term** move into a single collapsible drawer labelled **"This week & long-term plan"** (a disclosure; the existing tab toggle lives *inside* it), **always collapsed on load** so the conversation leads.
  - The **pitch** and **alerts** remain as the supporting column (pitch still paints instantly from the base phase).
  - The "Ask The Scout" tab is removed (chat is now always present); the long-term narrative remains reachable inside the drawer rather than duplicated in an always-visible prose card.
- All content still derives from the already-loaded `GameweekPlan` — no new fetch introduced by this change.

## Scope & decisions

- **Keep everything, re-weight it** — pitch always visible; structured detail one click away in the drawer.
- **Layout only** — no change to the chat's behaviour, the agent, or the plan data. The brief auto-open + contextual starters are the next change.
- **Responsive** — on mobile the conversation leads, pitch above it, breakdown drawer below.
- Reuse the existing `components/ui/tabs.tsx` (now inside the drawer) and the existing `ThisWeekDetail` / `LongTermDetail` panels unchanged.

## Out of scope

- Proactive brief streaming / auto-open and contextual starters (`proactive-scout-brief-ui`).
- Any change to `AskTheScout`'s internal behaviour beyond promoting it to the hero slot and passing the props the next change needs.
