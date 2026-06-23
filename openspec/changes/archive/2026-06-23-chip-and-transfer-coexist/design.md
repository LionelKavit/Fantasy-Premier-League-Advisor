## Context

The committed `OptimizerResult` holds two independent things: `primaryRecommendation` (the normal free-transfer call) and `chipPlan` (per-chip play-now/window/hold). A play-now chip may or may not carry a `draft`:

- **Wildcard / Free Hit** — `draft` is the chip's transfer set (the chip *is* a bulk transfer move).
- **Bench Boost / Triple Captain** — `draft: null` (these chips don't transfer; you still make your normal free transfer).

Today the verdict and This Week branch on "is there a play-now chip?" and render only the chip + its draft, dropping `primaryRecommendation`. The brief instead reads `primaryRecommendation` and the chip separately, so it shows both — the correct, complete plan.

## Goals / Non-Goals

**Goals:**
- This Week + verdict show the normal transfer alongside a draftless play-now chip, matching the brief.
- Transfer chips (WC/FH) keep showing their draft alone (no change).
- One discriminator, applied consistently in both surfaces.

**Non-Goals:**
- Changing how the optimizer/orchestrator decide the transfer or the chip.
- Touching the brief (already correct).
- Any new data on the plan.

## Decisions

**1. Discriminator: "does the play-now chip carry transfers?"**
A chip is a *transfer chip* iff its `draft` is non-null and non-empty. This drives both surfaces. *Alternative:* hardcode by chip name (BB/TC) — rejected; keying off `draft` is robust to future chips and matches what the panels actually render.

**2. This Week → four separate sections.**
Render in order: **Transfer**, **Captaincy**, **Chip** (only when a play-now chip exists), **Restructure**. Captaincy moves above Restructure; the chip gets its own section instead of being crammed into Transfer.
- **Transfer section (always):** the week's actual transfers — `activeChip.draft` when the play-now chip is a transfer chip (WC/FH), otherwise `primaryRecommendation` (move / roll / hit). Rendered with the existing `groupTransferMoves` + `TransferLine` (and the hit verdict / data-notice as today). Never shows a chip announcement.
- **Chip section (conditional):** announces "Play your {chip}" with a **one-line** reason (the chip's `reason`, clamped to a single line — e.g. `line-clamp-1`/truncate). No transfer pills (the transfers, if any, are in the Transfer section).
*Alternative:* keep the chip inside Transfer and append the move — rejected; the user wants the chip and transfer in distinct sections and a Transfer section that always exists.

**3. Verdict (`buildVerdict`): transfer · captain · chip, splitting move and chip when draftless.**
- Drafted play-now chip (WC/FH) → `transfer = "Play your {chip}"`, `chip = ""` (the draft is the transfer; can't list it in one line).
- Draftless play-now chip with a concrete move → `transfer = "{out} → {in}"`, `chip = "Play your {chip}"` → "João Pedro → Watkins · Captain Haaland · Play your Bench Boost".
- Draftless play-now chip with a roll/no move → `transfer = "Roll your transfer"`, `chip = "Play your {chip}"`.
Reuses the existing three-segment layout; no `VerdictBar` change.

**4. Consistency.**
The Transfer-section content rule and the verdict rule both key off `draft`, mirroring how the brief reads `primaryRecommendation` + chip separately — so verdict, This Week, and brief agree.

## Risks / Trade-offs

- **Double-counting worry:** showing both a chip and a transfer could read as "two moves". → They *are* two separate, simultaneous actions (play BB + make your free transfer); the brief already frames them together, and labels ("Play your Bench Boost" vs the move pills) keep them distinct.
- **Wildcard/Free Hit regressions:** guarded by the draft check — drafted chips are untouched.
- **Edge: a draftless chip with a hit recommendation** (−4). → The move segment shows the hit's transfers as normal; the hit verdict line in This Week is unaffected.

## Migration Plan

Presentation-only: two functions touched (`buildVerdict`, the This Week `activeChip` branch). No data/route/pipeline change. Rollback = revert.

## Open Questions

- Verdict segment order when both a move and a chip show — leaning transfer · captain · chip (existing order), so it reads "move · captain · chip". Resolve in build; no spec impact.
