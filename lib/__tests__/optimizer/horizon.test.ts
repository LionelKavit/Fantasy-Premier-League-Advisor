import { describe, it, expect } from "vitest";
import { computeHorizon, effectiveFdr } from "../../optimizer/horizon";
import type { ValidTransfer } from "../../optimizer/types";
import type { Position } from "../../types";
import { HORIZON_TIMING } from "../../config";
import { makeScoredPlayer, makeTeam, makeFixture, makeStatisticalSignals } from "../factories";

// horizon-fixture-timing: ranking stays composite gw1Gain; timing comes from the raw
// per-GW fixture edge; non-gainers are dropped; one entry per candidate, one per
// position first, backfilled to five.

const CAND_TEAM = 1;
const WEAK_TEAM = 2;
const OPP = 9;
const teams = [makeTeam({ id: CAND_TEAM }), makeTeam({ id: WEAK_TEAM }), makeTeam({ id: OPP })];
const GW = 20;

/** One home fixture per listed GW for `teamId` with the given difficulties (null = blank; [a,b] = double). */
function fixturesFor(teamId: number, fdrs: (number | number[] | null)[]) {
  const out: ReturnType<typeof makeFixture>[] = [];
  fdrs.forEach((fdr, i) => {
    const gw = GW + i;
    if (fdr === null) return;
    for (const d of Array.isArray(fdr) ? fdr : [fdr]) {
      out.push(makeFixture({ event: gw, team_h: teamId, team_a: OPP, team_h_difficulty: d, team_a_difficulty: 3 }));
    }
  });
  return out;
}

// The data-fit composite is dominated by epNext, so "clearly stronger" = higher epNext
// signal + form; both sides get identical statistical inputs otherwise.
function transfer(o: {
  candId?: number; weakId?: number; position?: Position; gw1Gain?: number; strongerCandidate?: boolean;
} = {}): ValidTransfer {
  const stronger = o.strongerCandidate ?? true;
  const candidate = makeScoredPlayer({
    total: stronger ? 0.8 : 0.3,
    player: { id: o.candId ?? 1, teamId: CAND_TEAM, minutes: 2000, position: o.position ?? "MID" },
    statisticalSignals: makeStatisticalSignals({ formSignal: stronger ? 9 : 1, valueScore: 0.4 }),
    marketSignals: { epNextSignal: stronger ? 0.9 : 0.1 },
  });
  const weakPlayer = makeScoredPlayer({
    total: stronger ? 0.3 : 0.8,
    player: { id: o.weakId ?? 2, teamId: WEAK_TEAM, minutes: 2000, position: o.position ?? "MID" },
    statisticalSignals: makeStatisticalSignals({ formSignal: stronger ? 1 : 9, valueScore: 0.4 }),
    marketSignals: { epNextSignal: stronger ? 0.1 : 0.9 },
  });
  return { weakPlayer, candidate, priceDelta: 0.5, gw1Gain: o.gw1Gain ?? 0.5, gw5Gain: 0.5, scoreDiffPct: 50 };
}

const run = (vts: ValidTransfer[], cand: (number | number[] | null)[], weak: (number | number[] | null)[]) =>
  computeHorizon(vts, [...fixturesFor(CAND_TEAM, cand), ...fixturesFor(WEAK_TEAM, weak)], teams, GW);

describe("effectiveFdr", () => {
  it("single = FDR; double = mean − bonus; blank = penalty", () => {
    expect(effectiveFdr(3)).toBe(3);
    expect(effectiveFdr([3, 3])).toBe(3 - HORIZON_TIMING.dgwBonusSteps);
    expect(effectiveFdr(null)).toBe(HORIZON_TIMING.blankPenaltyFdr);
  });
});

