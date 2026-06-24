import { describe, it, expect } from "vitest";
import { evaluateChipInteractions } from "../../optimizer/chip-interaction";
import type { ValidTransfer, SingleTransferResult, HitTransferResult } from "../../optimizer/types";
import type { Fixture } from "../../types";
import {
  makeScoredPlayer, makeSquadAnalysisResult, makeManagerProfile, makeChips,
  makeGameweekFlags, makeBgw, makeFixture,
} from "../factories";

const noSingle: SingleTransferResult = { freeMoves: [], bestSingle: null, bestSecond: null, alternatives: [], savingsOption: null, rollReason: null, holdReason: null };
const noHit: HitTransferResult = { singleHit: null, doubleHit: null };

function beneficial(n: number): ValidTransfer[] {
  return Array.from({ length: n }, (_, i) => ({
    weakPlayer: makeScoredPlayer({ player: { id: i + 1 } }),
    candidate: makeScoredPlayer({ player: { id: 100 + i } }),
    priceDelta: 0, gw1Gain: 0.2, gw5Gain: 0.2, scoreDiffPct: 10,
  }));
}

/** Hard fixtures (FDR 5 at home) for the given teams across the given gameweeks. */
function hardFixtures(teamIds: number[], gws: number[]): Fixture[] {
  const f: Fixture[] = [];
  for (const gw of gws) for (const t of teamIds) {
    f.push(makeFixture({ event: gw, team_h: t, team_a: 99, team_h_difficulty: 5, team_a_difficulty: 2 }));
  }
  return f;
}

describe("evaluateChipInteractions — wildcard", () => {
  it("opens a window on a fixture swing (hard XI run), as a window with a draft", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }), // squad teams 1..5
      makeManagerProfile({ chipsRemaining: makeChips({ wildcard: 1 }) }),
      beneficial(3), [], noSingle, noHit,
      hardFixtures([1, 2, 3, 4, 5], [20, 21, 22, 23])
    );
    const wc = recs.find((r) => r.chip === "wildcard");
    expect(wc).toBeDefined();
    expect(wc!.status).toBe("window"); // never auto-activates (N2)
    expect(wc!.draft?.length).toBe(3); // the canonical wildcard draft
    expect(wc!.reason).toMatch(/fixture run|swing/i);
  });

  it("opens a window to set up a near Double Gameweek", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }),
      makeManagerProfile({ chipsRemaining: makeChips({ wildcard: 1 }) }),
      beneficial(3),
      [makeGameweekFlags({ gameweek: 22, isDGW: true, doubleTeams: [1, 2, 3, 4] })],
      noSingle, noHit, []
    );
    const wc = recs.find((r) => r.chip === "wildcard");
    expect(wc).toBeDefined();
    expect(wc!.reason).toMatch(/double/i);
  });

  it("does NOT open on upgrade count alone (no swing or DGW)", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }),
      makeManagerProfile({ chipsRemaining: makeChips({ wildcard: 1 }) }),
      beneficial(5), [], noSingle, noHit, [] // no fixtures, no flags
    );
    expect(recs.find((r) => r.chip === "wildcard")).toBeUndefined();
  });

  it("does not open without enough targets to rebuild into", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }),
      makeManagerProfile({ chipsRemaining: makeChips({ wildcard: 1 }) }),
      beneficial(2), [], noSingle, noHit,
      hardFixtures([1, 2, 3, 4, 5], [20, 21, 22, 23]) // swing present, but draft < 3
    );
    expect(recs.find((r) => r.chip === "wildcard")).toBeUndefined();
  });
});

describe("evaluateChipInteractions — windows: expiry pressure + season-wide", () => {
  it("raises expiry urgency as a half-deadline nears with an unused chip", () => {
    // currentGw 16 → first-half deadline GW19 is 3 GWs away (≤ 4) → pressure.
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 16 }),
      makeManagerProfile({ chipsRemaining: makeChips({ freeHit: 1 }) }),
      [], [makeBgw([1, 2, 3], 18)], noSingle, noHit, []
    );
    const fh = recs.find((r) => r.chip === "freeHit");
    expect(fh).toBeDefined();
    expect(fh!.reason).toMatch(/expires gw19/i);
  });

  it("detects a Double Gameweek beyond the near term (season-wide look-ahead)", () => {
    const rankedSquad = Array.from({ length: 15 }, () => makeScoredPlayer({ total: 0.5 }));
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20, rankedSquad }),
      makeManagerProfile({ chipsRemaining: makeChips({ benchBoost: 1 }) }),
      [], [makeGameweekFlags({ gameweek: 28, isDGW: true, doubleTeams: [1, 2, 3, 4] })], // 8 GWs ahead
      noSingle, noHit, []
    );
    const bb = recs.find((r) => r.chip === "benchBoost");
    expect(bb).toBeDefined();
    expect(bb!.triggerGw).toBe(28);
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
