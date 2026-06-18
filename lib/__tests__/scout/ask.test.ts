import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { runScoutConversation } from "../../scout/chat";
import { llm } from "../../llm/client";
import { makeScoutContext, mockScoutStream } from "./helpers";
import { stubApiKey, clearApiKey, restoreClaude } from "../mock-claude";

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

/** Parse an NDJSON Response body into its events. */
async function readEvents(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("runScoutConversation (streaming agentic loop)", () => {
  it("streams a direct answer token-by-token when no tools are used", async () => {
    stubApiKey();
    mockScoutStream([{ text: "Captain Salah this week." }]);
    const tokens: string[] = [];
    const out = await runScoutConversation({
      sc: makeScoutContext(),
      freeTransfers: 1,
      messages: [{ role: "user", content: "Who should I captain?" }],
      onToken: (t) => tokens.push(t),
    });
    expect(out.text).toBe("Captain Salah this week.");
    expect(out.toolRounds).toBe(0);
    expect(out.toolCalls).toEqual([]);
    expect(tokens.length).toBeGreaterThan(1); // arrived as multiple deltas
    expect(tokens.join("")).toBe("Captain Salah this week.");
  });

  it("runs a tool round (firing onTool), then streams a final answer", async () => {
    stubApiKey();
    mockScoutStream([
      { toolUses: [{ id: "t1", name: "get_plan", input: {} }] },
      { text: "Your best move is bringing in Affordable." },
    ]);
    const tools: string[] = [];
    const out = await runScoutConversation({
      sc: makeScoutContext(),
      freeTransfers: 1,
      messages: [{ role: "user", content: "What should I do?" }],
      onTool: (n) => tools.push(n),
    });
    expect(out.toolCalls).toEqual(["get_plan"]);
    expect(tools).toEqual(["get_plan"]);
    expect(out.toolRounds).toBe(1);
    expect(out.text).toContain("Affordable");
  });

  it("forces a final answer when the tool-round cap is hit", async () => {
    stubApiKey();
    mockScoutStream([
      { toolUses: [{ id: "t1", name: "get_plan", input: {} }] },
      { toolUses: [{ id: "t2", name: "get_squad", input: {} }] },
      { text: "Final synthesized answer." },
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
    const spy = mockScoutStream([{ text: "ok" }]);
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
    expect(call.messages[0]).toMatchObject({ role: "user", content: "first" });
    expect(call.messages[1]).toMatchObject({ role: "assistant", content: "earlier reply" });
    expect(call.messages[2]).toMatchObject({ role: "user", content: "follow up" });
    expect(call.system).toMatch(/only/i);
    expect(call.system).toMatch(/fantasy premier league/i);
    // Formatting rules: no tables, and complement (don't restate) the panels.
    expect(call.system).toMatch(/markdown tables/i);
    expect(call.system).toMatch(/restate/i);
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

  it("emits the unavailable notice as a token event when no API key is set", async () => {
    clearApiKey();
    const res = await POST(askRequest({ team_id: 1, messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await readEvents(res);
    expect(events.some((e) => e.type === "token" && /unavailable/i.test(String(e.text)))).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(vi.mocked(getScoutContext)).not.toHaveBeenCalled();
  });

  it("streams token + done events on the happy path", async () => {
    stubApiKey();
    vi.mocked(getScoutContext).mockResolvedValue(makeScoutContext());
    mockScoutStream([{ text: "Bench him this week." }]);
    const res = await POST(askRequest({ team_id: 1, freeTransfers: 1, messages: [{ role: "user", content: "Start or bench?" }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await readEvents(res);
    const answer = events.filter((e) => e.type === "token").map((e) => e.text).join("");
    expect(answer).toBe("Bench him this week.");
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("emits a tool event before running a tool", async () => {
    stubApiKey();
    vi.mocked(getScoutContext).mockResolvedValue(makeScoutContext());
    mockScoutStream([
      { toolUses: [{ id: "t1", name: "get_plan", input: {} }] },
      { text: "Here's the plan." },
    ]);
    const res = await POST(askRequest({ team_id: 1, messages: [{ role: "user", content: "advise me" }] }));
    const events = await readEvents(res);
    expect(events.some((e) => e.type === "tool" && e.name === "get_plan")).toBe(true);
  });

  it("emits a friendly error (then done) when the loop fails mid-stream", async () => {
    stubApiKey();
    vi.mocked(getScoutContext).mockResolvedValue(makeScoutContext());
    vi.spyOn(llm, "stream").mockImplementation(() => {
      throw new Error("401 invalid x-api-key");
    });
    const res = await POST(askRequest({ team_id: 1, messages: [{ role: "user", content: "hi" }] }));
    const events = await readEvents(res);
    const err = events.find((e) => e.type === "error");
    expect(String(err?.message)).toMatch(/authorized|api key/i);
    expect(String(err?.message)).not.toMatch(/401|x-api-key/i); // raw detail not leaked
    expect(events.at(-1)).toEqual({ type: "done" });
  });
});
