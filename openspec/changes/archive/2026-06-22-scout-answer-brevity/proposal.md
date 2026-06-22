# Crisper Scout answers — lead with the verdict, cut the essays

## Why

The Scout's chat replies run long — several stacked paragraphs that bury the answer (see the captaincy exchange: the verdict is correct but arrives after multiple paragraphs of qualification). The behaviour is set by the formatting instructions in `buildScoutSystemPrompt` ([lib/scout/system-prompt.ts:25–33](lib/scout/system-prompt.ts)), which ask for "concise" prose but don't cap length or demand the answer up front. Sonnet 4.6 follows explicit instructions closely, so the fix is a tighter, more directive prompt — not code.

## What changes

- **Rewrite the "How to format your answer" guidance** to: lead with the direct answer/verdict in the first sentence; default to 2–4 sentences; treat ~90 words as the ceiling for a normal reply (expand only when the user explicitly asks to go deep); prefer one tight short list over multiple prose paragraphs when enumerating; never stack multi-paragraph essays.
- **Keep the existing rules** that already work: no Markdown tables, no headings, sparing bold, plain English, and "add the reasoning, don't restate the on-screen panels."
- **Prompt-only.** No change to tools, grounding, the agent loop, or the opening brief (the brief already enforces ≤4 sentences separately).

## Scope & decisions

- **Positive, explicit instructions over negatives.** State the target shape ("first sentence = the answer", "2–4 sentences", "one short list max") rather than only forbidding verbosity — 4.6 calibrates well to a concrete target.
- **Brevity is a default, not a hard gag.** If the user asks "walk me through…" or "explain in detail", the Scout may go longer; the cap governs the normal case.
- **Applies to the chat assistant only.** The opening brief (`lib/scout/brief.ts`) and the structured syntheses keep their own length rules.

## Out of scope

- Changing what the Scout reasons over (tools/grounding), the persona file, or the brief's instructions.
- Any UI change (the panel-containment work is a separate change).
