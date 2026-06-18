import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../fpl-api", () => ({ fetchElementSummary: vi.fn() }));

import { scorePlayerEnriched } from "../../scout/context";
import { fetchElementSummary } from "../../fpl-api";
import { makeScoutContext } from "./helpers";
import { mockClaudeJson, stubApiKey, clearApiKey, restoreClaude } from "../mock-claude";

beforeEach(() => {
  vi.mocked(fetchElementSummary).mockReset().mockResolvedValue({ history: [], history_past: [] });
});
afterEach(restoreClaude);

describe("scorePlayerEnriched", () => {
  it("reuses the full pipeline score for a squad member without fetching", async () => {
    clearApiKey();
    const sc = makeScoutContext();
    const sp = await scorePlayerEnriched(sc.playersById.get(1)!, sc);
    expect(sp).toBe(sc.scoredById.get(1)); // same object — no recompute
    expect(fetchElementSummary).not.toHaveBeenCalled();
  });

  it("lazily fetches an element summary, attaches trend, and caches the result", async () => {
    clearApiKey();
    const sc = makeScoutContext();
    const p = sc.playersById.get(100)!; // external, not in squad
    const first = await scorePlayerEnriched(p, sc);
    expect(first.trendSignals).not.toBeNull();
    expect(sc.enrichedById.has(100)).toBe(true);
    expect(fetchElementSummary).toHaveBeenCalledTimes(1);

    const second = await scorePlayerEnriched(p, sc);
    expect(second).toBe(first); // served from cache
    expect(fetchElementSummary).toHaveBeenCalledTimes(1);
  });

  it("runs a single-player LLM context pass when a key is configured", async () => {
    stubApiKey();
    mockClaudeJson([
      {
        id: 100,
        rotationRisk: 0.5,
        oopBonus: 0.05,
        injurySeverity: 0,
        tacticalBoost: 0,
        opponentKeyAbsence: 0,
        setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null },
      },
    ]);
    const sc = makeScoutContext();
    const sp = await scorePlayerEnriched(sc.playersById.get(100)!, sc);
    expect(sp.llmSignals.rotationRisk).toBeGreaterThan(0);
  });

  it("degrades to neutral LLM signals when no key is configured", async () => {
    clearApiKey();
    const sc = makeScoutContext();
    const sp = await scorePlayerEnriched(sc.playersById.get(100)!, sc);
    expect(sp.llmSignals.rotationRisk).toBe(0);
  });
});
