# Strategy Tabs (Pocket Scout v2 UI)

## Why

Pocket Scout currently shows a single recommendation panel beside the pitch — and the pitch is short, so a large empty space sits under it while the right panel runs long. Meanwhile `/api/plan` already computes far more than we surface: multi-gameweek transfer **horizon** timing, **chip** recommendations, and **restructure** (sell-to-fund) chains. This change turns the screen into a short- and long-term planner with a **prose-left / data-right** layout that uses that empty space.

Crucially this needs **no backend work**: every field is already in the `GameweekPlan`. It is purely an information-architecture + rendering change.

## What Changes

The screen becomes a two-column layout where a **tab acts as a lens** over both columns (the pitch stays pinned top-left):
- **Left column** = pitch + a tab-aware **prose zone** (the scout's writing) + **pinned alerts**.
- **Right column** = the tab bar + tab-aware **structured detail only** (no paragraphs).

- **`strategy-tabs`** — the lens IA: tabs (This Week default, Long Term Strategy, Ask The Scout disabled), state lifted to the page so both columns react, prose-left/data-right discipline, alerts pinned left across tabs, responsive stacking.
- **`this-week-tab`** — *left:* the LLM weekly verdict (`narrativeSummary` + hit reasoning). *right:* the transfer move, **restructure chains**, captaincy picks + **expandable top-5 ranking**.
- **`long-term-tab`** — *left:* a **deterministic, client-side** long-term summary (horizon + chips), with reasoned fallback. *right:* horizon **sparklines** + a **chip timeline** + chips-remaining, with reasoned empty states.

## Scope

- Only the **This Week** and **Long Term Strategy** lenses.
- **Ask The Scout** scaffolded as a disabled tab only — later change.
- Player drill-down deferred (needs per-player backend data).
- A genuine **LLM-written long-term narrative** is deferred to a later small backend change (a `longTermNarrative` field) — this change uses the deterministic summary as the offline-friendly version (and future fallback).
- **No backend changes** in this change — consumes the existing `/api/plan` response.
