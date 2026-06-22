import { describe, it, expect, afterEach, vi } from "vitest";
import type { GameweekPlan } from "../../plan/types";
import type { OptimizerResult, TransferType, ValidTransfer } from "../../optimizer/types";
import type { CaptainResult } from "../../captain/types";
import {
  buildBriefGrounding,
  composeDeterministicBrief,
  streamOpeningBrief,
  formatDeadline,
  type BriefGrounding,
} from "../../scout/brief";
import { llm } from "../../llm/client";
import { SCOUT_PERSONA } from "../../llm/persona";
import { makeScoredPlayer, makeCaptainCandidate, makeChips } from "../factories";
import { mockClaudeStream, restoreClaude } from "../mock-claude";

const DEADLINE = "2026-02-14T11:30:00Z"; // Sat 14 Feb, 11:30 UTC

function makeTransfer(type: TransferType, moves: { out: string; in: string }[]): OptimizerResult {
  const transfers: ValidTransfer[] = moves.map((m) => ({
    weakPlayer: makeScoredPlayer({ player: { webName: m.out } }),
    candidate: makeScoredPlayer({ player: { webName: m.in } }),
    priceDelta: 0,
    gw1Gain: 1,
    gw5Gain: 2,
    scoreDiffPct: 0,
  }));
  return {
    primaryRecommendation: { type, transfers, netPointsCost: 0, netGain: 1, breakEvenGw: null },
    secondaryRecommendation: null,
    hitVerdict: { recommended: false, reasoning: "", breakEvenGw: null },
    chipPlan: [],
    restructureOptions: [],
    horizon: [],
    alerts: [],
    confidence: "high",
    narrativeSummary: "Saka's underlying numbers dwarf Mbeumo's over the next month.",
    generatedAt: "2026-02-10T00:00:00Z",
    dataNotice: null,
  };
}

function makeCaptaincy(name: string, vice: string | null): CaptainResult {
  return {
    captain: makeCaptainCandidate({ player: { player: { webName: name } } }),
    viceCaptain: vice ? makeCaptainCandidate({ player: { player: { webName: vice } } }) : null,
    differentialOption: null,
    rankedCandidates: [],
    tripleCaptainAdvice: null,
    confidence: "high",
    narrativeSummary: "Captain narrative that must not leak into the brief.",
    alerts: [],
    currentGw: 20,
    generatedAt: "2026-02-10T00:00:00Z",
  };
}

function makePlan(over: Partial<GameweekPlan> = {}): GameweekPlan {
  return {
    teamId: 1,
    currentGw: 20,
    deadline: DEADLINE,
    transfers: makeTransfer("FREE", [{ out: "Mbeumo", in: "Saka" }]),
    captaincy: makeCaptaincy("Haaland", "Salah"),
    squad: [],
    bank: 2.0,
    chipsRemaining: makeChips({ wildcard: 1 }),
    manager: { name: "Kavit Mehta", overallRank: 1000, teamName: "Test FC" },
    alerts: ["Saliba flagged doubtful (50% chance of playing)"],
    generatedAt: "2026-02-10T00:00:00Z",
    ...over,
  };
}

