import { describe, it, expect } from "vitest";
import { computeHorizon } from "../../optimizer/horizon";
import type { ValidTransfer } from "../../optimizer/types";
import { makeScoredPlayer, makeTeam, makeFixture, makeStatisticalSignals } from "../factories";

const teams = [makeTeam({ id: 1 }), makeTeam({ id: 2 })];
const runFixtures = (gws: number[]) =>
  gws.map((gw) => makeFixture({ event: gw, team_h: 1, team_a: 2, team_h_difficulty: 3 }));

// Candidate clearly stronger than the weak player, both on team 1 (identical
// fixtures), so the gain is positive every gameweek → BUY_NOW.
function buyNowTransfer(): ValidTransfer {
  // The data-fit composite is dominated by FPL's `epNext` projection, so a
  // "clearly stronger" candidate is one that projects more points: high epNext +
  // strong form, low price. (Raw goalThreat/bonus/value carry negative weights —
  // they're per-point overvaluation corrections, not strength signals.)
  const candidate = makeScoredPlayer({
    total: 0.8,
    player: { id: 1, teamId: 1, minutes: 2000 },
    statisticalSignals: makeStatisticalSignals({ formSignal: 9, valueScore: 0.4 }),
    marketSignals: { epNextSignal: 0.9 },
  });
  const weakPlayer = makeScoredPlayer({
    total: 0.3,
    player: { id: 2, teamId: 1, minutes: 2000 },
    statisticalSignals: makeStatisticalSignals({ formSignal: 1, valueScore: 0.4 }),
    marketSignals: { epNextSignal: 0.1 },
  });
  return { weakPlayer, candidate, priceDelta: 0.5, gw1Gain: 0.5, gw5Gain: 0.5, scoreDiffPct: 50 };
}

describe("computeHorizon", () => {
  it("classifies a consistently-better candidate as BUY_NOW with 5 GW scores", () => {
    const entries = computeHorizon([buyNowTransfer()], runFixtures([21, 22, 23, 24, 25]), teams, 20);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.gwScores).toHaveLength(5);
    expect(e.cumulativeGain).toHaveLength(5);
    expect(e.timing).toBe("BUY_NOW");
    expect(["BUY_NOW", "WAIT", "BUY_NOW_SELL_LATER"]).toContain(e.timing);
  });

  it("pads cumulativeGain to length 5 near the end of the season", () => {
    const entries = computeHorizon([buyNowTransfer()], runFixtures([37, 38]), teams, 36);
    const e = entries[0];
    expect(e.gwScores).toHaveLength(2); // only GW37, GW38 remain
    expect(e.cumulativeGain).toHaveLength(5);
    // padded tail repeats the last real value
    expect(e.cumulativeGain[4]).toBe(e.cumulativeGain[1]);
  });

  it("limits horizon computation to the top 5 valid transfers", () => {
    const many = Array.from({ length: 7 }, (_, i) => {
      const t = buyNowTransfer();
      t.candidate.player.id = 100 + i;
      t.gw1Gain = 7 - i;
      return t;
    });
    const entries = computeHorizon(many, runFixtures([21, 22, 23, 24, 25]), teams, 20);
    expect(entries).toHaveLength(5);
  });
});
