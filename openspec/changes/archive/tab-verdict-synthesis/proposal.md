# Tab-Verdict Synthesis (Change A)

## Why

The two-tab UI shows an LLM-written verdict on the left for **This Week** (`transfers.narrativeSummary`), but the **Long Term** tab's prose is a deterministic client-side summary — readable, but not the AI's strategic reasoning. This change adds a genuine **LLM-written long-term verdict** (horizon timing + chip sequencing + restructure planning) and lightly refines the This-Week verdict to weave in the restructure/hit reasoning. Per the design discussion, the two verdicts are produced as **two separate synthesis calls**.

This is the smaller, independently-shippable half of the verdict work (Change B is the agentic "Ask The Scout" chat). It degrades gracefully: if the LLM is unavailable, the existing deterministic summary remains the fallback, so nothing regresses offline.

## What Changes

- **New capability `long-term-verdict`** — a new `synthesizeLongTerm` synthesis (run **in parallel** with the weekly synthesis inside the optimizer stage) produces `longTermNarrative` from `horizon` + `chipPlan` + `restructureOptions` + `chipsRemaining` + the risk profile. Added to `OptimizerResult` as `longTermNarrative: string | null`. Fail-safe → `null`. Also a light refinement of the **This-Week** synthesis prompt so the weekly narrative explicitly references restructure and hit reasoning (the data is already in its input).
- **New capability `verdict-rendering`** — the Long-Term tab's left prose prefers `longTermNarrative` when present and **falls back to the existing deterministic `buildLongTermSummary`** when it's `null` (offline/empty). This-Week rendering is unchanged.

## Scope & decisions

- **Two separate LLM calls** (weekly + long-term), run concurrently — modular and individually meaningful, per the chosen design.
- **`longTermNarrative` is plain prose**, not JSON — the response text is used directly; `null` on failure.
- **Deterministic summary stays** as the offline fallback (no behavior loss without a key).
- **`@anthropic-ai/sdk` adoption is deferred to Change B** (it's only needed for tool-use/streaming). Change A reuses the existing raw-`fetch` synthesis pattern — this keeps the change small and leaves the current global-`fetch` test mock intact. *(This is a deliberate refinement of the earlier consolidation, which had folded the SDK migration into Change A.)*
- Both verdicts need a live `ANTHROPIC_API_KEY` to produce real prose; without it, This-Week shows its existing fail-safe text and Long-Term uses the deterministic summary.
- Out of scope: tool use, simulation, chat — all Change B.
