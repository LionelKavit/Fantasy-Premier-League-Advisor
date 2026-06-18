import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Lazy enrichment fetches a per-player element summary; stub it offline.
vi.mock("../../fpl-api", () => ({
  fetchElementSummary: vi.fn().mockResolvedValue({ history: [], history_past: [] }),
}));

import { simulateTransfer, simulateCaptain } from "../../simulate";
import { buildScoutContext } from "../../scout/context";
import { makeAnalysisContext, makeScoutContext } from "./helpers";
import { makeInjuredPlayer, makePlayer } from "../factories";
import { clearApiKey, restoreClaude } from "../mock-claude";

beforeEach(() => clearApiKey()); // no key → enrichment skips the LLM pass
afterEach(restoreClaude);

describe("simulateTransfer", () => {
  it("accepts a legal, affordable transfer and reports the deltas", async () => {
    const sc = makeScoutContext();
    const r = await simulateTransfer({ outId: 1, inId: 100 }, sc); // out team1, in team6 £7.5
    expect(r.legal).toBe(true);
    expect(r.out?.name).toBe("P1");
    expect(r.in?.name).toBe("Affordable");
    expect(r.priceDelta).toBeCloseTo(1.5, 5); // 7.5 − 6.0
    expect(r.bankAfter).toBeCloseTo(0.5, 5); // 2.0 − 1.5
    expect(typeof r.scoreDeltaGw1).toBe("number");
    expect(typeof r.scoreDeltaGw5).toBe("number");
  });

  it("rejects a player that is not in the squad", async () => {
    const sc = makeScoutContext();
    const r = await simulateTransfer({ outId: 9999, inId: 100 }, sc);
    expect(r.legal).toBe(false);
    expect(r.reason).toMatch(/not in your squad/i);
  });

  it("rejects bringing in a player already owned", async () => {
    const sc = makeScoutContext();
    const r = await simulateTransfer({ outId: 1, inId: 2 }, sc);
    expect(r.legal).toBe(false);
    expect(r.reason).toMatch(/already in your squad/i);
  });

  it("rejects a transfer that breaks the budget", async () => {
    const sc = makeScoutContext();
    const r = await simulateTransfer({ outId: 1, inId: 101 }, sc); // £12.5 vs £8.0 max
    expect(r.legal).toBe(false);
    expect(r.reason).toMatch(/budget/i);
  });

  it("rejects a 4th player from the same team", async () => {
    const sc = makeScoutContext();
    // out P2 (team 2), in id102 (team 1, which already has P1/P6/P11)
    const r = await simulateTransfer({ outId: 2, inId: 102 }, sc);
    expect(r.legal).toBe(false);
    expect(r.reason).toMatch(/3 players/i);
  });

  it("rejects an injured incoming player", async () => {
    const ac = makeAnalysisContext();
    ac.players.push(makeInjuredPlayer({ id: 104, teamId: 6, teamShortName: "T6", price: 5.0 }));
    const sc = buildScoutContext(ac);
    const r = await simulateTransfer({ outId: 1, inId: 104 }, sc);
    expect(r.legal).toBe(false);
    expect(r.reason).toMatch(/injured/i);
  });
});

describe("simulateCaptain", () => {
  it("flags a high-ceiling player as an improvement over the current XI", async () => {
    const sc = makeScoutContext();
    const r = await simulateCaptain({ id: 101 }, sc); // Premium FWD, form 8
    expect(r.captainScore).toBeGreaterThan(0);
    expect(r.blank).toBe(false);
    expect(r.currentBest).not.toBeNull();
    expect(r.isImprovement).toBe(true);
    expect(r.delta).toBeGreaterThan(0);
  });

  it("scores a current XI player without claiming a false improvement", async () => {
    const sc = makeScoutContext();
    const r = await simulateCaptain({ id: 1 }, sc);
    expect(r.captainScore).toBeGreaterThan(0);
    expect(r.isImprovement).toBe(false); // already among the best
  });

  it("reports a blank when the player has no fixture this gameweek", async () => {
    const ac = makeAnalysisContext();
    ac.players.push(makePlayer({ id: 105, teamId: 99, teamShortName: "XXX" })); // no GW20 fixture
    const sc = buildScoutContext(ac);
    const r = await simulateCaptain({ id: 105 }, sc);
    expect(r.blank).toBe(true);
    expect(r.captainScore).toBe(0);
  });

  it("handles an unknown player id gracefully", async () => {
    const sc = makeScoutContext();
    const r = await simulateCaptain({ id: 9999 }, sc);
    expect(r.captainScore).toBe(0);
    expect(r.blank).toBe(true);
  });
});
