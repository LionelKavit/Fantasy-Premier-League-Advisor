# Contain the chat panel — scroll inside, don't grow the page

## Why

The conversation panel grows with the chat. Its root sets only `min-h-[34rem]` with no upper bound ([AskTheScout.tsx:129](components/panel/AskTheScout.tsx)), and the page row stretches the panel to its content ([page.tsx:151–157](app/page.tsx)). The inner message list already has `flex-1 overflow-y-auto` ([AskTheScout.tsx:142](components/panel/AskTheScout.tsx)) but it never engages, because the panel has no bounded height to scroll within. As the conversation lengthens the whole layout shifts — the pitch and the panels below drift down and the page reflows on every reply, which is disorienting.

## What changes

- **Take the chat's content out of the grid row's height calculation** so it stays a stable size and the message list scrolls **inside** it instead of the page growing. On large screens the panel matches the pitch's height **exactly** (its bottom edge aligns with the pitch). On small screens it takes a fixed height.
- **Make the inner scroll actually engage** — the message list needs `min-h-0` so a flex child can shrink below its content and scroll; the panel root clips overflow so nothing spills past the rounded border.
- **No behavioural change** to the chat itself — auto-scroll-to-latest, streaming, starters, and the composer are untouched; only the panel's box is contained.

## Scope & decisions

- **Match the pitch exactly on `lg`, fixed on mobile.** Wrap the chat in a `lg:relative lg:self-stretch` cell and fill it with the panel via `lg:absolute lg:inset-0`. An absolutely-positioned child contributes **0** to the grid row, so the **pitch** sets the row height, the wrapper stretches to it, and the panel fills the wrapper — matching the pitch's height precisely while its message list can never push the row taller. Below `lg`, a fixed `h-[32rem]` gives the same internal-scroll behaviour.
- **Why not a fixed/`self-stretch` panel.** A plain `lg:self-stretch` on the panel fails: the grid row is an **`auto` track** whose max sizing function is `max-content`, so the message list still grows the row regardless of `min-h-0`. A fixed `lg:h-[Nrem]` is stable but can't match the pitch's dynamic height (it ends slightly above/below the pitch). The absolute-in-a-stretched-wrapper approach is the only CSS-only way to get **both** an exact pitch match and no content-driven growth.
- **CSS-only.** No JS height measurement, no resize observers, no new dependencies.
- **Auto-scroll preserved.** The existing `scrollIntoView` on new messages/tokens keeps the latest reply in view within the now-scrollable region.

## Out of scope

- Resizable/collapsible chat, a "scroll to bottom" affordance, or virtualised message lists.
- Any change to the brief, starters, or composer behaviour.
