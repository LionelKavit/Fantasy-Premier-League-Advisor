# Chip decisions — one source of truth

## Why

A trace of the current chip path found **two independent brains** and several latent bugs:

- **This Week's "Play your Wildcard"** is an **LLM** choice (`primaryRecommendation.type` in the transfer synthesis), while the **Chips tab timeline** is the **deterministic** `evaluateChipInteractions` output (`chipPlan`). Nothing reconciles them — they agree only by coincidence ([finding #1](../../changes/chip-orchestrator/design.md)).
- The model is even asked for a `chipPlan` in its schema, but `parseOptimizerResult` **discards `raw.chipPlan`** and uses the deterministic list ([synthesis.ts](../../../lib/optimizer/synthesis.ts)).
- **`FREE_HIT` is silently broken**: `mapTransferAction` has no `FREE_HIT` case, so it falls through to `default → ROLL`.
- **Two different wildcard drafts** exist (`chip-interaction.ts` filters `gw1Gain > 0.05`; `mapTransferAction` filters `> 0`), and the Chips engine's `alteredTransfers` is never used by This Week.
- **The no-key path can't ever play a chip** (`buildFailSafe` only returns FREE/ROLL), so This Week and Chips diverge keyless.

This change removes the dual-brain by making **one** chip plan the single source of truth that both tabs render, fixing those bugs structurally. It is **deterministic only** — the LLM orchestrator (the headline) is a later change.

## What changes

- **A unified chip-plan model.** Each chip entry carries a `status`: `"window"` (a candidate future slot), `"play-now"` (activate at the current gameweek), or `"hold"`, plus its reasoning and — for an activatable chip — its `draft` (the chip's transfer set), computed once.
- **The transfer synthesis stops electing chips.** `primaryRecommendation` is FREE / HIT / ROLL only; `WILDCARD` / `FREE_HIT` are removed from its schema and `mapTransferAction`. Whether a chip is played comes from `chipPlan`, not the weekly transfer LLM.
- **`chipPlan` is the single source.** This Week renders a chip activation **iff** `chipPlan` has a `play-now` entry at the current gameweek; the Chips tab renders the whole plan. The deterministic generator emits `window` / `hold` entries — **never `play-now`** (per the N2 decision, activation requires the orchestrator that arrives in `chip-orchestrator`). So after this change, This Week shows no chip and chips live in the Chips tab as candidate windows.
- **Bugs fixed:** one canonical wildcard/free-hit draft; `FREE_HIT` handled in the model (not the dead ROLL path); no-key and with-key paths read the same `chipPlan`.

## Scope & decisions

- **Deterministic only.** No LLM orchestrator yet; this is the N2 baseline (Chips tab shows windows; This Week never auto-activates a chip).
- **Visible change:** the current This Week "Play your Wildcard" headline moves to the Chips tab as a candidate window until the orchestrator re-adds LLM-gated activation (`chip-orchestrator`).
- The This Week ↔ Chips invariant is **key-independent**: both always read `chipPlan`.

## Out of scope

- Better deterministic triggers (`chip-candidate-windows`).
- The LLM chip orchestrator + LLM-gated activation + chips.md grounding (`chip-orchestrator`).
