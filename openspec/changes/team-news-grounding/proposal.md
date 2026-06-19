# Team-news grounding — turn the neutral-LLM floor into real rotation/injury signals

## Why
The pipeline already has the right slots — `LlmContextSignals` carries `rotationRisk`, `injurySeverity`, `oopBonus`, `opponentKeyAbsence` — and `batchComputeLlmContext` already calls an LLM to fill them. But the **only news it feeds the model is FPL's one-line `availability.news` field** (e.g. `"Knock - 75% chance"`) plus form/xG. So the signals are the LLM guessing from a status string and its training cutoff — which is exactly the "neutral/weak LLM" condition our evaluations measured as the **deterministic floor** (captain +18 vs a far higher achievable ceiling).

The recurring expert insight is that rotation/availability is the #1 thing point models underweight: *"a player with 6.0 xPts who only has a 60% chance of starting is really worth 3.6."* Grounding `batchComputeLlmContext` in **real predicted-lineup + press-conference data** is the highest-ROI LLM upgrade and the honest path from the floor to the full pipeline.

## What changes
- **`team-news-grounding`** — a fetch → LLM-extract → cache layer that produces **structured** per-team/per-player news, injected into `batchComputeLlmContext` before its prompt:
  - Fetch the current gameweek's page from **AllAboutFPL** (free, text-based predicted XIs + injuries + press-conference quotes) via a per-source adapter (no API exists; HTML → text). FFHub (membership-gated) and FFScout (image-based lineups) were **evaluated and excluded** — neither yields usable public text. The adapter pattern keeps adding sources cheap later.
  - An **extraction** LLM pass converts that free text into a typed contract: per player `{ startProbability, status, note, sourceUrl }`, matched to FPL player IDs.
  - Cache it per gameweek (TTL, mirroring the existing context cache).
  - `batchComputeLlmContext` adds each player's `teamNews` to its context, and **anchors `rotationRisk` on `startProbability`** when present (deriving it deterministically) while the LLM still reasons the nuanced signals with the real note text.

## Impact
- Runtime change (`lib/pipeline/llm-context.ts` + a new fetch/extract/cache module). Adds one **cached** extraction LLM call per gameweek; the per-request signal call is unchanged.
- **Graceful degradation:** if the fetch/extract fails or a player has no news, behavior falls back to today's (FPL `news` field only) — scoring never breaks.
- **Measurable:** `squad-eval-captain-live` quantifies the lift (grounded full pipeline vs the neutral-LLM floor).

## Security
Fetched web content is **untrusted data, not instructions.** The extraction prompt MUST treat page text as data only — extract facts, ignore any embedded instructions/claims — and the extractor's output is constrained to the typed contract. No fetched content can change app behavior beyond populating the news fields.

## Out of scope
- Scheduling cadence of the fetch (cron / manual — chosen by the user, like `squad-eval-captain-live`).
- Sources beyond predicted-lineups/press-conferences; paid APIs.

## Depends on / relates to
Sharpens `new-season-readiness` item 1 (grounded rotation helps most at cold-start), and is measured by `squad-eval-captain-live`.