const SENTENCE_COUNT = (s: string) => (s.match(/[.!?](\s|$)/g) ?? []).length;
const HAS_MARKDOWN = (s: string) => /[#*`|]|^\s*[-•]\s/m.test(s);

afterEach(restoreClaude);

describe("buildBriefGrounding", () => {
  it("distils the transfer, captain, deadline, alert and chips from the plan", () => {
    const g = buildBriefGrounding(makePlan());
    expect(g.deadline).toBe(DEADLINE);
    expect(g.currentGw).toBe(20);
    expect(g.managerName).toBe("Kavit Mehta");
    expect(g.transfer?.type).toBe("FREE");
    expect(g.transfer?.headline).toBe("Make one free transfer");
    expect(g.transfer?.moves).toEqual([{ out: "Mbeumo", in: "Saka" }]);
    expect(g.captain?.name).toBe("Haaland");
    expect(g.captain?.vice).toBe("Salah");
    expect(g.topAlert).toMatch(/Saliba/);
    expect(g.chips).toEqual(["Wildcard"]);
  });

  it("degrades when a sub-pipeline result is null (no throw, fields null)", () => {
    const g = buildBriefGrounding(makePlan({ transfers: null, captaincy: null, alerts: [] }));
    expect(g.transfer).toBeNull();
    expect(g.captain).toBeNull();
    expect(g.topAlert).toBeNull();
  });

  it("surfaces a transfer/captain sub-alert when there is no plan-level alert", () => {
    const transfers = makeTransfer("FREE", [{ out: "Mbeumo", in: "Saka" }]);
    transfers.alerts = ["Price rise likely for Saka — act before deadline"];
    const g = buildBriefGrounding(makePlan({ alerts: [], transfers }));
    expect(g.topAlert).toMatch(/Price rise likely for Saka/);
  });
});

describe("composeDeterministicBrief — same shape, short, no markdown", () => {
  it("greets, names the deadline, leads with the transfer call, includes captain", () => {
    const text = composeDeterministicBrief(buildBriefGrounding(makePlan()));
    expect(text).toMatch(/^Right Kavit —/);
    expect(text).toContain("Sat 14 Feb, 11:30 GMT");
    expect(text).toContain("Make one free transfer: Mbeumo → Saka.");
    expect(text).toContain("Captain Haaland, Salah as vice.");
    expect(SENTENCE_COUNT(text)).toBeLessThanOrEqual(4);
    expect(HAS_MARKDOWN(text)).toBe(false);
  });

  it("never pastes the long-form narrativeSummary / longTermNarrative", () => {
    const text = composeDeterministicBrief(buildBriefGrounding(makePlan()));
    expect(text).not.toContain("underlying numbers dwarf");
    expect(text).not.toContain("multi-paragraph outlook");
  });

  it("says hold when the recommendation is ROLL", () => {
    const plan = makePlan({ transfers: makeTransfer("ROLL", []) });
    const text = composeDeterministicBrief(buildBriefGrounding(plan));
    expect(text).toMatch(/Hold your transfer this week/);
  });

  it("falls back gracefully when the deadline is missing", () => {
    const text = composeDeterministicBrief(buildBriefGrounding(makePlan({ deadline: null })));
    expect(text).toMatch(/let's get GW20 sorted/);
    expect(SENTENCE_COUNT(text)).toBeLessThanOrEqual(4);
  });

  it("greets and still works when transfer + captain are unavailable", () => {
    const text = composeDeterministicBrief(
      buildBriefGrounding(makePlan({ transfers: null, captaincy: null, alerts: [] }))
    );
    expect(text).toMatch(/^Right Kavit —/);
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("formatDeadline", () => {
  it("formats an ISO deadline in UTC/GMT", () => {
    expect(formatDeadline(DEADLINE)).toBe("Sat 14 Feb, 11:30 GMT");
  });
  it("returns null for a missing or invalid value", () => {
    expect(formatDeadline(null)).toBeNull();
    expect(formatDeadline("not-a-date")).toBeNull();
  });
});

describe("streamOpeningBrief (LLM path)", () => {
  it("streams tokens, grounds the prompt, uses the persona, and passes no tools", async () => {
    const spy = mockClaudeStream(["Right Kavit — ", "deadline's Saturday. ", "Saka in for Mbeumo."]);
    const tokens: string[] = [];
    const g: BriefGrounding = buildBriefGrounding(makePlan());

    await streamOpeningBrief(g, (t) => tokens.push(t));

    expect(tokens.join("")).toBe("Right Kavit — deadline's Saturday. Saka in for Mbeumo.");
    const params = spy.mock.calls[0][0] as {
      system?: string;
      max_tokens?: number;
      messages: { content: string }[];
      tools?: unknown;
    };
    expect(params.system).toBe(SCOUT_PERSONA);
    expect(params.tools).toBeUndefined();
    // A runaway guard well above the ≤4-sentence budget (~110-150 tokens), so the
    // brief is never truncated mid-sentence, but still bounded.
    expect(params.max_tokens).toBeGreaterThanOrEqual(256);
    expect(params.max_tokens).toBeLessThanOrEqual(512);
    const prompt = params.messages[0].content;
    expect(prompt).toContain("Sat 14 Feb, 11:30 GMT"); // deadline grounded
    expect(prompt).toContain("Mbeumo → Saka"); // the real move
    expect(prompt).toContain("Haaland"); // the real captain
    expect(prompt).toMatch(/at most 4 short sentences/i); // brevity instruction
  });

  it("propagates a streaming failure to the caller", async () => {
    vi.spyOn(llm, "stream").mockImplementation(() => ({
      textStream: (async function* () {
        throw new Error("stream boom");
      })(),
      finalMessage: async () => {
        throw new Error("stream boom");
      },
    }));
    await expect(streamOpeningBrief(buildBriefGrounding(makePlan()), () => {})).rejects.toThrow("stream boom");
  });
});
