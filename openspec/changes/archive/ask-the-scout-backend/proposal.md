# Ask The Scout — Backend (Change B)

## Why

This change builds the **backend brain** of "Ask The Scout": an **agentic chat API** so the manager can later ask anything in natural language ("is Saka a better buy than my Semenyo?", "what if I captain Haaland and bring in Palmer?") and get an intelligent answer — the Scout reasons over the manager's analysis and **calls tools** to fetch/score any player and simulate hypotheticals on demand.

This is backend prep only: the SDK adoption, the tool layer + simulation, and the `/api/ask` agentic endpoint. **The chat UI is a separate later change** (`ask-the-scout-ui`) that will consume this endpoint. It is gated on a live `ANTHROPIC_API_KEY` — a chat has no meaningful offline fallback, so the endpoint returns a clear "unavailable" response without a key.

## What Changes

- **New capability `sdk-adoption`** — adopt `@anthropic-ai/sdk` (we kept it for this). Migrate the existing LLM call-sites (optimizer synthesis, captain synthesis, long-term synthesis, llm-context) off raw `fetch`, and update the test mock to stub the SDK client. Behavior-preserving groundwork that the agentic loop (tool-use + streaming) needs.
- **New capability `scout-tools`** — a tool layer the Scout can call, wrapping existing pipeline functions: `get_plan` / `get_squad`, `score_player`, `search_players`, `compare_players`, and **`simulate_transfer` / `simulate_captain`** (a new lightweight-delta `lib/simulate` that validates + re-scores a hypothetical, reusing `validateTransfer` + scoring). Covers **any** FPL player.
- **New capability `ask-endpoint`** — `POST /api/ask`: an agentic loop on the SDK with **Anthropic tool-use** (function calling, *not MCP*), **streaming** the final answer, an **FPL-only** system prompt, and **cost guards** (capped tool rounds + tokens). **Multi-turn but stateless** — the client sends the message history each request; the server derives (and caches) the manager's analysis context to ground the tools.

## Scope & decisions (from the design discussion)
- **Hypothetical compute via tool use** (not reasoning-only) — the Scout can simulate moves.
- **Any FPL player** — tools can look up/score the full pool, not just the squad.
- **Multi-turn, stateless** — conversation history is client-held; no DB.
- **Lightweight-delta simulation** — validate + re-score affected players (sub-second), not a full re-plan.
- **FPL-only** — the system prompt declines off-topic questions.
- **Streaming** the reply; **cost guards** to bound tool loops/tokens.
- **Tools are Anthropic tool-use (function calling), not MCP** — local in-process functions, no external tool server.
- Out of scope: the **chat UI** (separate `ask-the-scout-ui` change), full re-plan simulation, server-persisted chat history, auth.
