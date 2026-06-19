import { describe, it, expect } from "vitest";
import { evaluateHitTransfers } from "../../optimizer/hit-transfer";
import type { ValidTransfer, SingleTransferResult } from "../../optimizer/types";
import { makeScoredPlayer } from "../factories";

interface VtOpts {
  gw5?: number;
  weakTeam?: number;
  candTeam?: number;
}
function vt(weakId: number, candId: number, gw1: number, o: VtOpts = {}): ValidTransfer {
  return {
    weakPlayer: makeScoredPlayer({ player: { id: weakId, webName: `W${weakId}`, teamId: o.weakTeam ?? weakId } }),
    candidate: makeScoredPlayer({ player: { id: candId, webName: `C${candId}`, teamId: o.candTeam ?? candId } }),
    priceDelta: 0,
    gw1Gain: gw1,
    gw5Gain: o.gw5 ?? gw1,
    scoreDiffPct: 0,
  };
}

const noSingle: SingleTransferResult = {
  bestSingle: null, bestSecond: null, alternatives: [], savingsOption: null, rollReason: null, holdReason: null,
};
const counts = (m: Record<number, number> = {}) => new Map<number, number>(Object.entries(m).map(([k, v]) => [Number(k), v]));

describe("evaluateHitTransfers — single hit", () => {
  it("recommends a single hit above the −4 threshold with break-even", () => {
    const r = evaluateHitTransfers([vt(1, 2, 5.5, { gw5: 2 })], 2, counts(), 1, noSingle);
    expect(r.singleHit).not.toBeNull();
    expect(r.singleHit!.netGain).toBeCloseTo(1.5);
    expect(r.singleHit!.transfers).toHaveLength(1);
    expect(r.singleHit!.breakEvenGw).toBe(2); // ceil(4/2)
  });

  it("returns null when no transfer beats the −4 threshold", () => {
    expect(evaluateHitTransfers([vt(1, 2, 3.9)], 2, counts(), 1, noSingle).singleHit).toBeNull();
  });

  it("excludes transfers already consumed as free", () => {
    const used = vt(1, 2, 9);
    const single: SingleTransferResult = { ...noSingle, bestSingle: used };
    const r = evaluateHitTransfers([used, vt(5, 6, 5.5)], 2, counts(), 1, single);
    expect(r.singleHit!.transfers[0].candidate.player.id).toBe(6); // not the consumed 1→2
  });
});

describe("evaluateHitTransfers — double hit", () => {
  it("recommends a double hit when combined gain exceeds −8", () => {
    const r = evaluateHitTransfers([vt(1, 2, 5), vt(3, 4, 5)], 5, counts(), 1, noSingle);
    expect(r.doubleHit).not.toBeNull();
    expect(r.doubleHit!.netGain).toBeCloseTo(2); // 10 - 8
    expect(r.doubleHit!.transfers).toHaveLength(2);
  });

  it("returns null when combined gain does not exceed −8", () => {
    expect(evaluateHitTransfers([vt(1, 2, 4), vt(3, 4, 4)], 5, counts(), 1, noSingle).doubleHit).toBeNull();
  });

  it("never pairs two transfers for the same weak player", () => {
    const r = evaluateHitTransfers([vt(1, 2, 5), vt(1, 3, 5)], 5, counts(), 1, noSingle);
    expect(r.doubleHit).toBeNull();
  });

  it("rejects a pair that would breach the 3-per-club rule after both buys", () => {
    // Both candidates join team 9, which already has 2; neither weak is from team 9.
    const r = evaluateHitTransfers(
      [vt(1, 2, 6, { weakTeam: 1, candTeam: 9 }), vt(3, 4, 6, { weakTeam: 3, candTeam: 9 })],
      5, counts({ 9: 2 }), 1, noSingle
    );
    expect(r.doubleHit).toBeNull();
  });
});
