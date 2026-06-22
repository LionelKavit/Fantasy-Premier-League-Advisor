# Design

## Context

The chat lives in `AskTheScout`, a flex column: a fixed header, a `flex-1 overflow-y-auto` message list, and a fixed composer ([AskTheScout.tsx:128–220](components/panel/AskTheScout.tsx)). It sits in row 1, right cell of the page grid (`lg:grid-cols-[1fr_1.1fr]`, `items-start`), with the pitch in the left cell ([page.tsx:151–164](app/page.tsx)). The intended design (from the conversation-first work) is "chat panel matches the pitch height." That held until the chat content exceeded the pitch, at which point the panel — and the grid row — grew with it.

## Key decisions

### 1. Why the obvious fixes don't work
`overflow-y-auto` only scrolls when the element has a height smaller than its content, and a flex item's default `min-height: auto` refuses to shrink below content. So the message list needs `min-h-0` *and* the panel needs a height that isn't derived from its content. Two tempting approaches both fail:

- **`lg:self-stretch` on the panel** (stretch to the pitch-set row): the grid row is an **`auto` track**, whose *max* sizing function is `max-content`. The message list's full height feeds that max-content, so the row — and the stretched panel — grow with the conversation regardless of `min-h-0` or `overflow-hidden`. (This was the original, incorrect plan.)
- **A fixed `lg:h-[Nrem]`**: stable and scrollable, but a hard-coded height can't equal the pitch's dynamic height, so the panel ends slightly above/below the pitch's bottom edge.

### 2. Absolute panel inside a stretched wrapper (shipped)
Wrap the chat in a grid cell that stretches to the row, and take the panel out of flow inside it:

```
<div class="lg:relative lg:self-stretch">      // grid cell — stretches to the row
  <AskTheScout class="lg:absolute lg:inset-0" /> // fills the cell, contributes 0 to it
</div>
```

An **absolutely-positioned** child contributes **0** to its container's intrinsic size, so the wrapper's content height is 0 and it never inflates the `auto` row. The **pitch** therefore sets the row height; `lg:self-stretch` makes the wrapper match it; and `lg:absolute lg:inset-0` makes the panel fill the wrapper exactly. The panel now has a definite height equal to the pitch, so `flex-1 min-h-0 overflow-y-auto` on the message list resolves and scrolls. Result: **exact pitch match + no content-driven growth**, with no JS measurement.

### 3. Mobile: a fixed height
Below `lg` the grid is a single column with no pitch beside it to match, and the wrapper/panel are in normal flow (no `relative`/`absolute`). The panel keeps a fixed `h-[32rem]` (with `lg:h-auto` so `inset-0` drives the height on large screens), giving the same internal-scroll behaviour on narrow viewports.

### 4. Auto-scroll still works
The existing effect calls `bottomRef.scrollIntoView(...)` on new messages/streamed tokens ([AskTheScout.tsx:48–50](components/panel/AskTheScout.tsx)). With the list now a real scroll container, that call scrolls the list (not the page) to the latest content.

## Files
```
app/page.tsx                       // wrap AskTheScout in `lg:relative lg:self-stretch`; pass `lg:absolute lg:inset-0`
components/panel/AskTheScout.tsx   // root: h-[32rem] lg:h-auto + overflow-hidden (drop min-h-[34rem]); message list: add min-h-0
```

## Tests / verification
- Manual (browser): a long conversation scrolls inside the panel; the pitch, breakdown, and alerts don't shift as replies arrive; the panel's bottom edge aligns with the pitch on `lg`. No existing unit tests assert layout; `tsc`/`eslint`/`vitest` stay green.
