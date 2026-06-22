# Declutter — curate alerts, drop the long-term outlook wall-of-text

## Why

After the conversation-first rework, two surfaces still overwhelm rather than inform:

1. **The Long Term tab opens with a long outlook paragraph.** It's a wall of prose that repeats what the chip-strategy and horizon panels already show structurally, and it competes with the opening brief for the "what's the plan" job. Users skim past it.
2. **The Alerts card is a dumping ground.** It merges `plan.alerts` + `transfers.alerts` + `captaincy.alerts` and renders everything ([AlertsCard.tsx](../../../components/panel/AlertsCard.tsx)). The noisy ones are **LLM-authored** (`raw.alerts`, baked into both syntheses' `buildAlerts`): they restate each other ("it's the final gameweek" twice), restate the brief, and editorialize ("template captaincy is paramount") instead of flagging a risk. An alert should be a **high-risk event you might overlook elsewhere** — nothing more.

This change cuts both to signal.

## What changes

- **Alerts become deterministic, high-signal risk flags only** (`alerts` capability). A small, code-authored allowlist computed from squad data — **no LLM call**:
  - a **starting-XI** player flagged **doubtful / injured / suspended** (esp. captain & vice),
  - an **imminent price change** on a player you **own** or a **recommended target**,
  - **suspension risk** (a booking away from a ban) where the data supports it.
  The free-form LLM `raw.alerts` are **dropped** from the alert surface, along with advisory items like "multiple weak spots at FWD" (that's advice, surfaced in This Week). Alerts are **deduped and capped** (~4, severity-ordered). Genuine **system/degradation notices** (e.g. "AI synthesis unavailable") are kept — they're not redundant.
- **Empty state shows a note, not nothing.** The card **always renders**; when nothing qualifies it shows a brief "no additional alerts" line (today it hides entirely).
- **The Long Term tab drops the outlook prose** (`long-term-outlook` capability). It shows only the structured **Transfer Horizon** + **Chip Strategy**. The backing LLM call **`synthesizeLongTerm` is removed** along with the `longTermNarrative` field — it's display-only, runs in parallel, and **never feeds any decision** (verified at [lib/optimizer/index.ts:91](../../../lib/optimizer/index.ts)), so dropping it has **zero effect on optimizer reasoning** and saves one LLM call per analysis.

## Scope & decisions

- **Deterministic alerts, no model** — template strings filled from data; consistent and un-paddable. (User-confirmed.)
- **Drop `longTermNarrative` entirely** — call + field + the long-term prose UI. (User-confirmed; no reasoning impact.)
- The now-unused `ScoutVerdict` component and `buildLongTermSummary` helper are removed as cleanup.
- Empty alerts → a note, always-rendered card.

## Out of scope

- The opening brief, the This Week tab content, and the deterministic scoring/optimizer decisions (untouched).
- Any new LLM alerting — alerts stay deterministic.
