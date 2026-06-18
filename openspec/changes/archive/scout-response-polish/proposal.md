# Scout response polish — readable chat output + insightful verdict

## Why
With a live key, real LLM output is now visible and two quality problems surfaced:

1. **Ask The Scout chat renders raw Markdown.** The model replies with GFM tables (`| Player | Score |`) and `**bold**`, but the bubble shows them as literal pipes and asterisks — cramped and messy in a narrow chat column. There's no instruction telling the model *how* to format for this surface, and no renderer to display Markdown.
2. **Interim tool-preamble text merges into the answer.** "Let me pull up your plan…" runs straight into the final answer with no separation.
3. **The Scout's Verdict just restates the right panel.** The left-column prose summarizes the transfer / restructure / captaincy that are *already* shown as structured chips and rows. It adds no insight beyond what's on screen.

## What changes
- **Chat formatting (capability `scout-chat-formatting`):**
  - Render a **constrained Markdown subset** (bold, italics, bullet/numbered lists, inline code, links) in assistant bubbles via a small shared `<Markdown>` component — so nothing shows raw; a stray table still renders cleanly rather than as pipes.
  - **Extract the Scout system prompt into its own module** (`lib/scout/system-prompt.ts`) — a real "instruction file" — and add formatting rules: concise prose + short bullet lists, **no Markdown tables**, light bold for key figures only, and "complement the on-screen panels, don't dump raw data."
  - Separate interim reasoning from the final answer (suppress or visually subordinate it) so the answer reads clean.
- **Verdict insight (capability `scout-verdict`):**
  - Rework the optimizer `narrativeSummary` + long-term synthesis prompts so the verdict explains the **reasoning and non-obvious context** — why this move over the alternatives, the key trade-off/risk, what the raw numbers don't show — instead of re-listing the recommendations already displayed structurally.

## Impact
- Touches `components/panel/AskTheScout.tsx`, `lib/scout/chat.ts` (+ new `lib/scout/system-prompt.ts`), `lib/optimizer/synthesis.ts`, `lib/optimizer/long-term-synthesis.ts`, and a new `components/ui/Markdown.tsx`. Adds `react-markdown` (+ `remark-gfm`).
- Prompt + presentation only — no change to the deterministic pipeline, tools, or streaming transport.

## Out of scope
- Rich/interactive chat content (charts, clickable player cards) — future.
- Changing the structured right-panel itself.
