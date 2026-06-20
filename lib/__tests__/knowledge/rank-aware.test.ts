import { describe, it, expect, beforeEach } from "vitest";
import { loadKnowledge, _clearKnowledgeCache } from "../../knowledge";
import { buildPrompt } from "../../captain/synthesis";
import { makeCaptainCandidate, makeManagerProfile } from "../factories";

describe("rank-strategy knowledge", () => {
  beforeEach(() => _clearKnowledgeCache());

  it("loads rank-strategy.md with the EO / template / chase-vs-protect principles", () => {
    const md = loadKnowledge("rank-strategy");
    expect(md.length).toBeGreaterThan(200);
    expect(md).toMatch(/effective ownership/i);
    expect(md).toMatch(/differential/i);
    expect(md).toMatch(/template/i);
    expect(md).toMatch(/chase|protect/i);
  });

  it("caches the result", () => {
    expect(loadKnowledge("rank-strategy")).toBe(loadKnowledge("rank-strategy"));
  });

  it("injects the rank principles into the captain prompt (deterministic facts kept)", () => {
    const prompt = buildPrompt({
      rankedCandidates: [
        makeCaptainCandidate({ effectiveOwnership: 0.6 }),
        makeCaptainCandidate({ effectiveOwnership: 0.05, isDifferential: true }),
      ],
      viceCaptain: null,
      differentialOption: makeCaptainCandidate({ effectiveOwnership: 0.05, isDifferential: true }),
      horizon: [],
      tripleCaptainAdvice: null,
      managerProfile: makeManagerProfile(),
      currentGw: 30,
    });
    expect(prompt).toContain("Expert rank principles");
    expect(prompt).toMatch(/effective ownership/i);
    expect(prompt).toContain("Strategy guidance:"); // existing rank facts/tone retained
  });
});
