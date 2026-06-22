import type { GameweekPlan, SquadPlayerView, AnalysisContext, PlanInsights } from "./types";
import type { CaptainSynthesisInput, CaptainResult } from "../captain/types";
import { getCachedAnalysisContext, buildLiteBaseContext } from "./context";
import { runOptimizerWithContext } from "../optimizer";
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

  // Curated, deterministic risk alerts lead; pipeline-failure notices follow.
  const riskAlerts = computeRiskAlerts({ analysis: ctx.analysis, transfers, captaincy });
  return { transfers, captaincy, alerts: [...riskAlerts, ...alerts] };
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
    ctx.analysis.weakest3.map((w) => w.player.player.id)
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

/** Test-only: clear the insights cache. */
export function _clearInsightsCache(): void {
  insightsCache.clear();
}
