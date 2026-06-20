import { describe, it, expect } from "vitest";
import { SCOUT_PERSONA } from "../../llm/persona";
import { buildPrompt } from "../../captain/synthesis";
import { makeCaptainCandidate, makeManagerProfile } from "../factories";

describe("Pocket Scout persona", () => {
  it("defines the identity + key operating principles", () => {
    expect(SCOUT_PERSONA.length).toBeGreaterThan(200);
    expect(SCOUT_PERSONA).toMatch(/Pocket Scout/);
    expect(SCOUT_PERSONA).toMatch(/never invent/i);
    expect(SCOUT_PERSONA).toMatch(/pundit|Match of the Day|Sky Sports/i);
    expect(SCOUT_PERSONA).toMatch(/rank/i);
    expect(SCOUT_PERSONA).toMatch(/output format/i);
  });

  it("the captain prompt defers identity to the persona (no inline 'You are an FPL ... advisor')", () => {
    const prompt = buildPrompt({
      rankedCandidates: [makeCaptainCandidate()],
      viceCaptain: null,
      differentialOption: null,
      horizon: [],
      tripleCaptainAdvice: null,
      managerProfile: makeManagerProfile(),
      currentGw: 30,
    });
    expect(prompt).not.toMatch(/You are an FPL/i);
    expect(prompt).toContain("Pick this manager's captain"); // the task itself remains
  });
});
