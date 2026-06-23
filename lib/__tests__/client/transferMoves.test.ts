import { describe, it, expect } from "vitest";
import type { ValidTransfer } from "../../optimizer/types";
import { groupTransferMoves } from "../../client/transferMoves";
import { makeScoredPlayer } from "../factories";

function vt(outId: number, outName: string, inName: string, gain: number): ValidTransfer {
  return {
    weakPlayer: makeScoredPlayer({ player: { id: outId, webName: outName } }),
    candidate: makeScoredPlayer({ player: { webName: inName } }),
    priceDelta: 0,
    gw1Gain: gain,
    gw5Gain: gain,
    scoreDiffPct: 0,
  };
}

describe("groupTransferMoves", () => {
  it("keeps a single move as one out → one candidate (with element ids)", () => {
    const groups = groupTransferMoves([vt(1, "Solanke", "Watkins", 1.2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ out: "Solanke", outId: 1, candidates: ["Watkins"] });
    expect(groups[0].candidateIds).toHaveLength(1);
    expect(typeof groups[0].candidateIds[0]).toBe("number");
  });

  it("groups multiple candidates for one out-player, best-first, capped to 3", () => {
    const groups = groupTransferMoves([
      vt(1, "JoaoPedro", "Bowen", 0.5),
      vt(1, "JoaoPedro", "Watkins", 2.0),
      vt(1, "JoaoPedro", "Gyokeres", 1.5),
      vt(1, "JoaoPedro", "Richarlison", 0.2),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].out).toBe("JoaoPedro");
    expect(groups[0].candidates).toEqual(["Watkins", "Gyokeres", "Bowen"]); // top 3 by gain
  });

  it("orders out-players by their best candidate's gain", () => {
    const groups = groupTransferMoves([
      vt(1, "Weak", "LowGain", 0.3),
      vt(2, "Strong", "HighGain", 3.0),
    ]);
    expect(groups.map((g) => g.out)).toEqual(["Strong", "Weak"]);
  });

  it("returns nothing for no transfers", () => {
    expect(groupTransferMoves([])).toEqual([]);
  });
});
