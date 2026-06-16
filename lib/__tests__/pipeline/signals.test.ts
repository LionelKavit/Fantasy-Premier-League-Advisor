import { describe, it, expect } from "vitest";
import { normalizeSignal, normalizeInverted } from "../../pipeline/normalize";
import { computeStatisticalSignals } from "../../pipeline/statistical-scoring";
import { computeMarketSignals } from "../../pipeline/market-dynamics";
import { makePlayer } from "../factories";

describe("normalize", () => {
  it("clamps to [0,1] and maps in-range linearly", () => {
    expect(normalizeSignal(-5, 0, 10)).toBe(0);
    expect(normalizeSignal(15, 0, 10)).toBe(1);
    expect(normalizeSignal(0, 0, 10)).toBe(0);
    expect(normalizeSignal(10, 0, 10)).toBe(1);
    expect(normalizeSignal(5, 0, 10)).toBeCloseTo(0.5);
  });

  it("inverts: higher input → lower output", () => {
    expect(normalizeInverted(0, 0, 10)).toBe(1);
    expect(normalizeInverted(10, 0, 10)).toBe(0);
    expect(normalizeInverted(2.5, 0, 10)).toBeCloseTo(0.75);
  });

  it("handles min===max without NaN", () => {
    expect(normalizeSignal(5, 5, 5)).toBe(0);
    expect(normalizeInverted(5, 5, 5)).toBe(1);
  });
});

describe("computeStatisticalSignals", () => {
  it("returns all zeros for a zero-minutes player (no divide-by-zero)", () => {
    const s = computeStatisticalSignals(makePlayer({ minutes: 0 }), 20);
    for (const v of Object.values(s)) expect(v).toBe(0);
  });

  it("escalates suspension risk near the pre-GW19 ban threshold", () => {
    const oneAway = computeStatisticalSignals(makePlayer({ yellowCards: 4, redCards: 0 }), 10);
    const atBan = computeStatisticalSignals(makePlayer({ yellowCards: 5, redCards: 0 }), 10);
    expect(oneAway.suspensionRisk).toBeCloseTo(0.8);
    expect(atBan.suspensionRisk).toBe(1);
  });

  it("applies the mid-season (GW19–32) and late-season (≥GW32) suspension bands", () => {
    const midBand = computeStatisticalSignals(makePlayer({ yellowCards: 9 }), 25); // one off the 10-card ban
    expect(midBand.suspensionRisk).toBeCloseTo(0.8);
    const lateBand = computeStatisticalSignals(makePlayer({ yellowCards: 4 }), 35); // dampened late
    expect(lateBand.suspensionRisk).toBeGreaterThan(0);
    expect(lateBand.suspensionRisk).toBeLessThan(0.2);
  });

  it("adds a red-card penalty (clamped to 1)", () => {
    const withRed = computeStatisticalSignals(makePlayer({ yellowCards: 1, redCards: 1 }), 10);
    const noRed = computeStatisticalSignals(makePlayer({ yellowCards: 1, redCards: 0 }), 10);
    expect(withRed.suspensionRisk).toBeGreaterThan(noRed.suspensionRisk);
    expect(withRed.suspensionRisk).toBeLessThanOrEqual(1);
  });

  it("credits set-piece duty and handles price 0 in value score", () => {
    const penTaker = computeStatisticalSignals(
      makePlayer({ setPieceDuties: { penalties: { order: 1, text: null }, corners: { order: null, text: null }, directFreekicks: { order: null, text: null } } }),
      20
    );
    expect(penTaker.setPieceValue).toBeGreaterThan(0);
    const freePlayer = computeStatisticalSignals(makePlayer({ price: 0 }), 20);
    expect(Number.isFinite(freePlayer.valueScore)).toBe(true);
  });
});

describe("computeMarketSignals", () => {
  it("falls back to neutral epNextSignal when epNext is null", () => {
    const s = computeMarketSignals(makePlayer({ epNext: null }), 10);
    expect(s.epNextSignal).toBe(0.5);
  });

  it("falls back to neutral when maxEpNext is 0", () => {
    const s = computeMarketSignals(makePlayer({ epNext: 5 }), 0);
    expect(s.epNextSignal).toBe(0.5);
  });

  it("handles zero transfer volume without NaN", () => {
    const s = computeMarketSignals(makePlayer({ transfersInEvent: 0, transfersOutEvent: 0 }), 10);
    expect(s.transferMomentum).toBe(0);
    expect(s.differentialValue).toBeCloseTo(1 - s.ownershipScore);
  });
});
