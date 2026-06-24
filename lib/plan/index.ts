import type { GameweekPlan, SquadPlayerView, AnalysisContext, PlanInsights } from "./types";
import type { CaptainSynthesisInput, CaptainResult } from "../captain/types";
import { getCachedAnalysisContext, buildLiteBaseContext, getCachedDemoContext } from "./context";
import { runOptimizerWithContext } from "../optimizer";
import { orchestrateChips } from "../optimizer/chip-orchestrator";
import { computeCaptainSynthesisInput } from "../captain";
import { synthesizeCaptainPick } from "../captain/synthesis";
import { computeRiskAlerts } from "../alerts";
import { CAPTAIN_CONFIG } from "../config";

export interface PlanOptions {
  freeTransfers: number;
  captainHorizon?: number;
}

// ── Phase 1: base (deterministic, no LLM) ────────────────────────────────────
// Everything the pitch needs — squad, meta, and the deterministic captain/vice
// for the armband — without waiting on any synthesis. Fast (instant on a cached
// context). `transfers`/`captaincy` are left null and filled by the insights
// phase; the type already allows that.
export async function runGameweekPlanBase(
  teamId: number,
  options: PlanOptions
): Promise<GameweekPlan> {
  const ctx = await buildLiteBaseContext(teamId);
  return baseFromContext(ctx, teamId, options);
}

// Demo base: same pitch + ratings + deterministic captain, built on the
// manager-less demo context. `teamId` 0 marks it as the sample squad.
export async function runDemoPlanBase(options: PlanOptions): Promise<GameweekPlan> {
  const ctx = await getCachedDemoContext();
  return baseFromContext(ctx, 0, options);
}

function baseFromContext(
  ctx: AnalysisContext,
  teamId: number,
  options: PlanOptions
): GameweekPlan {
  const { captainId, viceId } = deterministicCaptainIds(ctx, options.captainHorizon);
  const entry = ctx.managerProfile.entry;

  return {
    teamId,
    currentGw: ctx.analysis.currentGw,
    deadline: ctx.analysis.deadline,
    transfers: null,
    captaincy: null,
    squad: buildSquadView(ctx, { captainId, viceId }),
    bank: ctx.analysis.bank,
    chipsRemaining: ctx.analysis.chipsRemaining,
    manager: {
      name: `${entry.playerFirstName} ${entry.playerLastName}`.trim(),
      overallRank: entry.summaryOverallRank,
      teamName: entry.name,
    },
    alerts: [],
    generatedAt: new Date().toISOString(),
    demoSeason: ctx.demoSeason,
  };
}

// ── Phase 2: insights (the LLM syntheses) ────────────────────────────────────
interface InsightsCacheEntry {
  promise: Promise<PlanInsights>;
  ts: number;
}
const INSIGHTS_TTL_MS = 10 * 60 * 1000;
const insightsCache = new Map<string, InsightsCacheEntry>();

export async function runGameweekPlanInsights(
  teamId: number,
  options: PlanOptions,
  opts: { force?: boolean } = {}
): Promise<PlanInsights> {
  const ctx = await getCachedAnalysisContext(teamId);
  const horizon = options.captainHorizon ?? CAPTAIN_CONFIG.horizonLengthDefault;
  const key = `${teamId}:${ctx.analysis.currentGw}:${options.freeTransfers}:${horizon}`;

  if (!opts.force) {
    const hit = insightsCache.get(key);
    if (hit && Date.now() - hit.ts < INSIGHTS_TTL_MS) return hit.promise;
  }

  const promise = computeInsights(ctx, options);
  insightsCache.set(key, { promise, ts: Date.now() });
  try {
    return await promise;
  } catch (e) {
    insightsCache.delete(key); // don't cache failures
    throw e;
  }
}

