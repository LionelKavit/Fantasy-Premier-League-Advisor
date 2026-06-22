import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { GameweekPlan } from "../../plan/types";
import { stubApiKey, clearApiKey, restoreClaude, mockClaudeStream } from "../mock-claude";
import { makeChips } from "../factories";

// The route grounds via the cached merged plan — stub it so the test stays offline.
vi.mock("../../plan", () => ({ runGameweekPlan: vi.fn() }));
import { runGameweekPlan } from "../../plan";
import { POST } from "../../../app/api/brief/route";

afterEach(restoreClaude);

function briefRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/brief", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readEvents(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

// Minimal plan — the route test exercises routing, not grounding detail.
function fakePlan(over: Partial<GameweekPlan> = {}): GameweekPlan {
  return {
    teamId: 1,
    currentGw: 20,
    deadline: "2026-02-14T11:30:00Z",
    transfers: null,
    captaincy: null,
    squad: [],
    bank: 2.0,
    chipsRemaining: makeChips(),
    manager: { name: "Kavit", overallRank: 1, teamName: "FC" },
    alerts: [],
    generatedAt: "2026-02-10T00:00:00Z",
    ...over,
  };
}

describe("POST /api/brief", () => {
  it("400s when team_id is missing", async () => {
    const res = await POST(briefRequest({ freeTransfers: 1 }));
    expect(res.status).toBe(400);
    expect(vi.mocked(runGameweekPlan)).not.toHaveBeenCalled();
  });

  it("no key → streams the deterministic brief as one token, then done", async () => {
    clearApiKey();
    vi.mocked(runGameweekPlan).mockResolvedValue(fakePlan());

    const res = await POST(briefRequest({ team_id: 1, freeTransfers: 1 }));
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await readEvents(res);

    const tokens = events.filter((e) => e.type === "token");
    expect(tokens).toHaveLength(1);
    expect(String(tokens[0].text)).toMatch(/^Right Kavit — your GW20 deadline is Sat 14 Feb, 11:30 GMT\./);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("with key → streams the LLM brief token-by-token, then done", async () => {
    stubApiKey();
    mockClaudeStream(["Right Kavit — ", "deadline's Saturday."]);
    vi.mocked(runGameweekPlan).mockResolvedValue(fakePlan());

    const res = await POST(briefRequest({ team_id: 1, freeTransfers: 1 }));
    const events = await readEvents(res);

    expect(events.filter((e) => e.type === "token").map((e) => e.text)).toEqual([
      "Right Kavit — ",
      "deadline's Saturday.",
    ]);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("grounding failure → emits an error event then done (stream not crashed)", async () => {
    stubApiKey();
    vi.mocked(runGameweekPlan).mockRejectedValue(new Error("404 manager not found"));

    const res = await POST(briefRequest({ team_id: 999999, freeTransfers: 1 }));
    expect(res.status).toBe(200); // a stream was opened
    const events = await readEvents(res);

    expect(events.some((e) => e.type === "error")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });
});
