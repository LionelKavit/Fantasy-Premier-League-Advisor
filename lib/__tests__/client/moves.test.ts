import { describe, it, expect } from "vitest";
import { buildVerdict } from "../../client/moves";
import type { GameweekPlan } from "../../plan/types";

// Minimal plan factory — buildVerdict only reads a handful of fields, so we cast
// partial shapes rather than build full pipeline objects.
function plan(overrides: Partial<GameweekPlan>): GameweekPlan {
  return {
    currentGw: 10,
    transfers: null,
    captaincy: null,
    squad: [],
    chipsRemaining: { wildcard: 1, freeHit: 1, benchBoost: 1, tripleCaptain: 1 },
    ...overrides,
  } as unknown as GameweekPlan;
}

function move(outName: string, candName: string, gw1Gain = 5) {
  return {
    weakPlayer: { player: { id: 1, webName: outName } },
    candidate: { player: { webName: candName } },
    gw1Gain,
  };
}

describe("buildVerdict", () => {
  it("renders a concrete transfer move", () => {
    const v = buildVerdict(
      plan({
        transfers: {
          primaryRecommendation: { type: "FREE", transfers: [move("João Pedro", "Saka")] },
          chipPlan: [],
        } as unknown as GameweekPlan["transfers"],
        captaincy: {
          captain: { player: { player: { webName: "Haaland" } } },
        } as unknown as GameweekPlan["captaincy"],
      })
    );
    expect(v.transfer).toBe("João Pedro → Saka");
    expect(v.captain).toBe("Haaland");
    expect(v.chip).toBe("Hold your chips");
  });

  it("expresses a hold as 'Roll your transfer'", () => {
    const v = buildVerdict(
      plan({
        transfers: {
          primaryRecommendation: { type: "ROLL", transfers: [] },
          chipPlan: [],
        } as unknown as GameweekPlan["transfers"],
      })
    );
    expect(v.transfer).toBe("Roll your transfer");
  });

  it("a transfer chip (Wildcard) fills the transfer segment, no separate chip segment", () => {
    const v = buildVerdict(
      plan({
        currentGw: 10,
        transfers: {
          primaryRecommendation: { type: "ROLL", transfers: [] },
          // Wildcard carries a draft → it IS the transfer plan.
          chipPlan: [
            { chip: "wildcard", status: "play-now", triggerGw: 10, draft: [move("X", "Y")] },
          ],
        } as unknown as GameweekPlan["transfers"],
      })
    );
    expect(v.transfer).toBe("Play your Wildcard");
    expect(v.chip).toBe("");
  });

  it("a draftless chip (Bench Boost) coexists with the transfer move", () => {
    const v = buildVerdict(
      plan({
        currentGw: 10,
        transfers: {
          primaryRecommendation: { type: "FREE", transfers: [move("João Pedro", "Watkins")] },
          chipPlan: [{ chip: "benchBoost", status: "play-now", triggerGw: 10, draft: null }],
        } as unknown as GameweekPlan["transfers"],
      })
    );
    expect(v.transfer).toBe("João Pedro → Watkins"); // the normal transfer still shows
    expect(v.chip).toBe("Play your Bench Boost"); // chip announced separately
  });

  it("a draftless chip with no concrete move shows the roll + the chip", () => {
    const v = buildVerdict(
      plan({
        currentGw: 10,
        transfers: {
          primaryRecommendation: { type: "ROLL", transfers: [] },
          chipPlan: [{ chip: "tripleCaptain", status: "play-now", triggerGw: 10, draft: null }],
        } as unknown as GameweekPlan["transfers"],
      })
    );
    expect(v.transfer).toBe("Roll your transfer");
    expect(v.chip).toBe("Play your Triple Captain");
  });

  it("never uses the provisional base armband for the captain", () => {
    // No final captaincy yet — buildVerdict must NOT fall back to the squad's
    // deterministic isCaptainRec flag (that pick can change after the optimizer).
    const v = buildVerdict(
      plan({
        transfers: null,
        captaincy: null,
        squad: [
          { webName: "Salah", isCaptainRec: true },
        ] as unknown as GameweekPlan["squad"],
      })
    );
    expect(v.captain).toBeNull();
    expect(v.transfer).toBe("Transfer analysis unavailable");
  });

  it("reports no chips left when none remain", () => {
    const v = buildVerdict(
      plan({
        transfers: {
          primaryRecommendation: { type: "ROLL", transfers: [] },
          chipPlan: [],
        } as unknown as GameweekPlan["transfers"],
        chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 },
      })
    );
    expect(v.chip).toBe("No chips left");
  });
});
