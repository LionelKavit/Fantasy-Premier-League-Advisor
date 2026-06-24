import { describe, it, expect } from "vitest";
import { evaluateChipInteractions } from "../../optimizer/chip-interaction";
import type { ValidTransfer, SingleTransferResult, HitTransferResult } from "../../optimizer/types";
import {
  makeScoredPlayer, makeSquadAnalysisResult, makeManagerProfile, makeChips,
  makeGameweekFlags, makeInjuredPlayer,
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

const FINAL_GW = 38; // season-end chip deadline

describe("evaluateChipInteractions — last-call windows on the deadline gameweek", () => {
  it("surfaces Bench Boost on the final GW with a scoring bench and no DGW", () => {
    // Default squad scores 0.8..0.24 (descending) → bench (12–15) all positive.
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: FINAL_GW }),
      makeManagerProfile({ chipsRemaining: makeChips({ benchBoost: 1 }) }),
      [], [], noSingle, noHit, [] // no fixtures, no flags
    );
    const bb = recs.find((r) => r.chip === "benchBoost");
    expect(bb).toBeDefined();
    expect(bb!.status).toBe("window"); // never auto-activates (N2)
    expect(bb!.triggerGw).toBe(FINAL_GW);
    expect(bb!.reason).toMatch(/final chance/i);
    expect(bb!.reason).toMatch(/expires gw38/i); // applyExpiryPressure tail
  });

  it("surfaces Triple Captain on the final GW", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: FINAL_GW }),
      makeManagerProfile({ chipsRemaining: makeChips({ tripleCaptain: 1 }) }),
      [], [], noSingle, noHit, []
    );
    const tc = recs.find((r) => r.chip === "tripleCaptain");
    expect(tc).toBeDefined();
    expect(tc!.status).toBe("window");
    expect(tc!.triggerGw).toBe(FINAL_GW);
  });

  it("surfaces Free Hit on the final GW only when a starter is unavailable", () => {
    // Injure the top player (rankedSquad[0] → pick position 1 → in the XI).
    const rankedSquad = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({
        total: 0.5,
        player: i === 0 ? makeInjuredPlayer({ id: 1, teamId: 1 }) : { id: i + 1, teamId: (i % 5) + 1 },
      })
    );
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: FINAL_GW, rankedSquad }),
      makeManagerProfile({ chipsRemaining: makeChips({ freeHit: 1 }) }),
      [], [], noSingle, noHit, []
    );
    const fh = recs.find((r) => r.chip === "freeHit");
    expect(fh).toBeDefined();
    expect(fh!.triggerGw).toBe(FINAL_GW);
    expect(fh!.reason).toMatch(/won't play/i);
  });

  it("does NOT surface Free Hit on the final GW when the XI is fully fit", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: FINAL_GW }), // default squad all available
      makeManagerProfile({ chipsRemaining: makeChips({ freeHit: 1 }) }),
      [], [], noSingle, noHit, []
    );
    expect(recs.find((r) => r.chip === "freeHit")).toBeUndefined();
  });

  it("emits nothing on an ordinary gameweek with no future fixtures", () => {
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20 }),
      makeManagerProfile({ chipsRemaining: makeChips({ benchBoost: 1, tripleCaptain: 1, freeHit: 1, wildcard: 1 }) }),
      beneficial(3), [], noSingle, noHit, [] // not the deadline, no fixtures/flags
    );
    expect(recs).toHaveLength(0);
  });

  it("does not duplicate a chip that already has a fixture window", () => {
    // A real DGW at GW38 gives Bench Boost a fixture window; last-call must not add a second.
    const rankedSquad = Array.from({ length: 15 }, () => makeScoredPlayer({ total: 0.5 }));
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: FINAL_GW, rankedSquad }),
      makeManagerProfile({ chipsRemaining: makeChips({ benchBoost: 1 }) }),
      [], [makeGameweekFlags({ gameweek: FINAL_GW, isDGW: true, doubleTeams: [1, 2, 3, 4] })],
      noSingle, noHit, []
    );
    expect(recs.filter((r) => r.chip === "benchBoost")).toHaveLength(1);
  });
});
