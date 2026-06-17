import type { GameweekPlan, SquadPlayerView, AnalysisContext } from "./types";
import type { CaptainSynthesisInput, CaptainResult } from "../captain/types";
import { buildAnalysisContext } from "./context";
import { runOptimizerWithContext } from "../optimizer";
import { computeCaptainSynthesisInput } from "../captain";
import { synthesizeCaptainPick } from "../captain/synthesis";

export async function runGameweekPlan(
  teamId: number,
  options: { freeTransfers: number; captainHorizon?: number }
): Promise<GameweekPlan> {
  // One shared analysis pass — the expensive squad scoring runs once.
  const ctx = await buildAnalysisContext(teamId);

  const alerts: string[] = [];

  // Captain's deterministic phase (no LLM) runs first so its authoritative
  // triple-captain advice can be injected into the optimizer's chip node.
  // Guard it: a failure here must not kill the transfer side.
  let captainInput: CaptainSynthesisInput | null = null;
  try {
    captainInput = computeCaptainSynthesisInput(ctx, options.captainHorizon);
  } catch (e) {
    alerts.push(`Captain pipeline failed: ${errMsg(e)}`);
  }

  // Fan out the two LLM syntheses concurrently; isolate per-side failures.
  // The optimizer chip node defers to the captain's TC advice (coherence),
  // while both expensive calls still overlap (parallelism).
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

  const transfers =
    optSettled.status === "fulfilled" ? optSettled.value : null;
  if (optSettled.status === "rejected") {
    alerts.push(`Transfer optimizer failed: ${errMsg(optSettled.reason)}`);
  }

  let captaincy: CaptainResult | null = null;
  if (capSettled.status === "fulfilled") {
    captaincy = capSettled.value;
  } else if (captainInput) {
    // Only alert here if the deterministic phase succeeded but synthesis failed;
    // a deterministic-phase failure was already recorded above.
    alerts.push(`Captain pipeline failed: ${errMsg(capSettled.reason)}`);
  }

  const entry = ctx.managerProfile.entry;

  return {
    teamId,
    currentGw: ctx.analysis.currentGw,
    transfers,
    captaincy,
    squad: buildSquadView(ctx, captaincy),
    bank: ctx.analysis.bank,
    chipsRemaining: ctx.analysis.chipsRemaining,
    manager: {
      name: `${entry.playerFirstName} ${entry.playerLastName}`.trim(),
      overallRank: entry.summaryOverallRank,
      teamName: entry.name,
    },
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

// Project the shared analysis into the lean per-player views the pitch needs,
// in pick-slot order, with recommendation flags resolved server-side. Sourced
// from the shared context so it is present even when a sub-pipeline failed.
function buildSquadView(
  ctx: AnalysisContext,
  captaincy: CaptainResult | null
): SquadPlayerView[] {
  const scoredById = new Map(
    ctx.analysis.rankedSquad.map((sp) => [sp.player.id, sp])
  );
  const captainId = captaincy?.captain.player.player.id ?? null;
  const viceId = captaincy?.viceCaptain?.player.player.id ?? null;
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
