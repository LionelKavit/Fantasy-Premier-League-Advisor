import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { runScoutConversation } from "../../scout/chat";
import { buildScoutSystemPrompt } from "../../scout/system-prompt";
import { llm } from "../../llm/client";
import { makeScoutContext, mockScoutStream } from "./helpers";
import { makeChips } from "../factories";
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
    const call = spy.mock.calls[0][0] as {
      system: Array<{ type: string; text: string; cache_control?: { type: string } }>;
      messages: { role: string; content: unknown }[];
      tools: unknown[];
    };
    expect(call.messages[0]).toMatchObject({ role: "user", content: "first" });
    expect(call.messages[1]).toMatchObject({ role: "assistant", content: "earlier reply" });
    // Prompt caching: the system block and the message tail carry breakpoints.
    expect(call.messages[2]).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "follow up", cache_control: { type: "ephemeral" } }],
    });
    const sysText = call.system[0].text;
    expect(call.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(sysText).toMatch(/only/i);
    expect(sysText).toMatch(/fantasy premier league/i);
    // Formatting rules: no tables, and complement (don't restate) the panels.
    expect(sysText).toMatch(/markdown tables/i);
    expect(sysText).toMatch(/restate/i);
    expect(Array.isArray(call.tools)).toBe(true);
    // No chip plan supplied → no chip-plan grounding section.
    expect(sysText).not.toMatch(/committed recommendation/i);
  });

  it("grounds chip answers in the supplied chip plan (single source)", async () => {
    stubApiKey();
    const spy = mockScoutStream([{ text: "Play your Bench Boost." }]);
    await runScoutConversation({
      sc: makeScoutContext(),
      freeTransfers: 1,
      messages: [{ role: "user", content: "TC or Bench Boost?" }],
      chipPlan: [
        { chip: "benchBoost", status: "play-now", triggerGw: 38, reason: "Expires GW38; bench will score." },
        { chip: "tripleCaptain", status: "hold", triggerGw: 38, reason: "Better saved for a Double." },
      ],
    });
    const sysText = (spy.mock.calls[0][0] as { system: { text: string }[] }).system[0].text;
    expect(sysText).toMatch(/committed recommendation.*authoritative/i);
    expect(sysText).toMatch(/Bench Boost: PLAY NOW/);
    expect(sysText).toMatch(/Triple Captain: HOLD/);
    expect(sysText).toMatch(/explain and defend THIS plan/i);
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

describe("buildScoutSystemPrompt — held-chip grounding", () => {
  it("lists held chips + expiry and the Wildcard-as-hit-alternative principle", () => {
    const sc = makeScoutContext();
    sc.ctx.analysis.chipsRemaining = makeChips({ wildcard: 1, benchBoost: 1 });
    const sys = buildScoutSystemPrompt(sc, 2);
    expect(sys).toMatch(/Chips in hand/i);
    expect(sys).toMatch(/Wildcard/);
    expect(sys).toMatch(/Bench Boost/);
    expect(sys).toMatch(/expire GW38/i); // GW20 → second-half deadline
    expect(sys).toMatch(/free/i); // the Wildcard-as-hit-alternative principle
  });

  it("omits held-chip grounding when no chips remain", () => {
    const sc = makeScoutContext(); // default: no chips
    expect(buildScoutSystemPrompt(sc, 1)).not.toMatch(/Chips in hand/i);
  });
});

describe("buildScoutSystemPrompt — curated knowledge grounding", () => {
  it("injects the chip + rank expert knowledge so the agentic loop reasons with it", () => {
    const sys = buildScoutSystemPrompt(makeScoutContext(), 1);
    expect(sys).toMatch(/Expert principles/i);
    // the one-chip-per-gameweek rule reaches the chat from chips.md itself
    expect(sys).toMatch(/One chip per gameweek/i);
    // rank-strategy.md is grounded too (EO / chase-vs-protect)
    expect(sys).toMatch(/effective ownership/i);
  });
});

describe("buildScoutSystemPrompt — chip verdict authority over knowledge", () => {
  const chipPlan = [
    { chip: "benchBoost", status: "play-now", triggerGw: 20, reason: "Final-day bench boost." },
    { chip: "tripleCaptain", status: "hold", triggerGw: 20, reason: "Hold — no premium Double." },
  ] as const;

  it("renders the closing authority clause after the knowledge when a chip plan is present", () => {
    const sys = buildScoutSystemPrompt(makeScoutContext(), 1, [...chipPlan]);
    expect(sys).toMatch(/Chip decision authority/i);
    expect(sys).toMatch(/do NOT recommend playing a different chip/i);
    // it must come AFTER the expert principles so it governs them by recency
    expect(sys.indexOf("Chip decision authority")).toBeGreaterThan(sys.indexOf("Expert principles"));
    // knowledge is still present (explanation), not removed
    expect(sys).toMatch(/Expert principles/i);
  });

  it("omits the authority clause when no chip plan is supplied (knowledge still present)", () => {
    const sys = buildScoutSystemPrompt(makeScoutContext(), 1);
    expect(sys).not.toMatch(/Chip decision authority/i);
    expect(sys).toMatch(/Expert principles/i);
  });
});
