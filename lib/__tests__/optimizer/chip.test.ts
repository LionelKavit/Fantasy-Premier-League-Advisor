import { describe, it, expect } from "vitest";
import { evaluateChipInteractions } from "../../optimizer/chip-interaction";
import type { ValidTransfer, SingleTransferResult, HitTransferResult } from "../../optimizer/types";
import {
  makeScoredPlayer, makeSquadAnalysisResult, makeManagerProfile, makeChips,
  makeGameweekFlags, makeBgw,
} from "../factories";

const noSingle: SingleTransferResult = { bestSingle: null, bestSecond: null, alternatives: [], savingsOption: null, rollReason: null, holdReason: null };
const noHit: HitTransferResult = { singleHit: null, doubleHit: null };

function beneficial(n: number): ValidTransfer[] {
  return Array.from({ length: n }, (_, i) => ({
    weakPlayer: makeScoredPlayer({ player: { id: i + 1 } }),
    candidate: makeScoredPlayer({ player: { id: 100 + i } }),
    priceDelta: 0, gw1Gain: 0.2, gw5Gain: 0.2, scoreDiffPct: 10,
  }));
}

describe("evaluateChipInteractions — wildcard", () => {
  it("recommends wildcard with ≥3 beneficial transfers", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }),
      makeManagerProfile({ chipsRemaining: makeChips({ wildcard: 1 }) }),
      beneficial(3), [], noSingle, noHit, []
    );
    const wc = recs.find((r) => r.chip === "wildcard");
    expect(wc).toBeDefined();
    expect(wc!.alteredTransfers?.type).toBe("WILDCARD");
  });

  it("does not recommend wildcard with fewer than 3 beneficial transfers", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }),
      makeManagerProfile({ chipsRemaining: makeChips({ wildcard: 1 }) }),
      beneficial(2), [], noSingle, noHit, []
    );
    expect(recs.find((r) => r.chip === "wildcard")).toBeUndefined();
  });
});

describe("evaluateChipInteractions — free hit", () => {
  it("recommends free hit for a near BGW with ≥3 blanking squad players", () => {
    const analysis = makeSquadAnalysisResult({ currentGw: 20 }); // squad teams 1..5
    const recs = evaluateChipInteractions(
      analysis,
      makeManagerProfile({ chipsRemaining: makeChips({ freeHit: 1 }) }),
      [], [makeBgw([1, 2, 3], 22)], noSingle, noHit, []
    );
    const fh = recs.find((r) => r.chip === "freeHit");
    expect(fh).toBeDefined();
    expect(fh!.triggerGw).toBe(22);
  });
});

describe("evaluateChipInteractions — bench boost", () => {
  it("recommends bench boost when a near DGW meets the bench-strength threshold", () => {
    // 15 players all 0.5 → bench (picks 12–15) average 0.5 > 0.40.
    const rankedSquad = Array.from({ length: 15 }, () => makeScoredPlayer({ total: 0.5 }));
    const analysis = makeSquadAnalysisResult({ currentGw: 20, rankedSquad });
    const recs = evaluateChipInteractions(
      analysis,
      makeManagerProfile({ chipsRemaining: makeChips({ benchBoost: 1 }) }),
      [], [makeGameweekFlags({ gameweek: 22, isDGW: true, doubleTeams: [1, 2, 3, 4] })],
      noSingle, noHit, []
    );
    expect(recs.find((r) => r.chip === "benchBoost")).toBeDefined();
  });

  it("does not recommend bench boost with a weak bench", () => {
    const rankedSquad = Array.from({ length: 15 }, () => makeScoredPlayer({ total: 0.2 }));
    const analysis = makeSquadAnalysisResult({ currentGw: 20, rankedSquad });
    const recs = evaluateChipInteractions(
      analysis,
      makeManagerProfile({ chipsRemaining: makeChips({ benchBoost: 1 }) }),
      [], [makeGameweekFlags({ gameweek: 22, isDGW: true, doubleTeams: [1, 2, 3, 4] })],
      noSingle, noHit, []
    );
    expect(recs.find((r) => r.chip === "benchBoost")).toBeUndefined();
  });
});

describe("evaluateChipInteractions — conflicts and empty", () => {
  it("prefers wildcard and defers bench boost to the next DGW on conflict", () => {
    const rankedSquad = Array.from({ length: 15 }, () => makeScoredPlayer({ total: 0.5 }));
    const analysis = makeSquadAnalysisResult({ currentGw: 20, rankedSquad });
    const recs = evaluateChipInteractions(
      analysis,
      makeManagerProfile({ chipsRemaining: makeChips({ wildcard: 1, benchBoost: 1 }) }),
      beneficial(3),
      [
        makeGameweekFlags({ gameweek: 20, isDGW: true, doubleTeams: [1, 2, 3, 4] }),
        makeGameweekFlags({ gameweek: 22, isDGW: true, doubleTeams: [1, 2, 3, 4] }),
      ],
      noSingle, noHit, []
    );
    expect(recs.find((r) => r.chip === "wildcard")).toBeDefined();
    const bb = recs.find((r) => r.chip === "benchBoost");
    expect(bb?.triggerGw).toBe(22); // deferred off the wildcard week (20)
    expect(bb?.reason).toMatch(/defer/i);
  });

  it("returns an empty list when no chips remain", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }),
      makeManagerProfile({ chipsRemaining: makeChips() }),
      beneficial(5),
      [makeGameweekFlags({ gameweek: 21, isDGW: true, isBGW: true, doubleTeams: [1, 2, 3, 4], blankTeams: [1, 2, 3] })],
      noSingle, noHit, []
    );
    expect(recs).toHaveLength(0);
  });
});