// The LLM half: captain's deterministic phase (for TC advice), then the two
// syntheses fanned out, with per-side failure isolation.
async function computeInsights(
  ctx: AnalysisContext,
  options: PlanOptions
): Promise<PlanInsights> {
  const alerts: string[] = [];

  let captainInput: CaptainSynthesisInput | null = null;
  try {
    captainInput = computeCaptainSynthesisInput(ctx, options.captainHorizon);
  } catch (e) {
    alerts.push(`Captain pipeline failed: ${errMsg(e)}`);
  }

  const [optSettled, capSettled] = await Promise.allSettled([
    runOptimizerWithContext(
      ctx,
      options.freeTransfers,
      captainInput?.tripleCaptainAdvice ?? undefined
    ),
    captainInput
      ? synthesizeCaptainPick(captainInput)
      : Promise.reject(new Error("captain deterministic phase failed")),
  ]);

  const transfers = optSettled.status === "fulfilled" ? optSettled.value : null;
  if (optSettled.status === "rejected") {
    alerts.push(`Transfer optimizer failed: ${errMsg(optSettled.reason)}`);
  }

  let captaincy: CaptainResult | null = null;
  if (capSettled.status === "fulfilled") {
    captaincy = capSettled.value;
  } else if (captainInput) {
    alerts.push(`Captain pipeline failed: ${errMsg(capSettled.reason)}`);
  }

  // The chips.md-grounded orchestrator decides the chip plan over the deterministic
  // candidate windows (needs both the optimizer's windows and the captain signals).
  // Its result is the single `chipPlan`; keyless/failure → windows unchanged (N2).
  if (transfers) {
    transfers.chipPlan = await orchestrateChips({
      windows: transfers.chipPlan ?? [],
      chipsRemaining: ctx.analysis.chipsRemaining,
      currentGw: ctx.analysis.currentGw,
      gwFlags: ctx.gwFlags ?? [],
      captainTop: captaincy?.captain ?? null,
    });
  }

  // Curated, deterministic risk alerts lead; pipeline-failure notices follow.
  const riskAlerts = computeRiskAlerts({ analysis: ctx.analysis, transfers, captaincy });
  return { transfers, captaincy, alerts: [...riskAlerts, ...alerts] };
}

// ── Demo insights: captaincy only ────────────────────────────────────────────
// No optimizer (no transfer rec, long-term horizon, or chip plan) — there's no
// real squad to improve and no held-chip state. Just the captain pipeline, with
// the demo flag so the prose stays general (no rank / "your squad").
const demoInsightsCache = new Map<string, InsightsCacheEntry>();

export async function runDemoPlanInsights(
  options: PlanOptions,
  opts: { force?: boolean } = {}
): Promise<PlanInsights> {
  const ctx = await getCachedDemoContext();
  const horizon = options.captainHorizon ?? CAPTAIN_CONFIG.horizonLengthDefault;
  const key = `${ctx.analysis.currentGw}:${horizon}`;

  if (!opts.force) {
    const hit = demoInsightsCache.get(key);
    if (hit && Date.now() - hit.ts < INSIGHTS_TTL_MS) return hit.promise;
  }

  const promise = computeDemoInsights(ctx, options);
  demoInsightsCache.set(key, { promise, ts: Date.now() });
  try {
    return await promise;
  } catch (e) {
    demoInsightsCache.delete(key);
    throw e;
  }
}

async function computeDemoInsights(
  ctx: AnalysisContext,
  options: PlanOptions
): Promise<PlanInsights> {
  const alerts: string[] = [];

  let captainInput: CaptainSynthesisInput | null = null;
  try {
    captainInput = computeCaptainSynthesisInput(ctx, options.captainHorizon);
  } catch (e) {
    alerts.push(`Captain pipeline failed: ${errMsg(e)}`);
  }

  let captaincy: CaptainResult | null = null;
  if (captainInput) {
    try {
      captaincy = await synthesizeCaptainPick(captainInput, { demo: true });
    } catch (e) {
      alerts.push(`Captain pipeline failed: ${errMsg(e)}`);
    }
  }

  const riskAlerts = computeRiskAlerts({ analysis: ctx.analysis, transfers: null, captaincy });
  return { transfers: null, captaincy, alerts: [...riskAlerts, ...alerts] };
}

