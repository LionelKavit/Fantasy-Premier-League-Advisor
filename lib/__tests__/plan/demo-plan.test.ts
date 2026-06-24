import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalysisContext } from "../../plan/types";
import type { CaptainResult, CaptainSynthesisInput } from "../../captain/types";

// Demo plan must never touch the optimizer (no transfers/chips/long-term), and
// must synthesize the captain in demo mode. Mock the heavy collaborators so we
// can assert what the demo path does (and does NOT) call.
vi.mock("../../plan/context", () => ({ getCachedDemoContext: vi.fn() }));
vi.mock("../../optimizer", () => ({ runOptimizerWithContext: vi.fn() }));
vi.mock("../../captain", () => ({ computeCaptainSynthesisInput: vi.fn() }));
vi.mock("../../captain/synthesis", () => ({ synthesizeCaptainPick: vi.fn() }));
vi.mock("../../alerts", () => ({ computeRiskAlerts: vi.fn(() => []) }));

import { runDemoPlanBase, runDemoPlanInsights, _clearInsightsCache } from "../../plan";
import { getCachedDemoContext } from "../../plan/context";
import { runOptimizerWithContext } from "../../optimizer";
import { computeCaptainSynthesisInput } from "../../captain";
import { synthesizeCaptainPick } from "../../captain/synthesis";

const ctx = {
  analysis: {
    currentGw: 1,
    rankedSquad: [],
    picks: [],
    weakSpots: [],
    bank: 0,
    chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 },
    deadline: null,
  },
  managerProfile: {
    entry: { playerFirstName: "", playerLastName: "", name: "Demo Squad", summaryOverallRank: null },
  },
  demoSeason: "offseason",
} as unknown as AnalysisContext;

const fakeCap = {
  captain: { player: { player: { id: 5, webName: "X" } } },
  viceCaptain: null,
} as unknown as CaptainResult;
const capInput = {} as unknown as CaptainSynthesisInput;

beforeEach(() => {
  _clearInsightsCache();
  vi.mocked(getCachedDemoContext).mockReset().mockResolvedValue(ctx);
  vi.mocked(runOptimizerWithContext).mockReset();
  vi.mocked(computeCaptainSynthesisInput).mockReset().mockReturnValue(capInput);
  vi.mocked(synthesizeCaptainPick).mockReset().mockResolvedValue(fakeCap);
});

describe("runDemoPlanInsights — captaincy only", () => {
  it("returns the captaincy with null transfers", async () => {
    const ins = await runDemoPlanInsights({ freeTransfers: 1 });
    expect(ins.captaincy).toBe(fakeCap);
    expect(ins.transfers).toBeNull();
  });

  it("never invokes the optimizer (no transfer/chip/long-term work)", async () => {
    await runDemoPlanInsights({ freeTransfers: 1 });
    expect(runOptimizerWithContext).not.toHaveBeenCalled();
  });

  it("synthesizes the captain with the demo flag", async () => {
    await runDemoPlanInsights({ freeTransfers: 1 });
    expect(vi.mocked(synthesizeCaptainPick).mock.calls[0][1]).toEqual({ demo: true });
  });
});

describe("runDemoPlanBase", () => {
  it("builds from the demo context, marks teamId 0, and surfaces the season", async () => {
    const plan = await runDemoPlanBase({ freeTransfers: 1 });
    expect(getCachedDemoContext).toHaveBeenCalled();
    expect(plan.teamId).toBe(0);
    expect(plan.transfers).toBeNull();
    expect(plan.demoSeason).toBe("offseason");
    expect(Array.isArray(plan.squad)).toBe(true);
  });
});
