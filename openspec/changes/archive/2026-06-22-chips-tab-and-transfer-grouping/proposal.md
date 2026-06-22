# Chips tab + grouped transfer moves

## Why

Two small, self-contained UI cuts toward clarity (the deterministic chip *logic* is a separate, larger change):

1. **Chip strategy is buried in the Long Term tab**, sitting next to the Transfer Horizon — two unrelated decision domains crammed together. Chips are a season-long timing decision and deserve their own home so everything chip-related lives in one place.
2. **The transfer panel repeats the out-player.** Each `out → candidate` pair is its own line ([ThisWeekDetail.tsx](../../../components/panel/ThisWeekDetail.tsx)), so a Wildcard with several options per player becomes a wall — "João Pedro → Watkins", "João Pedro → Calvert-Lewin", "João Pedro → Gyökeres"… One line per out-player, with the candidates listed `A / B / C`, reads far cleaner.

## What changes

- **A dedicated Chips tab** (`strategy-tabs`). The drawer's tab set becomes **This Week | Long Term | Chips**. The **Chip strategy** block (timeline + chips-remaining + recommended windows) moves out of `LongTermDetail` into the new Chips view; **Long Term** keeps only the **Transfer Horizon**.
- **Grouped transfer moves** (`this-week-tab`). The This Week transfer section renders **one line per out-player**: `Out → cand1 / cand2 / cand3` (candidates ordered by gain, capped to the top ~3). A single free transfer is unchanged (one out, one candidate).

## Scope & decisions

- **Presentation only.** No change to chip logic (`chip-interaction.ts`) or to which transfers are computed — grouping is a display transform over the existing `primaryRecommendation.transfers`.
- **The Wildcard/Free Hit transfer *draft* stays in This Week** — it's this deadline's action; only the chip *timeline/timing* moves to the Chips tab. ("Action stays where you act; planning moves to Chips.")
- Group ordering: out-players by their best candidate's gain (desc); candidates within a line by gain (desc), capped to ~3.

## Out of scope

- Reworking the chip engine, encoding `chips.md` principles (don't-hoard/expiry, fixture-swing Wildcard trigger, sequencing), and the whole-squad Wildcard candidate set — that's the separate **B** change.
- Any change to the brief, alerts, captaincy, or the deterministic scoring.
