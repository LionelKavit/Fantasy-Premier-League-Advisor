import { describe, it, expect } from "vitest";
import { allocateFreeTransfers } from "../../optimizer/allocate";
import type { ValidTransfer, RestructureCandidate } from "../../optimizer/types";
import type { ScoredPlayer, WeakSpot } from "../../pipeline/types";
import { makeScoredPlayer } from "../factories";

// A squad/target player with explicit ep, price and club.
const P = (id: number, ep: number | null, price = 6, team = id): ScoredPlayer =>
  makeScoredPlayer({ total: 0.5, player: { id, webName: `P${id}`, epNext: ep, price, teamId: team } });

const swap = (weak: ScoredPlayer, cand: ScoredPlayer): ValidTransfer => ({
  weakPlayer: weak,
  candidate: cand,
  priceDelta: cand.player.price - weak.player.price,
  gw1Gain: cand.score.total - weak.score.total,
  gw5Gain: cand.score.total - weak.score.total,
  scoreDiffPct: 0,
});

const restructure = (dream: ValidTransfer, downgrade: ValidTransfer, netEp: number): RestructureCandidate => ({
  dreamTarget: dream,
  downgradeTransfer: downgrade,
  downgradedPlayer: downgrade.weakPlayer,
  downgradeReplacement: downgrade.candidate,
  netEp,
});

const counts = (m: Record<number, number> = {}) =>
  new Map<number, number>(Object.entries(m).map(([k, v]) => [Number(k), v]));

const noWeak: WeakSpot[] = [];
const ids = (moves: ValidTransfer[]) => moves.map((m) => m.candidate.player.id);

describe("allocateFreeTransfers", () => {
  it("picks the best swaps within the free-transfer budget (banks the rest)", () => {
    const a = swap(P(1, 2), P(101, 5, 6, 11)); // epGain 3, surplus 1.5
    const b = swap(P(2, 2), P(102, 4, 6, 12)); // epGain 2, surplus 0.5
    expect(ids(allocateFreeTransfers([a, b], [], noWeak, 2, 5, counts()))).toEqual([101, 102]);
    // One transfer → only the higher-surplus swap.
    expect(ids(allocateFreeTransfers([a, b], [], noWeak, 1, 5, counts()))).toEqual([101]);
  });

  it("excludes a swap that does not clear the free-transfer bar", () => {
    const marginal = swap(P(1, 2), P(101, 3, 6, 11)); // epGain 1.0 ≤ 1.5
    expect(allocateFreeTransfers([marginal], [], noWeak, 2, 5, counts())).toEqual([]);
  });

  it("chooses a restructure over two swaps when its surplus is higher", () => {
    const a = swap(P(1, 2), P(101, 3.6, 6, 11)); // surplus 0.1
    const b = swap(P(2, 2), P(102, 3.6, 6, 12)); // surplus 0.1  → 0.2 over 2 transfers
    const r = restructure(
      swap(P(4, 2, 5, 4), P(104, 6, 12, 14)), // dream leg +4
      swap(P(3, 4, 9, 3), P(103, 3.5, 5, 13)), // downgrade leg −0.5
      3.5 // netEp → surplus 0.5 over 2 transfers
    );
    const out = allocateFreeTransfers([a, b], [r], noWeak, 2, 3, counts());
    expect(out).toHaveLength(2);
    expect(ids(out).sort((x, y) => x - y)).toEqual([103, 104]); // both restructure legs
  });

  it("chooses two swaps over a restructure when they beat it", () => {
    const a = swap(P(1, 2), P(101, 5, 6, 11)); // surplus 1.5
    const b = swap(P(2, 2), P(102, 5, 6, 12)); // surplus 1.5  → 3.0 over 2 transfers
    const r = restructure(
      swap(P(4, 2, 5, 4), P(104, 6, 12, 14)),
      swap(P(3, 4, 9, 3), P(103, 3.5, 5, 13)),
      3.5 // surplus 0.5
    );
    const out = allocateFreeTransfers([a, b], [r], noWeak, 2, 3, counts());
    expect(ids(out)).toEqual([101, 102]);
    expect(ids(out)).not.toContain(104);
  });

  it("returns nothing at 0 free transfers", () => {
    const a = swap(P(1, 2), P(101, 8, 6, 11));
    expect(allocateFreeTransfers([a], [], noWeak, 0, 5, counts())).toEqual([]);
  });

  it("rejects a swap the bank can't afford", () => {
    const tooDear = swap(P(1, 2, 5, 1), P(101, 8, 12, 11)); // needs 7 more than weak frees
    expect(allocateFreeTransfers([tooDear], [], noWeak, 1, 1, counts())).toEqual([]);
  });

  it("respects the 3-per-club limit across the chosen set", () => {
    const a = swap(P(1, 2), P(101, 5, 6, 9)); // buys into club 9
    const b = swap(P(2, 2), P(102, 5, 6, 9)); // also club 9
    // Club 9 already has 2 → only one buy fits before it would hit 4.
    const out = allocateFreeTransfers([a, b], [], noWeak, 2, 5, counts({ 9: 2 }));
    expect(out).toHaveLength(1);
  });
});
