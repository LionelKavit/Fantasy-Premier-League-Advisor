# Design — docs as a product pitch

## The story arc (README)
Pitch it the way a PM would to an FPL player, in this order:

1. **The pain (open here).** Every gameweek the same dread: one transfer, a captain pick, a chip you're
   scared to waste — and the deadline ticking. So you crowd-source it: group chats, Reddit, ten tabs of
   contradictory "templates," none of which know *your* squad, your bank, your free transfers, or your
   chips. You make the call on a hunch and find out on Saturday.
2. **The promise.** Pocket Scout is your **personal scout**: enter your manager ID and it reads *your*
   team and tells you the highest-leverage move this week — transfers, captain, chips — and **explains
   why**, like a pundit breaking down a game. It's **personalized** (your squad, your bank, the exact
   number of free transfers you're holding), **educated** (grounded in expert FPL principles and the live
   rules), and **deterministic** (the maths is reproducible — same squad, same answer — not an LLM
   guessing).
3. **How it's different (the wedge).** Three things generic tools don't do:
   - **It knows your constraints.** Tell it you have 0–5 free transfers; it plans *within that budget* —
     up to N stacked moves, or a sell-to-fund-a-dream **restructure** when that's the smarter play — and
     **banks** a transfer rather than burn it on a marginal move.
   - **It holds when holding is right.** Every move is judged in **expected points**; if nothing clears the
     bar it tells you to roll — the opposite of the churn most tools encourage.
   - **It shows its work.** A deterministic 0–10 model does the maths; the Scout chat fetches *real* numbers
     via tools, so it never invents a stat or contradicts the panels.
4. **The proof.** Eval-first: fit-from-data ranking (~0.33 → ~0.53), a replay that caught the optimizer
   over-recommending (→ the hold gate), and a measured **no-ship**. Link `EVALUATION.md`.
5. **Try it.** Quickstart + "Explore without a team."

Keep the existing voice (Pocket Scout, pundit's eye) and the architecture-at-a-glance mermaid; the change
is the **framing and the lead**, plus correctness.

## Factual updates (reflect the final branch state)
- **Free transfers.** Everywhere that says a 1-or-2 toggle → **a 0–5 field** ("tell it how many free
  transfers you actually have"). The recommendation is **up to N stacked free moves** ("Make N free
  transfers"), not a single move.
- **Restructure.** Recast from a composite "net" to **expected points**, and note it's now **chosen by the
  allocator** — a restructure enters the primary plan when its ep beats straight swaps; otherwise it's
  listed as an alternative, priced against the **free transfers remaining** after the recommended moves.
- **ARCHITECTURE.md** optimizer section (`~line 48`): describe the **optimal free-transfer allocation**
  (swaps cost 1, restructures cost 2; max expected-points-net-of-banking within the FT budget; feasibility
  for bank/3-per-club/distinct players) replacing "ranks candidate transfers … also computes restructure
  chains". Cache key note already reads `…:freeTransfers:…` — clarify FT is 0–5.
- **EVALUATION.md**: keep the hold-gate story; add a line that the same ep bar now governs **multi-move
  allocation and restructures** (one consistent expected-points currency). Update the test count.
- **Test count**: README "Vitest (NNN tests)" → current (**331**).

## Screenshots (supplied by the user)
Capture on one manager, same viewport as the existing GW38 set, ideally with **3+ free transfers** so the
multi-move story shows. New/updated files (referenced as placeholders until supplied):
- `fpl-advisor-hero.png` (**update**) — landing: verdict bar showing a multi-move summary
  ("… +N more transfers"), the **FT field** with a value like 3, pitch + Ask The Scout.
- `fpl-advisor-this-week.png` (**update**) — This Week with **"Make N free transfers"** (several
  out→in lines) + Captaincy + Chip + the **Restructure** row reading "net pts gain +X · −N pts".
- `fpl-advisor-free-transfers.png` (**new**) — close-up of the Header **0–5 free-transfer field**, ideally
  showing the inline "Enter a value between 0 and 5" guard (the personalization + guardrail beat).
- `fpl-advisor-demo-mode.png` — still the outstanding placeholder (Explore-without-a-team view).

The rest of the set (chat-continued, player-dialog, chips, long-term, login) is reusable as-is.

## Note
Docs-only; no behaviour changes. The screenshots are the only blocker to a fully-final README, so the
implementation lands the prose with placeholders and a clear "supply these" list.
