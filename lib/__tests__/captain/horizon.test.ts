import { describe, it, expect } from "vitest";
import { computeCaptainHorizon, deriveTripleCaptainAdvice } from "../../captain/horizon";
import type { HorizonCaptainEntry } from "../../captain/types";
import { makeScoredPlayer, makePick, makeTeam, makeFixture, makeCaptainCandidate } from "../factories";

const teams = [makeTeam({ id: 1 }), makeTeam({ id: 2 }), makeTeam({ id: 3 })];

function xi() {
  const squad = Array.from({ length: 11 }, (_, i) => makeScoredPlayer({ player: { id: i + 1, teamId: 1, position: "MID" } }));
  const picks = squad.map((sp, i) => makePick({ element: sp.player.id, position: i + 1 }));
  return { squad, picks };
}

describe("computeCaptainHorizon", () => {
  it("produces an entry per upcoming GW and flags a DGW peak", () => {
    const { squad, picks } = xi();
    const fixtures = [
      makeFixture({ event: 21, team_h: 1, team_a: 2, team_h_difficulty: 3 }),
      makeFixture({ event: 22, team_h: 1, team_a: 2, team_h_difficulty: 3 }),
      makeFixture({ event: 23, team_h: 1, team_a: 2, team_h_difficulty: 3 }),
      makeFixture({ event: 24, team_h: 1, team_a: 2, team_h_difficulty: 2 }),
      makeFixture({ event: 24, team_h: 1, team_a: 3, team_h_difficulty: 2 }), // DGW
      makeFixture({ event: 25, team_h: 1, team_a: 2, team_h_difficulty: 3 }),
    ];
    const entries = computeCaptainHorizon(squad, picks, fixtures, teams, 20, 5);
    expect(entries).toHaveLength(5);
    const dgw = entries.find((e) => e.gameweek === 24)!;
    const single = entries.find((e) => e.gameweek === 21)!;
    expect(dgw.isDgw).toBe(true);
    expect(dgw.bestScore).toBeGreaterThan(single.bestScore);
  });

  it("stops at the end of the season", () => {
    const { squad, picks } = xi();
    const fixtures = [makeFixture({ event: 38, team_h: 1, team_a: 2, team_h_difficulty: 3 })];
    const entries = computeCaptainHorizon(squad, picks, fixtures, teams, 37, 5);
    expect(entries).toHaveLength(1);
    expect(entries[0].gameweek).toBe(38);
  });
});

describe("deriveTripleCaptainAdvice", () => {
  const entry = (gw: number, score: number, isDgw: boolean): HorizonCaptainEntry => ({
    gameweek: gw,
    bestScore: score,
    isDgw,
    bestCaptain: makeCaptainCandidate({ total: score, isDgw, gameweek: gw }),
  });

  it("recommends when a peak clears the baseline margin", () => {
    const advice = deriveTripleCaptainAdvice([entry(22, 12, true)], 5, true);
    expect(advice.recommended).toBe(true);
    expect(advice.targetGw).toBe(22);
  });

  it("holds when no peak clears the margin", () => {
    expect(deriveTripleCaptainAdvice([entry(22, 6, false)], 10, true).recommended).toBe(false);
  });

  it("holds when the chip is unavailable", () => {
    expect(deriveTripleCaptainAdvice([entry(22, 99, true)], 1, false).recommended).toBe(false);
  });
});
