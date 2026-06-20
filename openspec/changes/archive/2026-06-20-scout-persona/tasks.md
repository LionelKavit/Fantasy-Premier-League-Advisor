## Tasks — scout persona (shared identity for the reasoning calls)

### Task 1: The persona module
**Capability:** scout-persona
- `lib/llm/persona.ts`: export `SCOUT_PERSONA` — the approved Pocket Scout identity (pundit voice + the six operating principles). Identity/voice/principles only; no task/format specifics.

### Task 2: Apply to the four reasoning calls
**Capability:** scout-persona
- `lib/captain/synthesis.ts`, `lib/optimizer/synthesis.ts`, `lib/optimizer/long-term-synthesis.ts`: pass `system: SCOUT_PERSONA` to `llm.complete(...)`; strip the "You are an FPL … advisor" opener from each prompt (keep task + data + output format).
- `lib/scout/chat.ts` / `lib/scout/system-prompt.ts`: prepend/compose `SCOUT_PERSONA` into the scout system prompt, keeping the tool-use rules.
- Leave `lib/pipeline/llm-context.ts` (extraction) untouched.

### Task 3: Verify
**Capability:** scout-persona
- Unit: `SCOUT_PERSONA` non-empty with identity + key-principle markers; `buildScoutSystemPrompt` includes it; the extraction system does NOT.
- Qualitative smoke (live): verdict / captain / long-term / chat read in the pundit voice and still obey their formats.
- App gate clean — especially the **e2e flow test** (JSON-returning syntheses still parse). Deterministic picks/scores unchanged.

### Decide
- [x] Scope: persona on the four reasoning calls; extraction excluded. Persona content approved (tunable later).

---

## As-built outcome (run 2026-06-20)

**Implemented:**
- `lib/llm/persona.ts` — exports `SCOUT_PERSONA` (the approved Pocket Scout identity: pundit voice + the six operating principles).
- Applied as `system: SCOUT_PERSONA` to the captain (`captain/synthesis.ts`), transfer (`optimizer/synthesis.ts`), and long-term (`optimizer/long-term-synthesis.ts`) syntheses, with their "You are an FPL … advisor" openers trimmed to just the task; composed into the Scout chat via `scout/system-prompt.ts` (keeping its tool-use rules).
- `pipeline/llm-context.ts` (team-news extraction) left on its literal-extraction system — excluded as designed.

**Verified:**
- Unit (+2, suite **204 pass**): persona content markers (Pocket Scout / never-invent / pundit / rank / output-format); the captain prompt no longer carries an inline "You are an FPL …" identity (moved to `system`).
- **e2e flow test green** — the JSON-returning syntheses still parse with the persona applied (the key regression risk). `tsc` / `eslint` 0 / `next build` clean.
- Prose-only: deterministic captain/transfer picks and scores unchanged. The pundit voice will show in the live verdict / captain note / long-term outlook / chat.
