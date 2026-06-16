import { describe, it, expect, afterEach } from "vitest";
import { synthesizeRecommendation } from "../../optimizer/synthesis";
import type { SynthesisInput, ValidTransfer, SingleTransferResult, HitTransferResult } from "../../optimizer/types";
import {
  makeScoredPlayer, makeSquadAnalysisResult, makeManagerProfile, makeAvailability,
} from "../factories";
import {
  mockClaudeJson, mockClaudeError, mockClaudeMalformed, stubApiKey, clearApiKey, restoreClaude,
} from "../mock-claude";

afterEach(restoreClaude);

const rising: ValidTransfer = {
  weakPlayer: makeScoredPlayer({ player: { id: 1 } }),
  candidate: makeScoredPlayer({ player: { id: 2, webName: "Rising" }, marketSignals: { transferMomentum: 0.8 } }),
  priceDelta: 0, gw1Gain: 1, gw5Gain: 1, scoreDiffPct: 10,
};
const singleResult: SingleTransferResult = {
  bestSingle: rising, bestSecond: null, alternatives: [], savingsOption: null, rollReason: null,
};
const hitResult: HitTransferResult = { singleHit: null, doubleHit: null };

function makeInput(): SynthesisInput {
  const doubtful = makeScoredPlayer({ player: { webName: "Doubt", availability: makeAvailability({ status: "doubtful", chanceOfPlayingNext: 50 }) } });
  const analysis = makeSquadAnalysisResult({
    rankedSquad: [doubtful, makeScoredPlayer({ total: 0.5 })],
    weakest3: [
      { player: makeScoredPlayer({ player: { position: "MID" } }), whyWeak: ["x"], targets: [] },
      { player: makeScoredPlayer({ player: { position: "MID" } }), whyWeak: ["x"], targets: [] },
      { player: makeScoredPlayer({ player: { position: "FWD" } }), whyWeak: ["x"], targets: [] },
    ],
  });
  return {
    analysis,
    managerProfile: makeManagerProfile(),
    validTransfers: [rising],
    singleResult,
    hitResult,
    restructureOptions: [],
    horizon: [],
    chipRecommendations: [],
    freeTransfers: 1,
  };
}

const validReply = {
  primaryRecommendation: { type: "FREE", transfers: [], netPointsCost: 0, netGain: 1, breakEvenGw: null },
  secondaryRecommendation: null,
  hitVerdict: { recommended: false, reasoning: "no hit", breakEvenGw: null },
  confidence: "high",
  narrativeSummary: "Transfer X for Y.",
  alerts: ["LLM note"],
};

