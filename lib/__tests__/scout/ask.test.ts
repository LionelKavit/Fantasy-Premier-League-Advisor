import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { runScoutConversation } from "../../scout/chat";
import {
  makeScoutContext,
  toolUseMessage,
  textMessage,
} from "./helpers";
import { mockClaudeMessages, stubApiKey, clearApiKey, restoreClaude } from "../mock-claude";

// Stub the cached context builder (which would otherwise hit the FPL API);
// everything else in the context module stays real.
vi.mock("../../scout/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../scout/context")>();
  return { ...actual, getScoutContext: vi.fn() };
});
import { getScoutContext } from "../../scout/context";
import { POST } from "../../../app/api/ask/route";

afterEach(restoreClaude);

function askRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("runScoutConversation (agentic loop)", () => {
  it("returns a direct answer when the model uses no tools", async () => {
    stubApiKey();
    mockClaudeMessages([textMessage("Captain Salah this week.")]);
    const chunks: string[] = [];
    const out = await runScoutConversation({
      sc: makeScoutContext(),
      freeTransfers: 1,
      messages: [{ role: "user", content: "Who should I captain?" }],
      onText: (c) => chunks.push(c),
    });
    expect(out.text).toBe("Captain Salah this week.");
    expect(out.toolRounds).toBe(0);
    expect(out.toolCalls).toEqual([]);
    expect(chunks.join("")).toContain("Captain Salah");
  });

  it("runs a tool round, then synthesizes a final answer", async () => {
    stubApiKey();
    mockClaudeMessages([
      toolUseMessage([{ id: "t1", name: "get_plan", input: {} }]),
      textMessage("Your best move is bringing in Affordable."),
    ]);
    const out = await runScoutConversation({
      sc: makeScoutContext(),
      freeTransfers: 1,
      messages: [{ role: "user", content: "What should I do?" }],
    });
    expect(out.toolCalls).toEqual(["get_plan"]);
    expect(out.toolRounds).toBe(1);
    expect(out.text).toContain("Affordable");
  });

  it("forces a final answer when the tool-round cap is hit", async () => {
    stubApiKey();
    mockClaudeMessages([
      toolUseMessage([{ id: "t1", name: "get_plan", input: {} }]),
      toolUseMessage([{ id: "t2", name: "get_squad", input: {} }]),
      textMessage("Final synthesized answer."),
    ]);
    const out = await runScoutConversation({
      sc: makeScoutContext(),
      freeTransfers: 1,
      messages: [{ role: "user", content: "Loop please" }],
      maxToolRounds: 2,
    });
    expect(out.toolRounds).toBe(2);
    expect(out.toolCalls).toEqual(["get_plan", "get_squad"]);
    expect(out.text).toBe("Final synthesized answer."); // forced no-tools call
  });

  it("sends the client-held history and an FPL-only system prompt", async () => {
    stubApiKey();
    const spy = mockClaudeMessages([textMessage("ok")]);
    await runScoutConversation({
      sc: makeScoutContext(),
      freeTransfers: 1,
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "earlier reply" },
        { role: "user", content: "follow up" },
      ],
    });
    const call = spy.mock.calls[0][0] as { system: string; messages: { role: string; content: unknown }[]; tools: unknown[] };
    // The client-held history is forwarded verbatim as the first turns.
    expect(call.messages[0]).toMatchObject({ role: "user", content: "first" });
    expect(call.messages[1]).toMatchObject({ role: "assistant", content: "earlier reply" });
    expect(call.messages[2]).toMatchObject({ role: "user", content: "follow up" });
    expect(call.system).toMatch(/only/i);
    expect(call.system).toMatch(/fantasy premier league/i);
    expect(Array.isArray(call.tools)).toBe(true);
  });
});

describe("POST /api/ask", () => {
  it("400s when team_id is missing", async () => {
    const res = await POST(askRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(400);
  });

  it("400s when messages do not end with a user turn", async () => {
    const res = await POST(askRequest({ team_id: 1, messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns an unavailable notice (not an error) when no API key is set", async () => {
    clearApiKey();
    const res = await POST(askRequest({ team_id: 1, messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/unavailable/i);
    expect(vi.mocked(getScoutContext)).not.toHaveBeenCalled();
  });

  it("streams the assistant reply on the happy path", async () => {
    stubApiKey();
    vi.mocked(getScoutContext).mockResolvedValue(makeScoutContext());
    mockClaudeMessages([textMessage("Bench him this week.")]);
    const res = await POST(askRequest({ team_id: 1, freeTransfers: 1, messages: [{ role: "user", content: "Start or bench?" }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("Bench him this week.");
  });
});
