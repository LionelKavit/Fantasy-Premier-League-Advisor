import { describe, it, expect, vi } from "vitest";

// Return markers for the curated files so we can assert they're injected, without
// depending on the real markdown contents.
vi.mock("../../knowledge", () => ({
  loadKnowledge: (name: string) =>
    name === "rules"
      ? "RULES_MARKER — 1 free transfer per gameweek"
      : name === "chips"
        ? "CHIPS_MARKER"
        : "",
}));

import { buildScoutSystemPrompt } from "../../scout/system-prompt";
import { makeScoutContext } from "./helpers";

const demoPrompt = () => buildScoutSystemPrompt(makeScoutContext(), 1, undefined, true);

describe("buildScoutSystemPrompt — demo mode", () => {
  it("uses the Scout persona with demo framing that overrides 'real squad'", () => {
    const s = demoPrompt();
    expect(s).toMatch(/Pocket Scout/); // shared persona present
    expect(s).toMatch(/DEMO mode/);
    expect(s).toMatch(/OVERRIDES/); // explicitly overrides the persona's "real squad" close
    expect(s).toMatch(/sample/i);
  });

  it("grounds in the current FPL rules", () => {
    const s = demoPrompt();
    expect(s).toMatch(/RULES_MARKER/);
    expect(s).toMatch(/current — use these/i);
  });

  it("omits the gameweek number so the cached prefix is visitor-independent", () => {
    // helpers' CURRENT_GW is 20 — the demo prompt must not embed it.
    expect(demoPrompt()).not.toMatch(/GW\s*20\b/);
  });

  it("asks for a brief (~2 sentence) answer", () => {
    expect(demoPrompt()).toMatch(/TWO sentences/i);
  });

  it("is identical across two builds (constant, shareable cache prefix)", () => {
    expect(demoPrompt()).toBe(demoPrompt());
  });
});