/** Merged demo plan (base + captaincy insights) — used by the demo brief route. */
export async function runDemoPlan(options: PlanOptions): Promise<GameweekPlan> {
  const insights = await runDemoPlanInsights(options);
  const ctx = await getCachedDemoContext(); // cache hit (insights built it)

  const captainId = insights.captaincy?.captain.player.player.id ?? null;
  const viceId = insights.captaincy?.viceCaptain?.player.player.id ?? null;
  const ids = captainId
    ? { captainId, viceId }
    : deterministicCaptainIds(ctx, options.captainHorizon);

  const base = baseFromContext(ctx, 0, options);
  return {
    ...base,
    transfers: insights.transfers,
    captaincy: insights.captaincy,
    squad: buildSquadView(ctx, ids),
    alerts: insights.alerts,
  };
}

// ── Merged plan (back-compat) ────────────────────────────────────────────────
// Same full `GameweekPlan` as before — built from the FULL cached context (not
// the lightweight base), so the squad is full-scored and the armband reflects
// the (possibly LLM-refined) captaincy.
export async function runGameweekPlan(
  teamId: number,
  options: PlanOptions
): Promise<GameweekPlan> {
  const insights = await runGameweekPlanInsights(teamId, options);
  const ctx = await getCachedAnalysisContext(teamId); // cache hit (insights built it)

  const captainId = insights.captaincy?.captain.player.player.id ?? null;
  const viceId = insights.captaincy?.viceCaptain?.player.player.id ?? null;
  const ids = captainId
    ? { captainId, viceId }
    : deterministicCaptainIds(ctx, options.captainHorizon);

  const entry = ctx.managerProfile.entry;
  return {
    teamId,
    currentGw: ctx.analysis.currentGw,
    deadline: ctx.analysis.deadline,
    transfers: insights.transfers,
    captaincy: insights.captaincy,
    squad: buildSquadView(ctx, ids),
    bank: ctx.analysis.bank,
    chipsRemaining: ctx.analysis.chipsRemaining,
    manager: {
      name: `${entry.playerFirstName} ${entry.playerLastName}`.trim(),
      overallRank: entry.summaryOverallRank,
      teamName: entry.name,
    },
    alerts: insights.alerts,
    generatedAt: new Date().toISOString(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function deterministicCaptainIds(
  ctx: AnalysisContext,
  horizon: number | undefined
): { captainId: number | null; viceId: number | null } {
  try {
    const input = computeCaptainSynthesisInput(ctx, horizon);
    return {
      captainId: input.rankedCandidates[0]?.player.player.id ?? null,
      viceId: input.viceCaptain?.player.player.id ?? null,
    };
  } catch {
    return { captainId: null, viceId: null };
  }
}

// Project the shared analysis into the lean per-player views the pitch needs,
// in pick-slot order, with recommendation flags resolved server-side. Sourced
// from the shared context so it is present even when a sub-pipeline failed.
function buildSquadView(
  ctx: AnalysisContext,
  caps: { captainId: number | null; viceId: number | null }
): SquadPlayerView[] {
  const scoredById = new Map(
    ctx.analysis.rankedSquad.map((sp) => [sp.player.id, sp])
  );
  const { captainId, viceId } = caps;
  const weakIds = new Set(
    ctx.analysis.weakSpots.map((w) => w.player.player.id)
  );

  return [...ctx.analysis.picks]
    .sort((a, b) => a.position - b.position)
    .map((pick) => {
      const sp = scoredById.get(pick.element);
      const p = sp?.player;
      return {
        id: pick.element,
        webName: p?.webName ?? "Unknown",
        teamShortName: p?.teamShortName ?? "UNK",
        teamCode: p?.teamCode ?? 0,
        position: p?.position ?? "MID",
        pickSlot: pick.position,
        isStarting: pick.position <= 11,
        price: p?.price ?? 0,
        score: sp?.score.total ?? 0,
        form: p?.form ?? 0,
        pointsPerGame: p?.pointsPerGame ?? 0,
        epNext: p?.epNext ?? null,
        availability: {
          status: p?.availability.status ?? "available",
          chanceOfPlayingNext: p?.availability.chanceOfPlayingNext ?? null,
          news: p?.availability.news ?? "",
        },
        isCaptainRec: pick.element === captainId,
        isViceRec: pick.element === viceId,
        isWeakSpot: weakIds.has(pick.element),
      };
    });
}

function errMsg(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown error";
}

/** Test-only: clear the insights caches. */
export function _clearInsightsCache(): void {
  insightsCache.clear();
  demoInsightsCache.clear();
}
