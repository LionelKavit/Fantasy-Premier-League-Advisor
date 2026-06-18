# Design

## Context
Two surfaces produce natural-language output: the **Ask The Scout chat** (agentic, streamed) and the **Scout's Verdict** (synthesis prose, left column). Both now run on a live key, exposing formatting + value problems. Fixes are prompt-level + presentation-level; the pipeline, tools, and streaming transport are untouched.

## Key Decisions

### 1. Render a constrained Markdown subset in the chat
Add `components/ui/Markdown.tsx` wrapping `react-markdown` (+ `remark-gfm`) with a **tailwind component map** styled for a narrow dark bubble: tight paragraph spacing, `strong` → semibold, `ul/ol/li` → compact lists, inline `code`, `a` → cyan links. Assistant bubbles render through it; **user bubbles stay plain text** (echoing what they typed). Rationale: nothing ever shows raw markup, and a stray table degrades to a real (compact) table rather than literal pipes.
- Trade-off considered: a minimal in-house parser (no dep) vs `react-markdown`. Chose `react-markdown` for robustness against whatever the model emits; the component map keeps it compact and on-brand. (`react-markdown` + `remark-gfm` are the only new deps.)

### 2. Steer the model with a real instruction module
Extract `buildSystemPrompt` out of `lib/scout/chat.ts` into **`lib/scout/system-prompt.ts`** — a single, legible "instruction file." Add an **output-format section**:
- Concise prose; **short bullet lists** are fine; **no Markdown tables** (they don't fit the column).
- **Light bold** for key figures only — don't sprinkle `**` everywhere.
- **Complement the panels, don't restate them**: the user can already see the squad, transfer, and captaincy chips — answer the actual question and add the *why*, not a data dump.

This pairs with decision #1: the prompt prefers prose/bullets, the renderer formats whatever arrives.

### 3. Separate interim reasoning from the final answer
The always-stream loop forwards every round's text, so tool-preamble ("Let me check…") concatenates with the final answer. Fix at the seam: when a tool round occurs, the client treats the pre-tool text as **transient** — it is shown subordinately (or cleared) once tools run, so the committed bubble holds only the final answer. Minimal version: insert a separator between rounds and/or drop a round's text if that round called tools. Recommended: **suppress tool-preamble text in the committed message**, keep the tool-status chip for progress.

### 4. Verdict = insight, not summary
Rework two prompts so the verdict adds what the panel can't show:
- `lib/optimizer/synthesis.ts` (`narrativeSummary` + `hitVerdict.reasoning`) and `lib/optimizer/long-term-synthesis.ts`.
- New instruction: **do not re-list** the recommended transfer / restructure / captain (already shown as chips/rows). Instead cover the **reasoning and non-obvious context** — why this option beats the alternatives, the key trade-off or risk, timing, form-vs-underlying or fixture/ownership nuance, and what to watch. Keep it 2–4 sentences and complementary.
- Deterministic fallbacks (`buildLongTermSummary`, fail-safe `narrativeSummary`) stay as-is (offline safety net); this is about the LLM path.

## Files (indicative)
```
components/ui/Markdown.tsx          // new — constrained markdown renderer
components/panel/AskTheScout.tsx    // assistant bubble renders Markdown; interim text handling
lib/scout/system-prompt.ts          // new — extracted + expanded instruction module
lib/scout/chat.ts                   // import the prompt module
lib/optimizer/synthesis.ts          // narrative = insight, not restatement
lib/optimizer/long-term-synthesis.ts// same, long-term
package.json                        // + react-markdown, remark-gfm
```

## Testing
- `lib/__tests__/scout/ask.test.ts`: assert the system prompt now carries the formatting rules (no-tables / complement-panels) — captured via the `llm.stream` spy.
- Markdown component: lightweight render check is hard in the node test env (no jsdom); rely on `tsc`/`build` + manual browser verification.
- Verdict prompt changes are eval/manual — verified live in the browser (chat formatting + a verdict that reads as insight, not a panel echo).

## Risks
- `react-markdown` styling drift on dark bg — mitigated by an explicit component map + browser check.
- "Insight not summary" is a soft, prompt-driven goal — judged by live review, not a unit assertion.
