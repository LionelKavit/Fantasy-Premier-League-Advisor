## Tasks

> Shipped via the absolute-in-a-stretched-wrapper approach (exact pitch match + no content growth). The original `self-stretch + min-h-0` plan was abandoned: the grid row is an `auto` track whose max-content sizing grows with the message list regardless of `min-h-0`.

### Task 1: Wrap the chat so the pitch sets the row height
**Capability:** ask-the-scout-ui
**File:** `app/page.tsx`

Wrap `AskTheScout` in a `lg:relative lg:self-stretch` cell and pass `className="lg:absolute lg:inset-0"`. The absolute panel contributes 0 to the cell, so the pitch sets the row height and the wrapper (and thus the panel) matches it exactly.

### Task 2: Make the panel fill the wrapper and the list scroll
**Capability:** ask-the-scout-ui
**File:** `components/panel/AskTheScout.tsx`

- Root: replace `min-h-[34rem]` with `h-[32rem] lg:h-auto` and add `overflow-hidden` (keep the merged `className` for the page's `lg:absolute lg:inset-0`).
- Message list: add `min-h-0` to the existing `flex-1 … overflow-y-auto` container so the flex child can shrink and scroll.

### Task 3: Verify
- Browser: long conversation scrolls inside the panel; pitch/breakdown/alerts don't shift as replies arrive; the panel's bottom edge aligns with the pitch on `lg`; latest reply stays in view; mobile keeps the fixed-height scroll.
- `npx tsc --noEmit`, `eslint .`, `vitest` green (no layout unit tests exist).

## Verification
A growing chat scrolls within a stable-sized panel whose height matches the pitch exactly on large screens; the rest of the page no longer reflows on each reply.
