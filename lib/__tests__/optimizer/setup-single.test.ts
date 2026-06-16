import { describe, it, expect } from "vitest";
import { validateTransfer } from "../../optimizer/setup";
import { evaluateSingleTransfer } from "../../optimizer/single-transfer";
import type { ValidTransfer } from "../../optimizer/types";
import { makeScoredPlayer, makeManagerProfile, makeSquadAnalysisResult } from "../factories";

const counts = (m: Record<number, number> = {}) => new Map<number, number>(Object.entries(m).map(([k, v]) => [Number(k), v]));

describe("validateTransfer", () => {
  it("passes within budget and computes priceDelta", () => {
    const weak = makeScoredPlayer({ player: { price: 6.5 } });
    const cand = makeScoredPlayer({ total: 0.7, player: { price: 8.0, teamId: 2 } });
    const vt = validateTransfer(weak, cand, 2.0, counts());
    expect(vt).not.toBeNull();
    expect(vt!.priceDelta).toBeCloseTo(1.5);
  });

  it("rejects over-budget transfers", () => {
    const weak = makeScoredPlayer({ player: { price: 6.0 } });
    const cand = makeScoredPlayer({ player: { price: 10.0, teamId: 2 } });
    expect(validateTransfer(weak, cand, 1.0, counts())).toBeNull();
  });

  it("enforces the 3-per-club rule but allows sell-frees-slot", () => {
    const weakOther = makeScoredPlayer({ player: { teamId: 1, price: 7 } });
    const weakSame = makeScoredPlayer({ player: { teamId: 3, price: 7 } });
    const cand = makeScoredPlayer({ player: { teamId: 3, price: 7 } });
    expect(validateTransfer(weakOther, cand, 5, counts({ 3: 3 }))).toBeNull();
    expect(validateTransfer(weakSame, cand, 5, counts({ 3: 3 }))).not.toBeNull();
  });

  it("rejects unavailable candidates", () => {
    const weak = makeScoredPlayer({ player: { price: 7 } });
    for (const status of ["injured", "suspended", "unavailable"] as const) {
      const cand = makeScoredPlayer({ player: { price: 7, teamId: 2, availability: { status, chanceOfPlayingThis: null, chanceOfPlayingNext: null, news: "", newsAdded: null, scoutRisks: null, scoutNewsLink: null } } });
      expect(validateTransfer(weak, cand, 1, counts())).toBeNull();
    }
  });

  it("uses supplied gains when given, else composite diff; handles zero weak score", () => {
    const weak = makeScoredPlayer({ total: 0.4, player: { price: 6 } });
    const cand = makeScoredPlayer({ total: 0.65, player: { price: 6, teamId: 2 } });
    const withGains = validateTransfer(weak, cand, 1, counts(), { gw1Gain: 2.2, gw5Gain: 3.3 });
    expect(withGains!.gw1Gain).toBe(2.2);
    expect(withGains!.gw5Gain).toBe(3.3);
    expect(withGains!.scoreDiffPct).toBeCloseTo(((0.65 - 0.4) / 0.4) * 100);

    const noGains = validateTransfer(weak, cand, 1, counts());
    expect(noGains!.gw1Gain).toBeCloseTo(0.25);

    const zeroWeak = makeScoredPlayer({ total: 0, player: { price: 6 } });
    expect(validateTransfer(zeroWeak, cand, 1, counts())!.scoreDiffPct).toBe(0);
  });
});

function vt(weakId: number, candId: number, gw1: number, gw5 = gw1, priceDelta = 0): ValidTransfer {
  return {
    weakPlayer: makeScoredPlayer({ player: { id: weakId, webName: `W${weakId}` } }),
    candidate: makeScoredPlayer({ player: { id: candId, webName: `C${candId}` } }),
    priceDelta,
    gw1Gain: gw1,
    gw5Gain: gw5,
    scoreDiffPct: 0,
  };
}

const mp = makeManagerProfile();

