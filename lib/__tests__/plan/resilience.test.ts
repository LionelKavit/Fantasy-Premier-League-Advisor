import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalysisContext } from "../../plan/types";
import type { OptimizerResult } from "../../optimizer/types";
import type { CaptainResult, CaptainSynthesisInput, TripleCaptainAdvice } from "../../captain/types";

vi.mock("../../plan/context", () => ({ buildAnalysisContext: vi.fn() }));
vi.mock("../../optimizer", () => ({ runOptimizerWithContext: vi.fn() }));
vi.mock("../../captain", () => ({ computeCaptainSynthesisInput: vi.fn() }));
vi.mock("../../captain/synthesis", () => ({ synthesizeCaptainPick: vi.fn() }));

import { runGameweekPlan } from "../../plan";
import { buildAnalysisContext } from "../../plan/context";
import { runOptimizerWithContext } from "../../optimizer";
import { computeCaptainSynthesisInput } from "../../captain";
import { synthesizeCaptainPick } from "../../captain/synthesis";

const ctx = { analysis: { currentGw: 20 } } as unknown as AnalysisContext;
const fakeOpt = { primaryRecommendation: { type: "FREE" } } as unknown as OptimizerResult;
const fakeCap = { captain: { player: { player: { webName: "X" } } } } as unknown as CaptainResult;
const tcAdvice: TripleCaptainAdvice = { recommended: true, targetGw: 22, targetPlayer: "X", peakScore: 12, baselineScore: 5, reasoning: "DGW" };
const capInput = { tripleCaptainAdvice: tcAdvice } as unknown as CaptainSynthesisInput;

beforeEach(() => {
  vi.mocked(buildAnalysisContext).mockReset().mockResolvedValue(ctx);
  vi.mocked(runOptimizerWithContext).mockReset().mockResolvedValue(fakeOpt);
  vi.mocked(computeCaptainSynthesisInput).mockReset().mockReturnValue(capInput);
  vi.mocked(synthesizeCaptainPick).mockReset().mockResolvedValue(fakeCap);
});

describe("runGameweekPlan — composition", () => {
  it("builds analysis once and shares the same context with both pipelines", async () => {
    await runGameweekPlan(1, { freeTransfers: 1 });
    expect(buildAnalysisContext).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runOptimizerWithContext).mock.calls[0][0]).toBe(ctx);
    expect(vi.mocked(computeCaptainSynthesisInput).mock.calls[0][0]).toBe(ctx);
  });

  it("injects the captain's TC advice into the optimizer", async () => {
    await runGameweekPlan(1, { freeTransfers: 1 });
    expect(vi.mocked(runOptimizerWithContext).mock.calls[0][2]).toBe(tcAdvice);
  });

  it("returns both sides with no plan alerts on success", async () => {
    const plan = await runGameweekPlan(1, { freeTransfers: 1 });
    expect(plan.transfers).toBe(fakeOpt);
    expect(plan.captaincy).toBe(fakeCap);
    expect(plan.alerts).toHaveLength(0);
    expect(plan.currentGw).toBe(20);
  });
});

describe("runGameweekPlan — partial failure isolation", () => {
  it("optimizer fails → captaincy survives with an alert", async () => {
    vi.mocked(runOptimizerWithContext).mockRejectedValue(new Error("opt boom"));
    const plan = await runGameweekPlan(1, { freeTransfers: 1 });
    expect(plan.transfers).toBeNull();
    expect(plan.captaincy).toBe(fakeCap);
    expect(plan.alerts.some((a) => /transfer optimizer failed/i.test(a))).toBe(true);
  });

  it("captain synthesis fails → transfers survive with one alert", async () => {
    vi.mocked(synthesizeCaptainPick).mockRejectedValue(new Error("cap boom"));
    const plan = await runGameweekPlan(1, { freeTransfers: 1 });
    expect(plan.transfers).toBe(fakeOpt);
    expect(plan.captaincy).toBeNull();
    expect(plan.alerts.filter((a) => /captain pipeline failed/i.test(a))).toHaveLength(1);
  });

  it("captain deterministic phase throws → transfers survive, no duplicate alert", async () => {
    vi.mocked(computeCaptainSynthesisInput).mockImplementation(() => { throw new Error("det boom"); });
    const plan = await runGameweekPlan(1, { freeTransfers: 1 });
    expect(plan.transfers).toBe(fakeOpt);
    expect(plan.captaincy).toBeNull();
    expect(plan.alerts.filter((a) => /captain pipeline failed/i.test(a))).toHaveLength(1);
    // optimizer still ran (with undefined advice, since the captain phase failed)
    expect(vi.mocked(runOptimizerWithContext).mock.calls[0][2]).toBeUndefined();
  });

  it("both fail → plan still resolves with both null and two alerts", async () => {
    vi.mocked(runOptimizerWithContext).mockRejectedValue(new Error("opt"));
    vi.mocked(synthesizeCaptainPick).mockRejectedValue(new Error("cap"));
    const plan = await runGameweekPlan(1, { freeTransfers: 1 });
    expect(plan.transfers).toBeNull();
    expect(plan.captaincy).toBeNull();
    expect(plan.alerts).toHaveLength(2);
  });

  it("context build failure rejects (surfaces as an error response upstream)", async () => {
    vi.mocked(buildAnalysisContext).mockRejectedValue(new Error("ctx boom"));
    await expect(runGameweekPlan(1, { freeTransfers: 1 })).rejects.toThrow("ctx boom");
  });
});
