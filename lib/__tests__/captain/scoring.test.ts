import { describe, it, expect } from "vitest";
import { computeCaptainScore, batchComputeCaptainScores } from "../../captain/scoring";
import { makeScoredPlayer, makeTeam, makeFixture, makePick, makeAvailability } from "../factories";

const teams = [makeTeam({ id: 1 }), makeTeam({ id: 2 }), makeTeam({ id: 3 })];
const homeFixture = (gw: number, fdr: number) => [makeFixture({ event: gw, team_h: 1, team_a: 2, team_h_difficulty: fdr })];

describe("computeCaptainScore", () => {
  it("ranks an explosive attacker above a high-floor defender (ceiling > floor)", () => {
    const attacker = makeScoredPlayer({
      total: 0.5,
      player: { id: 1, teamId: 1, position: "FWD", expectedGoalsPer90: 0.8, threat: 600, epNext: 7, setPieceDuties: { penalties: { order: 1, text: null }, corners: { order: null, text: null }, directFreekicks: { order: null, text: null } } },
    });
    const defender = makeScoredPlayer({
      total: 0.5,
      player: { id: 2, teamId: 1, position: "DEF", expectedGoalsPer90: 0, threat: 20, epNext: 3 },
    });
    const fx = homeFixture(21, 3);
    expect(computeCaptainScore(attacker, fx, teams, 21).total).toBeGreaterThan(
      computeCaptainScore(defender, fx, teams, 21).total
    );
  });

  it("gates out an unavailable player (minutes certainty 0 → total 0)", () => {
    const injured = makeScoredPlayer({ player: { teamId: 1, availability: makeAvailability({ status: "injured" }) } });
    expect(computeCaptainScore(injured, homeFixture(21, 2), teams, 21).total).toBe(0);
  });

  it("penalizes a doubtful starter relative to a nailed-on one", () => {
    const base = { id: 1, teamId: 1, position: "FWD" as const };
    const nailed = makeScoredPlayer({ player: { ...base } });
    const doubtful = makeScoredPlayer({ player: { ...base, availability: makeAvailability({ status: "doubtful", chanceOfPlayingNext: 40 }) } });
    const fx = homeFixture(21, 3);
    expect(computeCaptainScore(doubtful, fx, teams, 21).total).toBeLessThan(
      computeCaptainScore(nailed, fx, teams, 21).total
    );
  });

  it("rewards an easy home fixture over a hard away fixture", () => {
    const p = makeScoredPlayer({ player: { id: 1, teamId: 1, position: "MID" } });
    const easy = computeCaptainScore(p, [makeFixture({ event: 21, team_h: 1, team_a: 2, team_h_difficulty: 2 })], teams, 21);
    const hard = computeCaptainScore(p, [makeFixture({ event: 21, team_h: 2, team_a: 1, team_a_difficulty: 5 })], teams, 21);
    expect(easy.total).toBeGreaterThan(hard.total);
  });

  it("applies a DGW multiplier so two fixtures beat one", () => {
    const p = makeScoredPlayer({ player: { id: 1, teamId: 1, position: "MID" } });
    const single = computeCaptainScore(p, [makeFixture({ event: 21, team_h: 1, team_a: 2, team_h_difficulty: 3 })], teams, 21);
    const dgw = computeCaptainScore(p, [
      makeFixture({ event: 21, team_h: 1, team_a: 2, team_h_difficulty: 3 }),
      makeFixture({ event: 21, team_h: 1, team_a: 3, team_h_difficulty: 3 }),
    ], teams, 21);
    expect(dgw.isDgw).toBe(true);
    expect(dgw.total).toBeGreaterThan(single.total);
  });

  it("scores a blank gameweek as 0", () => {
    const p = makeScoredPlayer({ player: { id: 1, teamId: 1 } });
    expect(computeCaptainScore(p, [], teams, 21).total).toBe(0);
  });
});

describe("batchComputeCaptainScores", () => {
  it("scores only the starting XI (pick positions 1–11)", () => {
    const squad = Array.from({ length: 15 }, (_, i) => makeScoredPlayer({ player: { id: i + 1, teamId: 1 } }));
    const picks = squad.map((sp, i) => makePick({ element: sp.player.id, position: i + 1 }));
    const candidates = batchComputeCaptainScores(squad, picks, homeFixture(21, 3), teams, 21);
    expect(candidates).toHaveLength(11);
  });
});