describe("evaluateSingleTransfer", () => {
  it("recommends ROLL when there are no valid transfers", () => {
    const r = evaluateSingleTransfer([], mp, 1);
    expect(r.bestSingle).toBeNull();
    expect(r.rollReason).toMatch(/no valid transfer targets/i);
  });

  it("recommends ROLL when all gains are non-positive", () => {
    const r = evaluateSingleTransfer([vt(1, 2, 0), vt(3, 4, -1)], mp, 1);
    expect(r.bestSingle).toBeNull();
    expect(r.rollReason).toMatch(/no transfer improves/i);
  });

  it("picks the best by gw1Gain with up to 3 alternatives", () => {
    const r = evaluateSingleTransfer([vt(1, 2, 5), vt(3, 4, 3), vt(5, 6, 2), vt(7, 8, 1), vt(9, 10, 0.5)], mp, 1);
    expect(r.bestSingle?.gw1Gain).toBe(5);
    expect(r.alternatives).toHaveLength(3);
    expect(r.alternatives.map((a) => a.gw1Gain)).toEqual([3, 2, 1]);
  });

  it("breaks ties on gw5Gain", () => {
    const r = evaluateSingleTransfer([vt(1, 2, 5, 1), vt(3, 4, 5, 4)], mp, 1);
    expect(r.bestSingle?.candidate.player.id).toBe(4);
  });

  it("surfaces a savings option (cheaper by ≥0.5 with gw1Gain > -0.05)", () => {
    const r = evaluateSingleTransfer([vt(1, 2, 3), vt(3, 4, -0.02, -0.02, -1.0)], mp, 1);
    expect(r.savingsOption?.candidate.player.id).toBe(4);
  });

  it("returns a second free transfer for a different weak player when freeTransfers=2", () => {
    const list = [vt(1, 2, 5), vt(1, 3, 4), vt(9, 10, 3)];
    const two = evaluateSingleTransfer(list, mp, 2);
    expect(two.bestSingle?.weakPlayer.player.id).toBe(1);
    expect(two.bestSecond?.weakPlayer.player.id).toBe(9); // different weak player
    const one = evaluateSingleTransfer(list, mp, 1);
    expect(one.bestSecond).toBeNull();
  });

  it("unlocks a second transfer using budget freed by the first (cascade)", () => {
    // Best single sells a £9.0m player for a £6.0m one → frees £3.0m.
    const bestSingle: ValidTransfer = {
      weakPlayer: makeScoredPlayer({ player: { id: 1, teamId: 1, price: 9.0 } }),
      candidate: makeScoredPlayer({ total: 0.8, player: { id: 2, teamId: 2, price: 6.0 } }),
      priceDelta: -3.0, gw1Gain: 5, gw5Gain: 5, scoreDiffPct: 50,
    };
    // Weak B's only target (£9.0m) is over budget at bank £1.0m, but affordable
    // after the £3.0m is freed (adjusted bank £4.0m; 9 ≤ 5 + 4).
    const weakB = makeScoredPlayer({ total: 0.3, player: { id: 3, teamId: 3, price: 5.0 } });
    const dream = makeScoredPlayer({ total: 0.7, player: { id: 4, teamId: 4, price: 9.0 } });
    const analysis = makeSquadAnalysisResult({
      bank: 1.0,
      weakest3: [
        { player: bestSingle.weakPlayer, whyWeak: ["x"], targets: [] },
        { player: weakB, whyWeak: ["x"], targets: [{ candidate: dream, gw1Gain: 4, gw5Gain: 4, fitsBudget: false, restructureNeeded: true }] },
        { player: makeScoredPlayer({ total: 0.31 }), whyWeak: ["x"], targets: [] },
      ],
    });

    const cascade = evaluateSingleTransfer([bestSingle], mp, 2, analysis, 1.0, counts());
    expect(cascade.bestSecond?.candidate.player.id).toBe(4); // unlocked only by freed budget

    // Without the analysis/bank context, the over-budget target stays hidden.
    const noContext = evaluateSingleTransfer([bestSingle], mp, 2);
    expect(noContext.bestSecond).toBeNull();
  });
});
