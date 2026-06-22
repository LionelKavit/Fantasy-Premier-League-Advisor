import { describe, it, expect } from "vitest";
import type { ScoredPlayer } from "../pipeline/types";
import type { OptimizerResult } from "../optimizer/types";
import type { CaptainResult } from "../captain/types";
import { computeRiskAlerts } from "../alerts";
import { makeSquadAnalysisResult, makeScoredPlayer, makePick, makeAvailability, makeCaptainCandidate } from "./factories";

const doubt = (id: number, webName: string) =>
  makeScoredPlayer({ player: { id, webName, availability: makeAvailability({ status: "doubtful", chanceOfPlayingNext: 50 }) } });

/** Place scored players into pick slots (≤11 = starting XI). */
function analysis(players: { sp: ScoredPlayer; slot: number }[]) {
  return makeSquadAnalysisResult({
    rankedSquad: players.map((x) => x.sp),
    picks: players.map((x) => makePick({ element: x.sp.player.id, position: x.slot })),
  });
}

describe("computeRiskAlerts", () => {
  it("flags a doubtful starter, ignores a doubtful bench player", () => {
    const a = analysis([
      { sp: doubt(1, "Star"), slot: 5 },
      { sp: doubt(2, "Benchy"), slot: 13 },
    ]);
    const alerts = computeRiskAlerts({ analysis: a, transfers: null, captaincy: null });
    expect(alerts.some((x) => /^Star is a doubt \(50% to play\)/.test(x))).toBe(true);
    expect(alerts.some((x) => /Benchy/.test(x))).toBe(false);
  });

  it("ranks captain then vice then others, with bespoke wording", () => {
    const a = analysis([
      { sp: doubt(1, "Cap"), slot: 9 },
      { sp: doubt(2, "Vice"), slot: 10 },
      { sp: doubt(3, "Other"), slot: 11 },
    ]);
    const captaincy = {
      captain: makeCaptainCandidate({ player: { player: { id: 1, webName: "Cap" } } }),
      viceCaptain: makeCaptainCandidate({ player: { player: { id: 2, webName: "Vice" } } }),
    } as unknown as CaptainResult;
    const alerts = computeRiskAlerts({ analysis: a, transfers: null, captaincy });
    expect(alerts[0]).toMatch(/^Captain Cap is a doubt/);
    expect(alerts[1]).toMatch(/^Vice-captain Vice is a doubt/);
    expect(alerts[2]).toMatch(/^Other is a doubt/);
  });

  it("returns nothing when the XI is fully available", () => {
    const fit = makeScoredPlayer({ player: { id: 1, webName: "Fit" } }); // default: available, chance null
    expect(computeRiskAlerts({ analysis: analysis([{ sp: fit, slot: 1 }]), transfers: null, captaincy: null })).toEqual([]);
  });

  it("flags an imminent price rise on a recommended target", () => {
    const target = makeScoredPlayer({ player: { id: 7, webName: "Target" }, marketSignals: { transferMomentum: 0.9 } });
    const transfers = {
      primaryRecommendation: { transfers: [{ candidate: target }] },
    } as unknown as OptimizerResult;
    const alerts = computeRiskAlerts({ analysis: analysis([]), transfers, captaincy: null });
    expect(alerts).toContain("Price rise likely for Target — act before the deadline.");
  });

  it("does not flag a target without strong momentum", () => {
    const target = makeScoredPlayer({ player: { id: 7, webName: "Calm" }, marketSignals: { transferMomentum: 0.2 } });
    const transfers = { primaryRecommendation: { transfers: [{ candidate: target }] } } as unknown as OptimizerResult;
    expect(computeRiskAlerts({ analysis: analysis([]), transfers, captaincy: null })).toEqual([]);
  });

  it("caps at four", () => {
    const players = Array.from({ length: 6 }, (_, i) => ({ sp: doubt(i + 1, `P${i + 1}`), slot: i + 1 }));
    const alerts = computeRiskAlerts({ analysis: analysis(players), transfers: null, captaincy: null });
    expect(alerts).toHaveLength(4);
  });
});
