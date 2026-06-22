# Design

## Context

After `chip-single-source-of-truth`, `chipPlan` is the single authority and the deterministic generator emits `window`/`hold` entries (never `play-now`). After `chip-candidate-windows`, those windows are sound. What's missing is the judgment that turns candidate windows into a *sequenced plan with a this-week decision* — the LLM's job, grounded in `chips.md`.

The two-layer insight from the design discussion: an LLM cannot orchestrate chips alone (it would invent Doubles/Blanks). It must reason over a **deterministic facts layer**. That layer already exists as the candidate windows + chip state + fixture flags.

## Key Decisions

### 1. Single-shot, grounded, structured (Option B)
One `llm.complete` call: `system = SCOUT_PERSONA + chips.md`; `prompt` = the candidate windows, chip state (which chips, which half, expiry deadlines), and the relevant fixture facts. Output is a structured plan keyed to the **provided** windows — the model selects/sequences among them and may set at most one to `play-now` at the current gameweek. It may not name a gameweek that wasn't offered (grounding guard).

### 2. Output is the single `chipPlan`
The orchestrator's structured result *becomes* `chipPlan` (refining the deterministic windows with decisions + reasoning). Both tabs read it. This is where the model's sequencing finally counts (the trace's "discarded `raw.chipPlan`" is fixed).

### 3. N2: LLM-gates the This Week activation
This Week surfaces a chip iff `chipPlan` has `play-now` at `currentGw` — which only the orchestrator can set. The orchestrator attaches the chip's `draft` (the wildcard/free-hit squad, the canonical one from `chip-single-source-of-truth`) so This Week renders the move. FREE_HIT's draft is a one-week XI.

### 4. Keyless degradation preserves the invariant
No key → skip the orchestrator → `chipPlan` = the deterministic candidate windows (all `window`/`hold`, no `play-now`) → This Week shows no chip; the Chips tab shows the windows with templated reasons + an "AI reasoning offline" badge (reuse the verdict card's existing offline pattern). The invariant — both tabs read `chipPlan` — holds identically with or without a key.

### 5. Cadence + grounding guards
Cached per `team:gw` (like insights). Bounded `max_tokens`. The prompt forbids inventing fixtures/Doubles; the parser drops any `play-now`/sequence gameweek not present in the provided windows (defense-in-depth against hallucination). Sparse/non-backtestable → present as reasoned guidance, not prediction.

## Pipeline ordering
Facts + candidate windows (deterministic) → **orchestrator decides** (LLM, grounded) → `chipPlan` (single source) → This Week derives its `play-now`@currentGw slice; Chips tab renders the whole plan. (Chips become upstream of the weekly framing, as the trace recommended.)

## Files (indicative)
```
lib/optimizer/chip-orchestrator.ts   // (new) build grounding facts + the chips.md-grounded synthesis → structured chipPlan
lib/optimizer/index.ts                // run the orchestrator over the candidate windows; keyless → pass windows through
lib/knowledge/chips.md (reuse)        // now a live grounding input again
components/panel/ChipsDetail.tsx        // render reasoning; "AI reasoning offline" badge when keyless
lib/__tests__/optimizer/chip-orchestrator.test.ts  // (new)
```

## Tests
- Grounded: the prompt carries `chips.md` + the candidate windows; the orchestrator may set `play-now` only on a provided window; a hallucinated gameweek is dropped.
- N2: with the orchestrator, a `play-now`@currentGw flows to a This Week activation; keyless (no key) → no `play-now`, This Week shows no chip, Chips shows windows + offline badge.
- Single source: both tabs read the orchestrator's `chipPlan`; the model's sequencing is no longer discarded.
- Caching: repeated calls for the same `team:gw` reuse the result.