describe("synthesizeRecommendation — success path (mocked LLM)", () => {
  it("parses a valid reply, maps the action, and merges computed alerts", async () => {
    stubApiKey();
    mockClaudeJson(validReply);
    const r = await synthesizeRecommendation(makeInput());

    expect(r.confidence).toBe("high");
    expect(r.primaryRecommendation.type).toBe("FREE");
    expect(r.primaryRecommendation.transfers).toHaveLength(1); // mapped from bestSingle
    expect(r.narrativeSummary).toBe("Transfer X for Y.");

    expect(r.alerts).toContain("LLM note");
    expect(r.alerts.some((a) => a.includes("Rising"))).toBe(true); // transferMomentum > 0.7
    expect(r.alerts.some((a) => a.includes("Doubt"))).toBe(true); // doubtful squad player
    expect(r.alerts.some((a) => /multiple weak spots at MID/i.test(a))).toBe(true);
  });

  it("clamps an out-of-range confidence to medium", async () => {
    stubApiKey();
    mockClaudeJson({ ...validReply, confidence: "supreme" });
    const r = await synthesizeRecommendation(makeInput());
    expect(r.confidence).toBe("medium");
  });

  it("maps HIT_SINGLE, HIT_DOUBLE, WILDCARD and a secondary recommendation", async () => {
    stubApiKey();
    const input = makeInput();
    const a = rising;
    const b: ValidTransfer = { ...rising, weakPlayer: makeScoredPlayer({ player: { id: 9 } }), candidate: makeScoredPlayer({ player: { id: 10 } }) };
    input.validTransfers = [a, b];
    input.hitResult = {
      singleHit: { transfers: [a], netGain: 1.5, breakEvenGw: 2 },
      doubleHit: { transfers: [a, b], netGain: 2, breakEvenGw: 3 },
    };

    mockClaudeJson({ ...validReply, primaryRecommendation: { type: "HIT_DOUBLE" }, secondaryRecommendation: { type: "FREE" } });
    const dbl = await synthesizeRecommendation(input);
    expect(dbl.primaryRecommendation.type).toBe("HIT_DOUBLE");
    expect(dbl.primaryRecommendation.netPointsCost).toBe(-8);
    expect(dbl.primaryRecommendation.transfers).toHaveLength(2);
    expect(dbl.secondaryRecommendation?.type).toBe("FREE");

    mockClaudeJson({ ...validReply, primaryRecommendation: { type: "HIT_SINGLE" } });
    const single = await synthesizeRecommendation(input);
    expect(single.primaryRecommendation.type).toBe("HIT_SINGLE");
    expect(single.primaryRecommendation.netPointsCost).toBe(-4);

    mockClaudeJson({ ...validReply, primaryRecommendation: { type: "WILDCARD" } });
    const wc = await synthesizeRecommendation(input);
    expect(wc.primaryRecommendation.type).toBe("WILDCARD");
    expect(wc.primaryRecommendation.transfers.length).toBeGreaterThan(0);
  });

  it("maps an unknown/ROLL action type to a ROLL with no transfers", async () => {
    stubApiKey();
    mockClaudeJson({ ...validReply, primaryRecommendation: { type: "ROLL" } });
    const r = await synthesizeRecommendation(makeInput());
    expect(r.primaryRecommendation.type).toBe("ROLL");
    expect(r.primaryRecommendation.transfers).toHaveLength(0);
  });

  it("preserves deterministic node outputs (chip plan, restructure, horizon)", async () => {
    stubApiKey();
    mockClaudeJson(validReply);
    const input = makeInput();
    const r = await synthesizeRecommendation(input);
    expect(r.chipPlan).toBe(input.chipRecommendations);
    expect(r.restructureOptions).toBe(input.restructureOptions);
    expect(r.horizon).toBe(input.horizon);
  });
});

describe("synthesizeRecommendation — fail-safe", () => {
  it("uses the deterministic fail-safe when the API key is missing", async () => {
    clearApiKey();
    const r = await synthesizeRecommendation(makeInput());
    expect(r.confidence).toBe("low");
    expect(r.primaryRecommendation.type).toBe("FREE"); // bestSingle present
    expect(r.alerts.some((a) => /api key not set/i.test(a))).toBe(true);
  });

  it("falls back on a malformed response", async () => {
    stubApiKey();
    mockClaudeMalformed("not json at all");
    const r = await synthesizeRecommendation(makeInput());
    expect(r.confidence).toBe("low");
    expect(r.alerts.some((a) => /malformed/i.test(a))).toBe(true);
  });

  it("falls back on an API error", async () => {
    stubApiKey();
    mockClaudeError(500);
    const r = await synthesizeRecommendation(makeInput());
    expect(r.confidence).toBe("low");
    expect(r.alerts.some((a) => a.includes("500"))).toBe(true);
  });

  it("recommends ROLL in the fail-safe when there is no best single", async () => {
    clearApiKey();
    const input = makeInput();
    input.singleResult = { bestSingle: null, bestSecond: null, alternatives: [], savingsOption: null, rollReason: "roll" };
    const r = await synthesizeRecommendation(input);
    expect(r.primaryRecommendation.type).toBe("ROLL");
  });
});
