## Tasks

> Prompt + presentation only. Live verification needs the valid `ANTHROPIC_API_KEY` (now configured).

### Task 1: Markdown renderer
**Capability:** scout-chat-formatting
**Files:** `components/ui/Markdown.tsx` (new), `components/panel/AskTheScout.tsx`, `package.json`

- Add `react-markdown` + `remark-gfm`. Build `<Markdown>` with a compact, dark-bubble tailwind component map (semibold `strong`, tight `p`, compact `ul/ol/li`, inline `code`, cyan `a`).
- Render assistant bubbles through `<Markdown>`; keep user bubbles plain text.

### Task 2: Scout instruction module + formatting rules
**Capability:** scout-chat-formatting
**Files:** `lib/scout/system-prompt.ts` (new), `lib/scout/chat.ts`

- Extract `buildSystemPrompt` into `lib/scout/system-prompt.ts`.
- Add output-format rules: concise prose + short bullet lists, **no Markdown tables**, light bold for key figures only, complement (don't restate) the on-screen panels.

### Task 3: Separate interim reasoning from the final answer
**Capability:** scout-chat-formatting
**File:** `components/panel/AskTheScout.tsx` (and `lib/scout/chat.ts` if needed)

- Ensure tool-preamble text doesn't concatenate into the committed answer — suppress/subordinate it during tool rounds; keep the tool-status chip for progress.

### Task 4: Verdict = insight, not summary
**Capability:** scout-verdict
**Files:** `lib/optimizer/synthesis.ts`, `lib/optimizer/long-term-synthesis.ts`

- Rework the `narrativeSummary` / `hitVerdict.reasoning` / long-term prompts to explain the reasoning and non-obvious context rather than re-listing the structurally-shown recommendation. 2–4 sentences, complementary. Leave deterministic fallbacks untouched.

### Task 5: Tests + verify — ✅ Done
- [x] `ask.test.ts`: system prompt carries the new formatting rules (no-tables + complement-panels), asserted via the `llm.stream` spy. `client/ask.test.ts` updated to encode preamble-drop.
- [x] `npx tsc --noEmit`, `eslint .` (0 errors), `next build`, `vitest` (177 tests) clean.
- [x] Browser (live key): chat answer renders as prose + a real `<ul>` with `<strong>` bold, **zero** literal `**` / table pipes; interim "Let me check…" preamble no longer merges into the answer; Scout's Verdict reads as insight ("Wilson's edge over Gibbs-White is subtle but real… frees up £1.5m") rather than a panel restatement.

#### As-built notes
- Tasks 1–4 done as specced. Markdown renderer = `react-markdown` + `remark-gfm` with a compact dark-bubble component map; assistant bubbles render through it, user bubbles stay plain.
- Interim-text drop implemented at two seams: `lib/client/ask.ts` resets the accumulated answer on a `tool` event (committed message = post-tool answer only), and `AskTheScout` clears the live streaming buffer on `onTool`.
- System prompt extracted to `lib/scout/system-prompt.ts` (`buildScoutSystemPrompt`).