describe("computeHorizon — timing from the fixture edge", () => {
  it("candidate's hard weeks come first ⇒ WAIT (spec scenario)", () => {
    const [e] = run([transfer()], [2, 5, 3, 2, 3], [3, 3, 3, 4, 3]);
    expect(e.fixtureEdge).toEqual([1, -2, 0, 2, 0]);
    expect(e.nearEdge).toBeCloseTo(-0.5, 6);
    expect(e.farEdge).toBeCloseTo(0.667, 3);
    expect(e.timing).toBe("WAIT");
  });

  it("candidate's edge fades ⇒ SHORT_TERM (spec scenario)", () => {
    const [e] = run([transfer()], [3, 3, 4, 5, 3], [3, 3, 4, 2, 4]);
    expect(e.fixtureEdge).toEqual([0, 0, 0, -3, 1]);
    expect(e.timing).toBe("SHORT_TERM");
  });

  it("identical fixtures ⇒ zero edge ⇒ BUY_NOW", () => {
    const [e] = run([transfer()], [3, 3, 3, 3, 3], [3, 3, 3, 3, 3]);
    expect(e.fixtureEdge).toEqual([0, 0, 0, 0, 0]);
    expect(e.timing).toBe("BUY_NOW");
    expect(e.cumulativeGain).toHaveLength(5);
    expect(e.cumulativeGain[4]).toBeGreaterThan(0);
  });

  it("candidate blanks in the target gameweek ⇒ WAIT regardless of later edges", () => {
    const [e] = run([transfer()], [null, 2, 2, 2, 2], [3, 5, 5, 5, 5]);
    expect(e.fixtureEdge[0]).toBe(3 - HORIZON_TIMING.blankPenaltyFdr);
    expect(e.timing).toBe("WAIT");
  });

  it("a double counts as its mean minus the bonus", () => {
    const [e] = run([transfer()], [3, [3, 3], 3, 3, 3], [3, 3, 3, 3, 3]);
    expect(e.fixtureEdge[1]).toBe(HORIZON_TIMING.dgwBonusSteps);
  });
});

describe("computeHorizon — level gate, dedupe, positional spread", () => {
  it("drops a swap that never gains instead of labelling it", () => {
    expect(run([transfer({ strongerCandidate: false })], [3, 3, 3, 3, 3], [3, 3, 3, 3, 3])).toHaveLength(0);
  });

  it("keeps only the highest-gain pairing for a candidate listed twice", () => {
    const a = transfer({ candId: 50, weakId: 2, gw1Gain: 0.5 });
    const b = transfer({ candId: 50, weakId: 3, gw1Gain: 0.6 });
    const entries = run([a, b], [3, 3, 3, 3, 3], [3, 3, 3, 3, 3]);
    expect(entries).toHaveLength(1);
    expect(entries[0].weakPlayer.player.id).toBe(3);
  });

  it("one per position first, then backfill to five (spec scenario)", () => {
    const spec: [Position, number][] = [["GK", 7], ["GK", 6], ["GK", 5], ["DEF", 4], ["MID", 3], ["FWD", 2], ["DEF", 1]];
    const vts = spec.map(([position, gw1Gain], i) => transfer({ candId: 100 + i, weakId: 200 + i, position, gw1Gain }));
    const entries = run(vts, [3, 3, 3, 3, 3], [3, 3, 3, 3, 3]);
    expect(entries.map((e) => e.candidate.player.position)).toEqual(["GK", "DEF", "MID", "FWD", "GK"]);
    expect(entries[4].candidate.player.id).toBe(101); // the second-best GK backfills
  });

  it("returns fewer than five when fewer qualify", () => {
    const vts = [transfer({ candId: 1, weakId: 2, gw1Gain: 0.5 }), transfer({ candId: 3, weakId: 4, gw1Gain: 0.4, strongerCandidate: false })];
    expect(run(vts, [3, 3, 3, 3, 3], [3, 3, 3, 3, 3])).toHaveLength(1);
  });

  it("near the end of the season the window shortens and cumulativeGain is padded", () => {
    const fixtures = [37, 38].flatMap((gw) => [
      makeFixture({ event: gw, team_h: CAND_TEAM, team_a: OPP, team_h_difficulty: 3 }),
      makeFixture({ event: gw, team_h: WEAK_TEAM, team_a: OPP, team_h_difficulty: 3 }),
    ]);
    const [e] = computeHorizon([transfer()], fixtures, teams, 37);
    expect(e.gwScores.map((g) => g.gw)).toEqual([37, 38]);
    expect(e.fixtureEdge).toHaveLength(2);
    expect(e.cumulativeGain).toHaveLength(5);
    expect(e.cumulativeGain[4]).toBe(e.cumulativeGain[1]);
    expect(e.farEdge).toBe(e.nearEdge); // no "far" gameweeks left
  });
});
