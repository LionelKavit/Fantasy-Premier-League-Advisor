import { describe, it, expect, vi } from "vitest";

// Simulate the curated knowledge files being unavailable: loadKnowledge returns ""
// (its real degradation behaviour). The chat prompt must still build, just without
// the expert-principles section.
vi.mock("../../knowledge", () => ({ loadKnowledge: () => "" }));

import { buildScoutSystemPrompt } from "../../scout/system-prompt";
import { makeScoutContext } from "./helpers";

describe("buildScoutSystemPrompt — knowledge unavailable", () => {
  it("degrades to no expert-principles section without error", () => {
    const sys = buildScoutSystemPrompt(makeScoutContext(), 1);
    expect(sys.length).toBeGreaterThan(0);
    expect(sys).not.toMatch(/Expert principles/i);
    expect(sys).not.toMatch(/One chip per gameweek/i);
  });
});
