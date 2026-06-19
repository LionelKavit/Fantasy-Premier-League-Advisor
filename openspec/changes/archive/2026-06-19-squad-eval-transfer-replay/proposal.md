# Transfer replay — would the app's transfer advice have beaten the manager's own?

## Why
`squad-eval-captain-replay` replays the **captain** decision on the manager's real 2025-26 squads. The other high-stakes squad-relative decision is **transfers**: which of *your 15* to sell, for whom. This change extends the same harness to replay the app's **transfer optimizer** against the manager's actual 2025-26 transfer history and score it by realized points.

This is the messier of the two decisions (it has budget/free-transfer state and counterfactual rollout), which is why it's split out as a follow-up rather than bundled into `squad-eval-captain-replay`.

## What changes
- **`transfer-replay`** — extends the `squad-eval-captain-replay` harness (under `research/`, **no runtime change**) to, for each gameweek of 2025-26:
  - Reconstruct the manager's real 15 + **bank** (and an approximated **free-transfer** count) at that GW.
  - Run the app's real transfer optimizer (`lib/optimizer/*` — `single-transfer`, `horizon`) on that squad.
  - Score the recommended transfer two ways: **counterfactual gain** (recommended `in − out` realized points over the next 1 and 3 GWs vs. holding) and **head-to-head** vs the manager's **actual** transfer that GW.

## Scope decisions (inherited from `squad-eval-captain-replay`)
- **FPL API end-to-end. No vaastav. No `xP`.** 2025-26 only. The optimizer runs with `ep_next` absent and neutral LLM (same deterministic + model-projection caveat).

## Impact
- Offline tooling only; app gate stays clean.
- New data source: `entry/{id}/transfers/` (the manager's actual transfers) + `entry_history.bank` from the cached picks. Same time-sensitive 2025-26 window — cache now.
- **Modeling approximation:** free-transfer count (rolls, hits) isn't directly exposed and must be inferred from the transfer/pick history; documented as a caveat.

## Out of scope
- Chip strategy optimization (Wildcard/Free Hit timing) — only single/standard transfers are replayed.
- Captaincy (that's `squad-eval-captain-replay`).

## Depends on
`squad-eval-captain-replay` — its fetch/cache layer and point-in-time reconstruction are reused; this change adds the transfers endpoint, bank/FT-state reconstruction, and the transfer metrics.
