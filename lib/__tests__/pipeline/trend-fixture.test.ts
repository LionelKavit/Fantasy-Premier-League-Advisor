import { describe, it, expect } from "vitest";
import { computeTrendSignals } from "../../pipeline/trend-analyzer";
import { computeFixtureSignals } from "../../pipeline/fixture-analyzer";
import type { PlayerGameweekHistory } from "../../types";
import { makePlayer, makeTeam, makeFixture } from "../factories";

function gwHistory(o: Partial<PlayerGameweekHistory>): PlayerGameweekHistory {
  return {
    round: 1, total_points: 2, minutes: 90, goals_scored: 0, assists: 0,
    expected_goals: "0.2", expected_assists: "0.1", expected_goal_involvements: "0.3",
    expected_goals_conceded: "1.0", clean_sheets: 0, goals_conceded: 1, saves: 0,
    bonus: 0, bps: 10, influence: "10", creativity: "10", threat: "10", starts: 1,
    was_home: true, opponent_team: 2, value: 60, yellow_cards: 0, red_cards: 0,
    own_goals: 0, penalties_saved: 0, penalties_missed: 0, defensive_contribution: 2,
    transfers_balance: 0, selected: 0, transfers_in: 0, transfers_out: 0,
    ...o,
  };
}

describe("computeTrendSignals", () => {
  it("returns null classification with insufficient history (<3 GWs)", () => {
    const t = computeTrendSignals([gwHistory({ round: 1 }), gwHistory({ round: 2 })], []);
    expect(t.classification).toBeNull();
    expect(t.additive).toBe(0);
  });

  it("classifies a falling xG trend as SELL", () => {
    const hist = [
      gwHistory({ round: 1, expected_goals: "0.9" }),
      gwHistory({ round: 2, expected_goals: "0.6" }),
      gwHistory({ round: 3, expected_goals: "0.3" }),
      gwHistory({ round: 4, expected_goals: "0.1" }),
    ];
    const t = computeTrendSignals(hist, []);
    expect(t.classification).toBe("SELL");
    expect(t.additive).toBeLessThan(0);
  });

  it("classifies a rising xG trend with goals lagging as HIDDEN_GEM_BUY", () => {
    const hist = [
      gwHistory({ round: 1, expected_goals: "0.1", goals_scored: 0 }),
      gwHistory({ round: 2, expected_goals: "0.4", goals_scored: 0 }),
      gwHistory({ round: 3, expected_goals: "0.7", goals_scored: 0 }),
      gwHistory({ round: 4, expected_goals: "1.0", goals_scored: 0 }),
    ];
    const t = computeTrendSignals(hist, []);
    expect(t.classification).toBe("HIDDEN_GEM_BUY");
    expect(t.additive).toBeGreaterThan(0);
  });

  it("classifies a rising trend with goals tracking xG (small gap) as BUY", () => {
    const hist = [
      gwHistory({ round: 1, expected_goals: "0.1", goals_scored: 0 }),
      gwHistory({ round: 2, expected_goals: "0.2", goals_scored: 0 }),
      gwHistory({ round: 3, expected_goals: "0.3", goals_scored: 1 }),
      gwHistory({ round: 4, expected_goals: "0.4", goals_scored: 0 }),
      gwHistory({ round: 5, expected_goals: "0.5", goals_scored: 1 }),
    ]; // xg avg 0.3 (rising), goals avg 0.4 → gap 0.1 ≤ 0.15
    const t = computeTrendSignals(hist, []);
    expect(t.classification).toBe("BUY");
    expect(t.additive).toBeGreaterThan(0);
  });

  it("adds a finisher premium for a consistent past overperformer", () => {
    const flat = [
      gwHistory({ round: 1, expected_goals: "0.3", goals_scored: 0 }),
      gwHistory({ round: 2, expected_goals: "0.3", goals_scored: 0 }),
      gwHistory({ round: 3, expected_goals: "0.3", goals_scored: 0 }),
    ];
    const past = [
      { season_name: "22/23", total_points: 200, minutes: 3000, goals_scored: 20, expected_goals: "15.0", assists: 5, expected_assists: "4.0", starts: 34, start_cost: 100, end_cost: 110 },
      { season_name: "23/24", total_points: 210, minutes: 3000, goals_scored: 22, expected_goals: "16.0", assists: 6, expected_assists: "5.0", starts: 35, start_cost: 110, end_cost: 120 },
      { season_name: "24/25", total_points: 220, minutes: 3000, goals_scored: 24, expected_goals: "18.0", assists: 7, expected_assists: "6.0", starts: 36, start_cost: 120, end_cost: 130 },
    ];
    const t = computeTrendSignals(flat, past);
    expect(t.finisherPremium).toBe(true);
    expect(t.additive).toBeGreaterThan(0);
  });
});

describe("computeFixtureSignals", () => {
  const teams = [makeTeam({ id: 1 }), makeTeam({ id: 2 }), makeTeam({ id: 3 })];

  it("returns worst-case defaults when there are no upcoming fixtures", () => {
    const s = computeFixtureSignals(makePlayer({ teamId: 1 }), [], teams, 20);
    expect(s.gw1Fdr).toBe(5);
    expect(s.hasBgw).toBe(false);
    expect(s.hasDgw).toBe(false);
  });

  it("flags a double gameweek and averages both fixtures", () => {
    const fixtures = [
      makeFixture({ event: 20, team_h: 1, team_a: 2, team_h_difficulty: 2 }),
      makeFixture({ event: 20, team_h: 3, team_a: 1, team_a_difficulty: 2 }),
      makeFixture({ event: 21, team_h: 1, team_a: 2, team_h_difficulty: 3 }),
    ];
    const s = computeFixtureSignals(makePlayer({ teamId: 1 }), fixtures, teams, 20);
    expect(s.hasDgw).toBe(true);
    expect(s.dgwBonus).toBeGreaterThan(0);
  });

  it("flags a blank gameweek within the run", () => {
    // Team 1 plays GW20 and GW22 but not GW21 → blank in the 5-GW run.
    const fixtures = [
      makeFixture({ event: 20, team_h: 1, team_a: 2 }),
      makeFixture({ event: 22, team_h: 1, team_a: 3 }),
    ];
    const s = computeFixtureSignals(makePlayer({ teamId: 1 }), fixtures, teams, 20);
    expect(s.hasBgw).toBe(true);
  });

  it("maps an easy fixture run to a high fdrScore (in [0,1])", () => {
    const fixtures = [makeFixture({ event: 20, team_h: 1, team_a: 2, team_h_difficulty: 1 })];
    const s = computeFixtureSignals(makePlayer({ teamId: 1 }), fixtures, teams, 20);
    expect(s.fdrScore).toBeGreaterThan(0.5);
    expect(s.fdrScore).toBeLessThanOrEqual(1);
  });

  it("computes opponent strength for a defender (attack-strength branch)", () => {
    const fixtures = [makeFixture({ event: 20, team_h: 1, team_a: 2, team_h_difficulty: 3 })];
    const s = computeFixtureSignals(makePlayer({ teamId: 1, position: "DEF" }), fixtures, teams, 20);
    expect(s.opponentStrength).toBeGreaterThanOrEqual(0);
    expect(s.opponentStrength).toBeLessThanOrEqual(1);
  });
});
