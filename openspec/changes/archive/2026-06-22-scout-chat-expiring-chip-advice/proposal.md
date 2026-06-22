# Surface held, expiring chips to the chat — Wildcard as a free hit-alternative

## Why

Asked "should I take a hit?" on the final gameweek, the Scout correctly recommended using the two free transfers — but never mentioned that the manager holds an **expiring Wildcard**, which makes extra moves for *free* and is a strictly better alternative to a −4 hit if you want a third move. The chat can't raise it because it never receives the held chips: its grounding includes only the *scheduled* chip windows (from `scout-chat-chip-grounding`), and here the Wildcard has no window (the last-call generator only emits one when the XI is unfit). So the load-bearing fact — "you hold a Wildcard that expires at GW38" — is simply absent from the chat's context.

This is a **context** gap, not a prompting gap: a prompt instruction to "mention the Wildcard" would have nothing to act on and would invite hallucination.

## What changes

- **Feed the chat the held chips and their expiry gameweek** — server-side, from `sc.ctx.analysis.chipsRemaining` + the chip calendar (no client or payload change). This is the missing context.
- **Add one principle** to the chip guidance: a held chip is use-it-or-lose-it as its deadline nears; in particular a held Wildcard makes unlimited transfers at no points cost, so when the manager weighs a hit for extra moves and holds an (expiring) Wildcard, point out the Wildcard does it for free — while still leading with the optimal call, and not pushing to burn a chip merely to avoid losing it unless it beats the alternatives.
- **Let the LLM compose the wording** from those facts + principle (adaptive), rather than a hardcoded sentence or a deterministic rule.

## Scope & decisions

- **Context-first.** The facts (held chips + expiry) are load-bearing; the principle is a single instruction. Without the facts, the advice can't fire reliably.
- **Server-side, no client change.** `chipsRemaining` is already in the analysis context the system prompt is built from.
- **Authority preserved.** The optimal recommendation still leads (e.g. two free transfers + the expiring Bench Boost); the Wildcard-as-hit-alternative is a conditional aside, not a nudge to spend chips.
- **Distinct from `scout-chat-chip-grounding`.** That grounds the chat in the *scheduled* chip decisions (chips with windows); this adds *all held chips + their expiry* so the chat can reason about use-it-or-lose-it and hits. Both live in the same chip section of the prompt.

## Out of scope

- Changing the orchestrator's chip decisions or the chips-tab display (a separate change).
- Any client/request change — this is purely the server-built system prompt.
