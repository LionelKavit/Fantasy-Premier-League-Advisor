# Design — shared Pocket Scout persona

## Current state
- `llm.complete({ prompt, maxTokens, system?, model? })` already supports a `system` instruction.
- **Synthesis calls** (`captain/synthesis.ts`, `optimizer/synthesis.ts`, `optimizer/long-term-synthesis.ts`) bake their role into the prompt text ("You are an FPL … advisor…") and pass **no** `system`.
- **Scout chat** (`scout/chat.ts`) already passes a `system` built by `buildScoutSystemPrompt` (tool-use rules).
- **Team-news extraction** (`pipeline/llm-context.ts`) has its own literal-extraction `system` — left untouched.

## The persona module
`lib/llm/persona.ts` exports `SCOUT_PERSONA` — the approved identity text (Pocket Scout; Premier League post-match pundit voice; the six operating principles incl. "never invent numbers / if a number isn't given, say so" and "respect the task's output format"). It is identity + voice + principles only — **no task or format specifics** (those stay in each call's prompt).

## Wiring (per call)
- **captain / transfer / long-term syntheses:** pass `system: SCOUT_PERSONA` to `llm.complete(...)`, and strip the "You are an FPL X advisor" opener from the prompt string (leave the task, data, and format instructions). The transfer synthesis still says "Output JSON only"; the persona's "respect the output format" reinforces it.
- **Scout chat:** compose — prepend `SCOUT_PERSONA` to the existing `buildScoutSystemPrompt` output so the agent shares the identity while keeping its tool rules ("call the tools for real numbers" — which the persona's "never invent numbers" reinforces).
- **Extraction call:** unchanged.

## How it composes with existing layers
Persona (who it is) + per-call task (what to do now) + knowledge files (chips.md / rank-strategy.md domain principles) + the data payload. Clean separation: identity vs task vs domain facts vs data.

## Safety / regressions
- **JSON outputs:** the only real risk is a vivid persona wrapping prose around JSON. Mitigated by (a) the persona principle "respect the exact output format," (b) the per-call "Output JSON only," and (c) the e2e flow test, which exercises synthesis parsing — it must stay green.
- **Token cost:** the persona (~200 words) prepends each of the four calls — negligible against the data payloads.
- **No behaviour change** to picks/scores — prose only.

## Validation
- Unit: `SCOUT_PERSONA` is non-empty with identity + key-principle markers; `buildScoutSystemPrompt` output contains the persona; the synthesis call sites import and pass it (assert via a shared accessor if needed). The extraction system is unchanged (assert it does NOT contain the persona).
- Qualitative smoke (live): verdict / captain / long-term / chat read in the pundit voice and still obey their formats.
- App gate: `tsc` / `eslint` / `next build` / `vitest` (esp. the e2e flow test for JSON parsing).
