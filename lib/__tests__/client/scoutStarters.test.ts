import { describe, it, expect } from "vitest";
import type { GameweekPlan } from "../../plan/types";
import type { OptimizerResult } from "../../optimizer/types";
import type { CaptainResult } from "../../captain/types";
import { buildScoutStarters } from "../../client/scoutStarters";

function plan(over: Partial<GameweekPlan>): GameweekPlan {
  return {
    teamId: 1,
    currentGw: 20,
    deadline: null,
    transfers: null,
    captaincy: null,
    squad: [],
    bank: 0,
    chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 },
    manager: { name: "M", overallRank: 1, teamName: "FC" },
    alerts: [],
    generatedAt: "",
    ...over,
  };
}

function transfers(moves: { out: string; in: string }[]): OptimizerResult {
  return {
    primaryRecommendation: {
      transfers: moves.map((m) => ({
        weakPlayer: { player: { webName: m.out } },
        candidate: { player: { webName: m.in } },
      })),
    },
  } as unknown as OptimizerResult;
}

function captaincy(cap: string, vice: string | null): CaptainResult {
  return {
    captain: { player: { player: { webName: cap } } },
    viceCaptain: vice ? { player: { player: { webName: vice } } } : null,
  } as unknown as CaptainResult;
}

describe("buildScoutStarters", () => {
  it("falls back to the generic four when there is no recommendation", () => {
    const s = buildScoutStarters(plan({}));
    expect(s).toHaveLength(4);
    expect(s[0]).toBe("Who should I captain this week?");
    expect(s).toContain("What's my best transfer right now?");
  });

  it("names the captain over the vice, and the actual transfer move", () => {
    const s = buildScoutStarters(
      plan({ captaincy: captaincy("Haaland", "Salah"), transfers: transfers([{ out: "Solanke", in: "Mateta" }]) })
    );
    expect(s[0]).toBe("Why Haaland over Salah?");
    expect(s[1]).toBe("Walk me through Solanke → Mateta");
    expect(s).toContain("Should I take a hit instead?");
    expect(s).toContain("Which of my players are at risk?");
  });

  it("uses 'why captain X' when vice is absent or equals the captain", () => {
    expect(buildScoutStarters(plan({ captaincy: captaincy("Haaland", null) }))[0]).toBe("Why captain Haaland?");
    expect(buildScoutStarters(plan({ captaincy: captaincy("Haaland", "Haaland") }))[0]).toBe("Why captain Haaland?");
  });

  it("asks whether to move at all when the rec holds (no transfers)", () => {
    const s = buildScoutStarters(plan({ transfers: transfers([]) }));
    expect(s[1]).toBe("Is there a transfer worth making?");
  });

  it("mixes contextual + fallback when only one side is present", () => {
    const s = buildScoutStarters(plan({ captaincy: captaincy("Saka", "Palmer") }));
    expect(s[0]).toBe("Why Saka over Palmer?");
    expect(s[1]).toBe("What's my best transfer right now?"); // transfer fallback
  });
});
