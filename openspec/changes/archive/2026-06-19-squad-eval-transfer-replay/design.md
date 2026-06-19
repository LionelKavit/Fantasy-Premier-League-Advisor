# Design — transfer replay on real 2025-26 squads (FPL API)

## Context
Builds directly on `squad-eval-captain-replay`: same FPL-API sourcing, same point-in-time reconstruction, same ep-absent/neutral-LLM caveats. Adds the manager's transfer history and the squad's budget state, then replays the app's optimizer and scores it by realized points.

## Additional data (beyond `squad-eval-captain-replay`'s cache)
- `entry/{id}/transfers/` — the manager's actual transfers across the season: `element_in`, `element_out`, `event`, `element_in_cost`/`element_out_cost`, `time`. Season-scoped → cache now.
- `entry/{id}/event/{gw}/picks/` → `entry_history.bank` and `entry_history.event_transfers`/`event_transfers_cost` — per-GW bank and how many transfers (and point hits) the manager actually made.

## Reconstructing budget/free-transfer state (the hard part)
- **Bank**: read directly from `entry_history.bank` per GW (exact).
- **Free transfers**: not exposed directly. Infer from `event_transfers` history (standard FPL rules: +1 FT per GW, capped; a hit costs −4). This is an **approximation** — documented, and results reported in a way that doesn't over-rely on exact FT counts (e.g. evaluate the single best transfer regardless of FT, and separately note hit-adjusted gain).

## The replay
For each GW `N`:
1. Reconstruct the manager's real 15 + bank (from `squad-eval-captain-replay`'s cache + picks).
2. Run the app's optimizer (`lib/optimizer/single-transfer`, `horizon`) on that squad — real code, neutral LLM, `ep_next` absent — to get the recommended transfer (out, in).
3. Score it:
   - **Counterfactual gain** — recommended `in` realized points − `out` realized points over the next **1** and **3** GWs, vs **holding** (0). Net of a −4 hit when the recommendation would require one.
   - **Head-to-head vs the manager** — the app's recommended-transfer realized gain vs the manager's **actual** transfer(s) that GW (also `in − out` over 1/3 GWs). Report win/tie/loss + **net season points delta**.

## Metrics (aggregated over the season)
- Mean counterfactual `in − out` over next-1 and next-3 GWs (vs hold), hit-adjusted.
- Head-to-head vs the manager: win/tie/loss rate + net season delta.
- "No-op accuracy": how often the app correctly recommends **holding** when the manager's actual transfer lost points.

## Pitfalls
- **FT/hit inference** is approximate (above) — keep the headline metric robust to it.
- **Confounding** — the manager's actual squad path already reflects their own past transfers; the counterfactual only evaluates a one-GW-ahead recommendation, not a re-simulated alternate season.
- Same time-sensitivity + ep-absent + neutral-LLM caveats as `squad-eval-captain-replay`.

## Deliverables
1. Transfers + bank fetch/cache (extending `squad-eval-captain-replay`'s cache).
2. Bank/FT-state reconstruction + optimizer replay harness.
3. A committed report: counterfactual gain + head-to-head vs the manager, with caveats stated.
