import { describe, it, expect, afterEach } from "vitest";
import { synthesizeCaptainPick } from "../../captain/synthesis";
import type { CaptainSynthesisInput, TripleCaptainAdvice } from "../../captain/types";
import { makeCaptainCandidate, makeManagerProfile, makeAvailability } from "../factories";
import { mockClaudeJson, mockClaudeError, stubApiKey, clearApiKey, restoreClaude } from "../mock-claude";

afterEach(restoreClaude);

function makeInput(o: Partial<CaptainSynthesisInput> = {}): CaptainSynthesisInput {
  const cap = makeCaptainCandidate({ total: 8, player: { player: { webName: "Cap" } } });
  const alt = makeCaptainCandidate({ total: 6, player: { player: { webName: "Alt" } } });
  return {
    rankedCandidates: [cap, alt],
    viceCaptain: alt,
    differentialOption: null,
    horizon: [],
    tripleCaptainAdvice: null,
    managerProfile: makeManagerProfile(),
    currentGw: 20,
    ...o,
  };
}

describe("synthesizeCaptainPick — success path (mocked LLM)", () => {
  it("maps the chosen captain by name and keeps deterministic outputs", async () => {
    stubApiKey();
    mockClaudeJson({ captainName: "Cap", confidence: "high", narrativeSummary: "Captain Cap.", alerts: [] });
    const r = await synthesizeCaptainPick(makeInput());
    expect(r.captain.player.player.webName).toBe("Cap");
    expect(r.confidence).toBe("high");
    expect(r.narrativeSummary).toBe("Captain Cap.");
  });

  it("clamps an invalid confidence to medium", async () => {
    stubApiKey();
    mockClaudeJson({ captainName: "Cap", confidence: "ultra", narrativeSummary: "x", alerts: [] });
    expect((await synthesizeCaptainPick(makeInput())).confidence).toBe("medium");
  });
});

describe("synthesizeCaptainPick — fail-safe and alerts", () => {
  it("falls back to the top candidate when the key is missing", async () => {
    clearApiKey();
    const r = await synthesizeCaptainPick(makeInput());
    expect(r.captain.player.player.webName).toBe("Cap");
    expect(r.confidence).toBe("low");
    expect(r.alerts.some((a) => /api key not set/i.test(a))).toBe(true);
  });

  it("falls back on API error", async () => {
    stubApiKey();
    mockClaudeError(500);
    const r = await synthesizeCaptainPick(makeInput());
    expect(r.confidence).toBe("low");
    expect(r.alerts.some((a) => a.includes("500"))).toBe(true);
  });

  it("alerts when the chosen captain is doubtful", async () => {
    clearApiKey();
    const doubtfulCap = makeCaptainCandidate({
      total: 8,
      player: { player: { webName: "Doubt", availability: makeAvailability({ status: "doubtful", chanceOfPlayingNext: 50 }) } },
    });
    const r = await synthesizeCaptainPick(makeInput({ rankedCandidates: [doubtfulCap] }));
    expect(r.alerts.some((a) => /doubtful/i.test(a))).toBe(true);
  });

  it("alerts when a triple-captain window is within two gameweeks", async () => {
    clearApiKey();
    const tc: TripleCaptainAdvice = {
      recommended: true, targetGw: 21, targetPlayer: "Cap", peakScore: 12, baselineScore: 5, reasoning: "DGW",
    };
    const r = await synthesizeCaptainPick(makeInput({ tripleCaptainAdvice: tc }));
    expect(r.alerts.some((a) => /triple captain window/i.test(a))).toBe(true);
  });
});
