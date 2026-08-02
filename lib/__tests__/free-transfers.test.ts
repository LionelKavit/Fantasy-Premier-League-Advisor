import { describe, it, expect } from "vitest";
import { deriveFreeTransfers } from "../free-transfers";
import type { ManagerTransfer, ChipUsage } from "../types";

const transfer = (event: number): ManagerTransfer => ({
  elementIn: 1,
  elementInCost: 50,
  elementOut: 2,
  elementOutCost: 50,
  event,
  time: "2026-08-01T00:00:00Z",
});

const chip = (name: string, event: number): ChipUsage => ({
  name,
  event,
  time: "2026-08-01T00:00:00Z",
});

describe("deriveFreeTransfers", () => {
  it("has no free-transfer concept at GW1", () => {
    expect(deriveFreeTransfers([], [], 1)).toBe(0);
  });

  it("enters GW2 with exactly 1 regardless of GW1 activity", () => {
    expect(deriveFreeTransfers([], [], 2)).toBe(1);
    expect(deriveFreeTransfers([transfer(1), transfer(1)], [], 2)).toBe(1);
  });

  it("banks +1 per untouched gameweek up to the cap of 5", () => {
    expect(deriveFreeTransfers([], [], 4)).toBe(3); // spec scenario: none in GW2/GW3
    expect(deriveFreeTransfers([], [], 6)).toBe(5);
    expect(deriveFreeTransfers([], [], 20)).toBe(5); // capped, never beyond
  });

  it("consumes one per transfer made", () => {
    expect(deriveFreeTransfers([transfer(2)], [], 3)).toBe(1);
    // 3 banked entering GW4, two moves made → 1 carried + 1 accrued
    expect(deriveFreeTransfers([transfer(4), transfer(4)], [], 5)).toBe(2);
  });

  it("floors at 0 when hits are taken", () => {
    // 1 FT at GW2, three moves (two hits) → carried 0, accrue 1
    expect(deriveFreeTransfers([transfer(2), transfer(2), transfer(2)], [], 3)).toBe(1);
  });

  it("wildcard and free-hit gameweeks consume nothing", () => {
    // spec scenario: 2 FTs held into GW5 (one move each in GW2 + GW3),
    // wildcard with 8 moves in GW5 → 2 preserved + 1 accrued = 3 at GW6
    const wcMoves = Array.from({ length: 8 }, () => transfer(5));
    expect(
      deriveFreeTransfers([transfer(2), transfer(3), ...wcMoves], [chip("wildcard", 5)], 6)
    ).toBe(3);
    expect(deriveFreeTransfers([...wcMoves], [chip("freehit", 5)], 6)).toBe(5);
  });

  it("other chips (bboost/3xc) do not shield transfers", () => {
    expect(deriveFreeTransfers([transfer(2), transfer(2)], [chip("bboost", 2)], 3)).toBe(1);
  });
});
