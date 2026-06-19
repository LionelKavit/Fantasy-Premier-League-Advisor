import { describe, it, expect } from "vitest";
import { buildSeasonRows } from "./build-dataset";
import type { SeasonData } from "./load";

// A synthetic 1-player season: distinct minutes/points per round so we can
// verify point-in-time aggregation (features use ONLY prior rounds) and that
// the label sums exactly GW N..N+2.
const PLAN: Record<number, { minutes: number; points: number }> = {
  1: { minutes: 90, points: 2 },
  2: { minutes: 60, points: 5 },
  3: { minutes: 90, points: 8 },
  4: { minutes: 45, points: 1 },
  5: { minutes: 90, points: 6 },
  6: { minutes: 90, points: 3 },
};

function row(gw: number): Record<string, string> {
  const p = PLAN[gw];
  return {
    element: "1", GW: String(gw), round: String(gw), position: "MID", team: "T",
    minutes: String(p.minutes), total_points: String(p.points), starts: p.minutes >= 60 ? "1" : "0",
    value: "50", xP: "0",
  };
}

function syntheticSeason(): SeasonData {
  const gwRows = Object.keys(PLAN).map((g) => row(Number(g)));
  const byRound = new Map<number, Record<string, string>[]>();
  for (const r of gwRows) byRound.set(Number(r.GW), [r]);
  return {
    season: "__test__", gwRows, byRound, fixtures: [], teams: [],
    teamById: new Map(), teamIdByName: new Map(),
    has: { xP: false, xg: false, starts: true, dc: false },
  };
}

describe("build-dataset point-in-time guarantees", () => {
  const rows = buildSeasonRows(syntheticSeason());
  const byGw = new Map(rows.map((r) => [r.gw as number, r]));

  it("emits rows only where >=2 prior GWs and a full next-3 window exist (GW 3,4)", () => {
    expect([...byGw.keys()].sort()).toEqual([3, 4]);
  });

  it("season_minutes uses ONLY prior gameweeks (no lookahead)", () => {
    expect(byGw.get(3)!.season_minutes).toBe(90 + 60);        // rounds 1,2
    expect(byGw.get(4)!.season_minutes).toBe(90 + 60 + 90);   // rounds 1,2,3 (not GW4)
  });

  it("next3_points sums exactly GW N..N+2 realized points", () => {
    expect(byGw.get(3)!.next3_points).toBe(8 + 1 + 6); // GW 3,4,5
    expect(byGw.get(4)!.next3_points).toBe(1 + 6 + 3); // GW 4,5,6
    expect(byGw.get(3)!.label_gws).toBe(3);
  });
});
