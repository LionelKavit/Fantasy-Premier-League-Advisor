# Docs as a product pitch — tell the Pocket Scout story, at the final state of this branch

## Why
Two gaps. First, the docs predate this branch's transfer overhaul: the README/ARCHITECTURE/EVALUATION
still describe a 1-or-2 free-transfer toggle, a single-move recommendation, and a composite-scored
restructure — none of which is true now (0–5 free transfers, up to N stacked moves, and an ep-native
restructure folded into an optimal allocation). Second, the README reads as a **feature list**, not a
**pitch**. Every FPL manager feels the same weekly pain — *"is this the right move?"* — and reaches for
group chats, Reddit, and ten open tabs of conflicting takes. Pocket Scout's whole reason to exist is to be
the **personalized, evidence-grounded, deterministic scout** that answers that for *your* squad. The docs
should sell that story to an FPL player, then back it with the engineering.

## What changes
- **`docs-product-pitch`** — reframe and refresh the docs:
  1. **README as a product pitch.** Lead with the manager's pain point and the promise (a scout that knows
     *your* team, explains *why*, and never churns for the sake of it), then "how it's different"
     (deterministic maths + grounded reasoning, not vibes), then the proof. Keep it skimmable for a player,
     not just an engineer.
  2. **Reflect the final state.** Update every doc to this branch: enter **how many free transfers you
     actually have (0–5)**; the Scout recommends **up to that many stacked moves**, or a **restructure**
     (sell-to-fund-a-dream) when that out-projects straight swaps — all in **expected points**, with the
     same hold/bank discipline. Fix the stale toggle/single-move/composite-restructure copy and the test
     count.
  3. **Refresh the screenshot set** to show the new surfaces (the 0–5 free-transfer field, a multi-transfer
     "Make N free transfers" plan, the ep-native Restructure row). Screenshots are **supplied by the user**;
     the docs reference them with placeholders until they land.

## Impact
- `README.md` (the pitch), `docs/ARCHITECTURE.md` (optimizer/allocation section, cache key, FT range),
  `docs/EVALUATION.md` (transfer gate / allocation note, test count), `docs/images/README.md` (catalog).
- Docs only — **no source changes**. The product behaviour is already shipped on this branch.

## Out of scope
- Any code/behaviour change; a re-recorded demo video (noted as a follow-up, as today).

## Depends on
The shipped branch work: `free-transfer-input-range`, `free-transfer-nmove-strategy`,
`free-transfer-banking-cost-hygiene`, `restructure-ep-allocation` (all archived).
