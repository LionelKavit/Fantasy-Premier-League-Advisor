## Context

The committed `GameweekPlan` already carries the week's decision (`transfers.primaryRecommendation` or a play-now chip draft, `captaincy`, `chipsRemaining`). The page loads in two phases: a fast deterministic **base** (pitch + meta, `transfers`/`captaincy` null) and a slower **insights** phase that fills them in and reconciles the armband ([app/page.tsx](../../../app/page.tsx)). The verdict must be present in the base phase and update in place when insights merge into the same plan object.

## Goals / Non-Goals

**Goals:**
- A correct one-line verdict in a full-width bar above the pitch/chat grid, present from the base phase and kept in sync as captaincy refines.
- The "Open FPL Transfers" handoff hosted at the end of the bar.
- Verdict wording consistent with the This Week breakdown (no drift).

**Non-Goals:**
- The player detail dialog, clickable players, and the premierleague.com link (those are the `player-detail-dialog` change).
- Auto-executing or pre-filling transfers (no public write API / no URL params).
- Any optimizer/captain/scoring changes.

## Decisions

**1. Verdict waits for the final decision (no mid-flight swap).**
The base phase sets the captain armband from `deterministicCaptainIds`, but the insights phase runs the LLM captain synthesis and [page.tsx](../../../app/page.tsx) *overwrites* `isCaptainRec` with that refined pick — so the base captain can differ from the final one. Showing it first would visibly swap. Therefore `VerdictBar` takes a `loading` prop (the page's `insightsLoading`) and shows a placeholder ("Preparing this week's verdict…") until insights finish; only then does it call `buildVerdict(plan)`. `buildVerdict` reads `plan.transfers.primaryRecommendation` (or the play-now chip draft) and the LLM-refined `plan.captaincy` — never the squad armband — reusing `groupTransferMoves` so wording matches This Week. *Alternative:* show the deterministic base verdict immediately and refine in place — rejected; the captain swap is jarring and the base transfer/chip aren't computed yet anyway, so there is no stable partial to show. The "Open FPL Transfers" action renders in both states.

**2. Shape: a small struct, not a pre-joined string.**
`buildVerdict` returns `{ transfer: string; captain: string | null; chip: string }` so `VerdictBar` controls layout/emphasis (and the captain segment can show a "pending" affordance). *Alternative:* return one formatted string — rejected, less flexible for styling and the pending state.

**3. Placement.**
`VerdictBar` renders in `app/page.tsx` directly under `Header`, full-width above the `grid` row (outside the two-column grid so it spans both). Verdict text left; "Open FPL Transfers" anchor right (`target="_blank"`, `rel="noopener noreferrer"`).

**4. `FPL_TRANSFERS_URL` lives in `lib/client/fpl-links.ts`.**
Created here as just the constant; the `player-detail-dialog` change extends the same module with `plPlayerUrl`/`slugify`. Keeping FPL URL helpers in one module avoids scattering hardcoded URLs.

## Risks / Trade-offs

- **Verdict drift vs This Week.** → both derive from the same plan via the same `groupTransferMoves` helper, so they cannot disagree.
- **Transfers deep link can't pre-fill the move.** → labelled honestly as "Open FPL Transfers" (a jump to the execution screen), not "make this transfer".
- **Captain swap (base armband → LLM-refined).** → avoided entirely: the bar shows a placeholder until insights finish, then renders the final captain once; it never shows the provisional base armband.

## Migration Plan

Additive: one component, one new client lib (`moves.ts`) and one tiny constant module. No data migration, no env changes. Keyless mode unaffected (verdict + link both work without an API key). Rollback = revert.

## Open Questions

- Exact copy for the chip segment when no chip is played ("Hold your chips" vs "No chip") — resolved in build; no spec impact.
