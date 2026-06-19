## Tasks — transfer replay on real 2025-26 squads (FPL API)

> Follow-up to `squad-eval-captain-replay`; reuses its fetch/cache + point-in-time reconstruction. Offline only, no runtime change. FPL API end-to-end; no vaastav, no `xP`.

### Task 0: Fetch + cache transfer/budget data (TIME-SENSITIVE)
**Capability:** transfer-replay
- Fetch `entry/{id}/transfers/` (actual transfers: in/out/event/cost/time).
- Capture `entry_history.bank`, `event_transfers`, `event_transfers_cost` from the (already-cached) per-GW picks.
- Cache raw responses under `research/squad-eval/cache/`.

### Task 1: Reconstruct budget + free-transfer state
**Capability:** transfer-replay
- Bank: exact from `entry_history.bank`. Free transfers: infer from `event_transfers` history under standard FPL rules (document the approximation).

### Task 2: Optimizer replay
**Capability:** transfer-replay
- Run the app's real optimizer (`lib/optimizer/single-transfer`, `horizon`) on the manager's reconstructed real 15 + bank, point-in-time (rounds `< N`), neutral LLM, `ep_next` absent. Capture the recommended (out, in) per GW.

### Task 3: Metrics + report
**Capability:** transfer-replay
- Counterfactual gain: recommended `in − out` realized over next-1 and next-3 GWs vs holding, hit-adjusted.
- Head-to-head vs the manager's actual transfers: win/tie/loss + net season delta; plus "no-op accuracy".
- State the FT-inference, ep-absent, and neutral-LLM caveats.

### Task 4: Verify
- Committed report under `research/squad-eval/transfer-report.md`.
- App gate stays clean; harness + cache excluded from the build.

---

## As-built outcome (run 2026-06-19)

**Implemented** (FPL API end-to-end; no vaastav, no xP):
- `research/squad-eval/fetch-universe.ts` — cached the full 841-player universe + `entry/{id}/transfers/` (the optimizer scans every player for the best affordable upgrade).
- `research/squad-eval/reconstruct.ts` — shared point-in-time reconstruction extracted from the captain `replay.ts` (refactored to import it; output verified identical). Both harnesses now agree by construction.
- `research/squad-eval/transfer-replay.ts` — at each GW G it holds the squad as picked for G-1, reconstructs the squad + universe point-in-time (rounds `< G`), runs the real optimizer (`rankSquad` → `identifyWeakest3` → `findCandidates` → `buildValidTransfers` → `evaluateSingleTransfer`), and scores realized `in − out` over next-1/next-3 vs holding and vs the manager's actual transfers.

**Simplification vs the spec:** dropped fragile free-transfer inference. Manager hit costs are taken **exactly** from `event_transfers_cost`; the app's single transfer assumes one free transfer (the standard case). Cleaner and more honest than inferring FT state.

**Result (decisions for GW4-38, 35 points) — a clear NEGATIVE finding:**
- The app recommended a transfer in **34/35** GWs (held once); the manager transferred in 16/35. **The optimizer is far too transfer-happy** — it has almost no "hold" bias.
- Counterfactual gain vs holding: **App −0.34 (next-1) / −0.46 (next-3)** — its recommended transfers slightly *lost* points. Manager's actual transfers: **+3.49 / +5.83**.
- Head-to-head (next-3): app **11W / 1T / 23L**, net **−220 pts** over the season. No-op accuracy 0/2.

**Interpretation + caveat:** this is the **deterministic floor** — `ep_next` (the dominant signal) is absent, so the optimizer ranks on the known-weak ~0.33 composite, and trend/LLM are neutral. Two real signals emerge regardless of the floor: (1) the optimizer lacks a transfer-vs-hold threshold (recommends a move almost every week), and (2) optimizing the *weakest* slot often means bench→bench swaps that realize ~0. The full-pipeline judgment needs the forward eval (`squad-eval-captain-live` pattern, extended to transfers); but the **transfer-happiness is a runtime-logic finding worth acting on independent of `ep_next`.**
