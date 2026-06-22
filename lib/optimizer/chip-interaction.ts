import type { ManagerProfile, GameweekFlags, Fixture, Pick, ChipsRemaining } from "../types";
import type { SquadAnalysisResult, ScoredPlayer } from "../pipeline/types";
import type { TripleCaptainAdvice } from "../captain/types";
import type {
  ValidTransfer,
  SingleTransferResult,
  HitTransferResult,
  ChipRecommendation,
} from "./types";
import { computeFdrRun, type FdrEntry } from "../gameweek";
import { CHIP_CALENDAR, WILDCARD_TRIGGER } from "../config";

export function evaluateChipInteractions(
  analysis: SquadAnalysisResult,
  managerProfile: ManagerProfile,
  validTransfers: ValidTransfer[],
  gwFlags: GameweekFlags[],
  singleResult: SingleTransferResult,
  _hitResult: HitTransferResult,
  fixtures: Fixture[] = [],
  tripleCaptainAdvice?: TripleCaptainAdvice
): ChipRecommendation[] {
  const chips = managerProfile.chipsRemaining;
  const currentGw = analysis.currentGw;
  const recommendations: ChipRecommendation[] = [];

  const wildcardRec = evaluateWildcard(
    chips.wildcard,
    validTransfers,
    analysis.rankedSquad,
    analysis.picks,
    fixtures,
    gwFlags,
    currentGw
  );
  const freeHitRec = evaluateFreeHit(chips.freeHit, gwFlags, analysis.rankedSquad, currentGw);
  const benchBoostRec = evaluateBenchBoost(
    chips.benchBoost,
    gwFlags,
    analysis.rankedSquad,
    currentGw,
    analysis.picks
  );
  const tripleCaptainRec = evaluateTripleCaptain(
    chips.tripleCaptain,
    gwFlags,
    analysis.rankedSquad,
    currentGw,
    fixtures,
    tripleCaptainAdvice
  );

  if (wildcardRec) recommendations.push(wildcardRec);
  if (freeHitRec) recommendations.push(freeHitRec);

  if (wildcardRec && benchBoostRec && benchBoostRec.triggerGw === wildcardRec.triggerGw) {
    const nextDgw = gwFlags.find((f) => f.isDGW && f.gameweek > wildcardRec.triggerGw);
    if (nextDgw) {
      benchBoostRec.triggerGw = nextDgw.gameweek;
      benchBoostRec.reason += ` (deferred from GW${wildcardRec.triggerGw} due to wildcard)`;
      recommendations.push(benchBoostRec);
    }
  } else if (benchBoostRec) {
    recommendations.push(benchBoostRec);
  }

  if (tripleCaptainRec) recommendations.push(tripleCaptainRec);

  // Last chance: on the half deadline, surface a play-now-able window for held
  // chips with real last-GW value (the forward-looking evaluators find nothing).
  pushLastCallWindows(recommendations, chips, currentGw, analysis.rankedSquad, analysis.picks, validTransfers);

  applyExpiryPressure(recommendations, chips, currentGw);
  return recommendations;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The last gameweek a chip from the current half can still be played. */
function halfEndGw(currentGw: number): number {
  return currentGw <= CHIP_CALENDAR.firstHalfExpiryGw
    ? CHIP_CALENDAR.firstHalfExpiryGw
    : CHIP_CALENDAR.seasonEndGw;
}

/** Average an FDR entry — a single fixture, a blank (null), or a double (array). */
function avgFdr(fdr: FdrEntry): number | null {
  if (fdr === null) return null;
  if (Array.isArray(fdr)) return fdr.length ? fdr.reduce((a, b) => a + b, 0) / fdr.length : null;
  return fdr;
}

/**
 * Last chance. On the half's deadline gameweek the forward-looking evaluators
 * find nothing (there is no "ahead"), yet a held chip is about to be lost. Emit a
 * candidate `window` at the current gameweek for each held chip that still has
 * real last-GW value, so the orchestrator can play one this week (single-source
 * invariant: status stays "window"; only the orchestrator promotes to play-now).
 * Reasons omit the expiry tail — `applyExpiryPressure` appends it next.
 */
function pushLastCallWindows(
  recs: ChipRecommendation[],
  chips: ChipsRemaining,
  currentGw: number,
  squad: ScoredPlayer[],
  picks: Pick[],
  validTransfers: ValidTransfer[]
): void {
  const deadline =
    currentGw <= CHIP_CALENDAR.firstHalfExpiryGw ? CHIP_CALENDAR.firstHalfExpiryGw : CHIP_CALENDAR.seasonEndGw;
  if (currentGw !== deadline) return; // only the genuinely last playable gameweek
  const has = (chip: ChipRecommendation["chip"]) => recs.some((r) => r.chip === chip);

  // Triple Captain — always worth it last gameweek (triples your best captain).
  if (chips.tripleCaptain > 0 && !has("tripleCaptain")) {
    const cap = squad[0];
    if (cap) {
      recs.push({
        chip: "tripleCaptain",
        triggerGw: currentGw,
        status: "window",
        reason: `Final chance — Triple Captain ${cap.player.webName} this gameweek.`,
        draft: null,
      });
    }
  }

  // Bench Boost — worth it if the bench will score at all.
  if (chips.benchBoost > 0 && !has("benchBoost")) {
    const benchIds = new Set(picks.filter((p) => p.position >= 12).map((p) => p.element));
    const bench = squad.filter((sp) => benchIds.has(sp.player.id));
    const avg = bench.length ? bench.reduce((s, sp) => s + sp.score.total, 0) / bench.length : 0;
    if (avg > 0) {
      const names = bench.map((sp) => sp.player.webName).join(", ");
      recs.push({
        chip: "benchBoost",
        triggerGw: currentGw,
        status: "window",
        reason: `Final chance — Bench Boost this gameweek; your bench (${names}) will score.`,
        draft: null,
      });
    }
  }

  // Free Hit / Wildcard — only salvage value last gameweek if the XI has an
  // availability hole to patch (no future to set up otherwise). Prefer Free Hit.
  const xiIds = new Set(picks.filter((p) => p.position <= 11).map((p) => p.element));
  const holes = squad.filter((sp) => {
    if (!xiIds.has(sp.player.id)) return false;
    const a = sp.player.availability;
    return a.status !== "available" || (a.chanceOfPlayingNext !== null && a.chanceOfPlayingNext <= 50);
  });
  if (holes.length > 0) {
    if (chips.freeHit > 0 && !has("freeHit")) {
      recs.push({
        chip: "freeHit",
        triggerGw: currentGw,
        status: "window",
        reason: `Final chance — ${holes.length} starter(s) won't play; a Free Hit fields a full XI.`,
        draft: null,
      });
    } else if (chips.wildcard > 0 && !has("wildcard")) {
      const draft = validTransfers.filter((vt) => vt.gw1Gain > 0);
      if (draft.length > 0) {
        recs.push({
          chip: "wildcard",
          triggerGw: currentGw,
          status: "window",
          reason: `Final chance — ${holes.length} starter(s) won't play; a Wildcard patches the XI.`,
          draft,
        });
      }
    }
  }
}

/**
 * "Don't hoard": as the current half's deadline nears with an unused chip, raise
 * the urgency on its window(s). Mutates the reason in place.
 */
function applyExpiryPressure(recs: ChipRecommendation[], chips: ChipsRemaining, currentGw: number): void {
  const deadline =
    currentGw <= CHIP_CALENDAR.firstHalfExpiryGw ? CHIP_CALENDAR.firstHalfExpiryGw : CHIP_CALENDAR.seasonEndGw;
  const gwsLeft = deadline - currentGw;
  if (gwsLeft < 0 || gwsLeft > CHIP_CALENDAR.expiryPressureGws) return;
  for (const rec of recs) {
    if (chips[rec.chip] > 0) rec.reason += ` ⚠ Expires GW${deadline} — use it or lose it.`;
  }
}

// ── Evaluators ───────────────────────────────────────────────────────────────

function evaluateWildcard(
  remaining: number,
  validTransfers: ValidTransfer[],
  squad: ScoredPlayer[],
  picks: Pick[],
  fixtures: Fixture[],
  gwFlags: GameweekFlags[],
  currentGw: number
): ChipRecommendation | null {
  if (remaining <= 0) return null;

  // You need targets to rebuild into; without them a Wildcard is wasted.
  const draft = validTransfers.filter((vt) => vt.gw1Gain > 0.05);
  if (draft.length < WILDCARD_TRIGGER.minDraft) return null;

  // Trigger 1 — fixture swing: a chunk of the XI facing a hard upcoming run.
  const xiIds = new Set(picks.filter((p) => p.position <= 11).map((p) => p.element));
  let hardRun = 0;
  for (const sp of squad) {
    if (!xiIds.has(sp.player.id)) continue;
    const vals = computeFdrRun(sp.player.teamId, fixtures, currentGw, WILDCARD_TRIGGER.lookahead)
      .map((r) => avgFdr(r.fdr))
      .filter((v): v is number => v !== null);
    if (vals.length === 0) continue;
    if (vals.reduce((a, b) => a + b, 0) / vals.length >= WILDCARD_TRIGGER.hardFdr) hardRun++;
  }
  if (hardRun >= WILDCARD_TRIGGER.hardStartersMin) {
    return {
      chip: "wildcard",
      triggerGw: currentGw,
      status: "window", // deterministic layer only ever proposes windows (N2)
      reason: `${hardRun} of your XI face a hard fixture run over the next ${WILDCARD_TRIGGER.lookahead} GWs — a Wildcard restructures around the swing.`,
      draft,
    };
  }

  // Trigger 2 — set up a near-term Double Gameweek squad.
  const upcomingDgw = gwFlags.find(
    (f) => f.isDGW && f.gameweek > currentGw && f.gameweek <= currentGw + WILDCARD_TRIGGER.dgwSetupLookahead
  );
  if (upcomingDgw) {
    return {
      chip: "wildcard",
      triggerGw: currentGw,
      status: "window",
      reason: `Set up for the GW${upcomingDgw.gameweek} Double — Wildcard now to load double-fixture players.`,
      draft,
    };
  }

  return null;
}

function evaluateFreeHit(
  remaining: number,
  gwFlags: GameweekFlags[],
  squad: ScoredPlayer[],
  currentGw: number
): ChipRecommendation | null {
  if (remaining <= 0) return null;
  const end = halfEndGw(currentGw);

  // Primary — a Blank Gameweek where the squad blanks (field a full XI).
  const bgw = gwFlags.find((f) => f.isBGW && f.gameweek >= currentGw && f.gameweek <= end);
  if (bgw) {
    const blanks = squad.filter((sp) => bgw.blankTeams.includes(sp.player.teamId));
    if (blanks.length >= 3) {
      const names = blanks.slice(0, 5).map((sp) => sp.player.webName).join(", ");
      return {
        chip: "freeHit",
        triggerGw: bgw.gameweek,
        status: "window",
        reason: `BGW${bgw.gameweek}: ${blanks.length} squad players blank (${names}).`,
        draft: null,
      };
    }
  }

  // Secondary — a Double Gameweek, to attack a one-week ceiling.
  const dgw = gwFlags.find((f) => f.isDGW && f.gameweek >= currentGw && f.gameweek <= end);
  if (dgw) {
    return {
      chip: "freeHit",
      triggerGw: dgw.gameweek,
      status: "window",
      reason: `DGW${dgw.gameweek}: a Free Hit can attack the Double's one-week ceiling.`,
      draft: null,
    };
  }

  return null;
}

function evaluateBenchBoost(
  remaining: number,
  gwFlags: GameweekFlags[],
  squad: ScoredPlayer[],
  currentGw: number,
  picks: Pick[]
): ChipRecommendation | null {
  if (remaining <= 0) return null;

  const dgw = gwFlags.find((f) => f.isDGW && f.gameweek >= currentGw && f.gameweek <= halfEndGw(currentGw));
  if (!dgw) return null;

  const benchPlayerIds = new Set(picks.filter((p) => p.position >= 12).map((p) => p.element));
  const benchPlayers = squad.filter((sp) => benchPlayerIds.has(sp.player.id));
  if (benchPlayers.length === 0) return null;

  const avgBenchScore = benchPlayers.reduce((sum, sp) => sum + sp.score.total, 0) / benchPlayers.length;
  if (avgBenchScore <= 0.4) return null;

  const names = benchPlayers.map((sp) => sp.player.webName).join(", ");
  return {
    chip: "benchBoost",
    triggerGw: dgw.gameweek,
    status: "window",
    reason: `DGW${dgw.gameweek}: bench (${names}) avg score ${avgBenchScore.toFixed(2)} (above 0.40 threshold).`,
    draft: null,
  };
}

function evaluateTripleCaptain(
  remaining: number,
  gwFlags: GameweekFlags[],
  squad: ScoredPlayer[],
  currentGw: number,
  fixtures: Fixture[],
  advice?: TripleCaptainAdvice
): ChipRecommendation | null {
  if (remaining <= 0) return null;

  // Prefer the captain pipeline's advice (single source of truth) when provided.
  if (advice !== undefined) {
    if (!advice.recommended || advice.targetGw === null) return null;
    return {
      chip: "tripleCaptain",
      triggerGw: advice.targetGw,
      status: "window",
      reason: advice.reasoning,
      draft: null,
    };
  }

  // Fallback heuristic (no captain advice): a premium's Double in the current half.
  const dgw = gwFlags.find((f) => f.isDGW && f.gameweek >= currentGw && f.gameweek <= halfEndGw(currentGw));
  if (!dgw) return null;

  const bestPlayer = squad[0];
  if (!bestPlayer || !dgw.doubleTeams.includes(bestPlayer.player.teamId)) return null;

  const dgwFixtures = fixtures.filter(
    (f) => f.event === dgw.gameweek && (f.team_h === bestPlayer.player.teamId || f.team_a === bestPlayer.player.teamId)
  );
  if (dgwFixtures.length < 2) return null;

  const fdrs = dgwFixtures.map((f) =>
    f.team_h === bestPlayer.player.teamId ? f.team_h_difficulty : f.team_a_difficulty
  );
  if (fdrs.some((fdr) => fdr > 2)) return null;

  return {
    chip: "tripleCaptain",
    triggerGw: dgw.gameweek,
    status: "window",
    reason: `DGW${dgw.gameweek}: ${bestPlayer.player.webName} has double fixtures with FDR ${fdrs.join(" & ")} (both ≤ 2).`,
    draft: null,
  };
}
