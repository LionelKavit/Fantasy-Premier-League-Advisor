## Why

Pocket Scout has no one-second, always-visible verdict: the week's decision lives as prose in the chat or behind a collapsed drawer. A manager who doesn't want to read the brief has nothing to scan. The decision *is* the product — it should be readable in a glance, above the fold, and correct from the instant the pitch paints. This change also gives that bar the primary "Open FPL Transfers" handoff so the glanceable decision sits next to the action that executes it.

(Split out from the former `last-mile-actionability` proposal, which is superseded by this change and `player-detail-dialog`.)

## What Changes

- **Glanceable verdict bar** — a full-width bar spanning the pitch and chat columns, above the fold, showing a one-line verdict (e.g. *"This week: João Pedro → Saka · Captain Haaland · Hold your chips"*). It reflects only the final decision from the insights phase (optimizer transfer + LLM-refined captain) — never the provisional base armband — showing a placeholder while insights compute so a shown captain/transfer never swaps mid-flight.
- **FPL transfers handoff** — the bar hosts an "Open FPL Transfers" action linking to `https://fantasy.premierleague.com/transfers` (new tab), landing the manager on the screen where the move is executed. FPL has no public *write* API and the transfers URL takes no parameters, so this is an honest jump to the execution screen — not auto-execute, not pre-fill.

No breaking changes. Both surfaces degrade gracefully: the bar shows a placeholder until insights are ready (then the final verdict), and the deep link is available as soon as a plan loads (including keyless mode, where the deterministic optimizer/captain still produce a final verdict and only the LLM prose falls back).

## Capabilities

### New Capabilities
- `glanceable-verdict`: A single always-visible, above-the-fold verdict bar summarising the week's decision (transfer, captain, chip), derived deterministically and kept in sync with refined captaincy, hosting the "Open FPL Transfers" handoff.

### Modified Capabilities
<!-- None — new surface only; no existing pipeline/optimizer requirements change. -->

## Impact

- **UI**: new full-width `components/panel/VerdictBar.tsx`, rendered in `app/page.tsx` directly under `Header`, above the pitch/conversation grid.
- **Client libs**: `lib/client/moves.ts` (`buildVerdict` from a `GameweekPlan`, reusing `groupTransferMoves`); `lib/client/fpl-links.ts` (initially just `FPL_TRANSFERS_URL`; the `player-detail-dialog` change extends it with `plPlayerUrl`/`slugify`).
- **Data**: relies only on existing `GameweekPlan` fields (`transfers`, `captaincy`, `chipsRemaining`). No API, route, or pipeline changes.
- **Dependencies**: none new (link is a plain anchor).
