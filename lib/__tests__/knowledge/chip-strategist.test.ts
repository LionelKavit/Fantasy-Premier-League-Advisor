import { describe, it, expect, beforeEach } from "vitest";
import { loadKnowledge, _clearKnowledgeCache } from "../../knowledge";

// The chips.md grounding is retained (still loadable + tested), though the
// long-term narrative that consumed it was removed in declutter-alerts-and-outlook.
describe("loadKnowledge", () => {
  beforeEach(() => _clearKnowledgeCache());

  it("loads chips.md with the key two-halves rule + canonical timing", () => {
    const md = loadKnowledge("chips");
    expect(md.length).toBeGreaterThan(200);
    expect(md).toMatch(/GW19/);
    expect(md).toMatch(/Bench Boost/);
    expect(md).toMatch(/Free Hit/);
  });

  it("returns '' for a missing file (grounding is optional, never throws)", () => {
    expect(loadKnowledge("does-not-exist")).toBe("");
  });

  it("caches the result", () => {
    expect(loadKnowledge("chips")).toBe(loadKnowledge("chips"));
  });
});
