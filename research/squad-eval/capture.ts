/**
 * squad-eval live capture — Phase A: pre-deadline capture of the app's FULL pipeline
 * (live `ep_next` + batched LLM context, exactly as the app ships it):
 *   - captain (squad-eval-captain-live), and
 *   - transfers (new-season-readiness Task 2 — the optimizer's recommendation).
 *
 * Run BEFORE each gameweek deadline:
 *   npx tsx research/squad-eval/capture.ts [teamId]   (default: manager 2558300)
 *
 * Appends one record per GW to live-log.json. Idempotent pre-deadline (re-running
 * overwrites this GW's record); a record whose GW has started is NEVER overwritten;
 * a capture made after the deadline is stamped `postDeadline: true` so the score
 * step can exclude it (ep_next/ownership shift and lineups leak once picks lock).
 *
 * Structural limit (public API): the squad the pipeline reads is the LAST LOCKED one
 * (`squadAsOfGw`) — the manager's in-progress changes for the target GW are invisible
 * until its deadline. The decision point is therefore "given the squad as locked for
 * G-1", the same as the historical replay. score-live.ts fetches the actually-locked
 * picks after the deadline and reports any drift.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  fetchBootstrap,
  fetchFixtures,
  fetchHistory,
  fetchTransferHistory,
  buildManagerProfile,
} from "../../lib/fpl-api";
import { runSquadAnalysisPipeline } from "../../lib/pipeline";
import { buildSignalMap } from "../../lib/pipeline/composite-scorer";
import { runCaptainWithContext } from "../../lib/captain";
import { runOptimizerWithContext } from "../../lib/optimizer";
import { detectGameweekFlags } from "../../lib/gameweek";
import { deriveFreeTransfers } from "../../lib/free-transfers";
import { clampFt, PIPELINE_CONFIG } from "../../lib/config";
import type { CaptainCandidate } from "../../lib/captain/types";
import type { TransferAction } from "../../lib/optimizer/types";
import type { ScoredPlayer } from "../../lib/pipeline/types";
import { writeCsv } from "../composite-backtest/csv";
import {
  DEFAULT_TEAM_ID,
  planCaptureWrite,
  type ActionRecord,
  type CandidateRecord,
  type LiveCaptureRecord,
  type TransferCaptureRecord,
} from "./live-types";

const LOG = join(import.meta.dirname, "live-log.json");
const POOL_DIR = join(import.meta.dirname, "pool");
const SEASON = "2026-27";

// ── Scored-pool dump ──────────────────────────────────────────────────────────
// One CSV row per player the pipeline scored this run (15 squad + candidate pool), in
// the composite-backtest dataset schema (research/composite-backtest/build-dataset.ts)
// so fit.py's feature columns line up 1:1 — plus live-only extras. Point-in-time by
// construction (captured pre-deadline with the real `ep_next`); the realized labels
// (`next1_points`/`next3_points`/`label_gws`) are blank here and filled by score-live.ts
// into live-dataset.csv once the gameweeks finish. `t2_*` (Tier-2) columns are kept for
// schema parity but unavailable — they are computed from the historical archive only.
const SM_KEYS = [
  "goalThreat", "assistPotential", "form", "bonus", "fixture", "minutes", "value",
  "cleanSheet", "xgcRate", "defensive", "goalAssistSetPiece", "saves", "suspensionPenalty",
];
const TIER2_COLUMNS = [
  "t2_dc_threshold_prob", "t2_team_attack_strength", "t2_days_since_last", "t2_matches_in_7d",
  "t2_penalty_taker", "t2_xg90_roll", "t2_finishing_roll", "t2_bps90_roll",
];
export const POOL_COLUMNS = [
  "season", "gw", "element", "position", "name", "team",
  "composite", "trend_adj", "goalThreat", "assistPotential", "formSignal", "bonusEfficiency",
  "cleanSheetRate", "defensiveScore", "savesRate", "minutesReliability", "fdrScore", "opponentStrength",
  "xP", "ppg", ...SM_KEYS.map((k) => `sm_${k}`), "sm_epNextSignal", ...TIER2_COLUMNS,
  "next1_points", "next3_points", "label_gws", "season_minutes", "low_minute", "has_fixture", "has_xP", "has_xg", "has_dc",
  // live-only extras (not in the backtest)
  "captured_at", "in_squad", "ep_this", "price", "selected_by_pct", "availability", "chance_next",
  "llm_rotationRisk", "llm_injurySeverity", "llm_adj", "trend_class", "fidelity",
  "post_deadline", // 1 ⇒ contaminated (captured after picks locked) — the dataset builder drops it
];
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

function poolRow(
  sp: ScoredPlayer,
  inSquad: boolean,
  gw: number,
  capturedAt: string,
  postDeadline: boolean
): Record<string, unknown> {
  const p = sp.player;
  const s = sp.statisticalSignals;
  const f = sp.fixtureSignals;
  const m = sp.marketSignals;
  const l = sp.llmSignals;
  const sm = buildSignalMap(s, f, p.position);
  const row: Record<string, unknown> = {
    season: SEASON, gw, element: p.id, position: p.position, name: p.webName, team: p.teamShortName,
    composite: round4(sp.score.total), trend_adj: round4(sp.score.trendAdjustment),
    goalThreat: round4(s.goalThreat), assistPotential: round4(s.assistPotential),
    formSignal: round4(s.formSignal), bonusEfficiency: round4(s.bonusEfficiency),
    cleanSheetRate: round4(s.cleanSheetRate), defensiveScore: round4(s.defensiveScore),
    savesRate: round4(s.savesRate), minutesReliability: round4(s.minutesReliability),
    fdrScore: round4(f.fdrScore), opponentStrength: round4(f.opponentStrength),
    xP: p.epNext ?? "", ppg: round4(p.pointsPerGame),
    sm_epNextSignal: round4(m.epNextSignal),
    next1_points: "", next3_points: "", label_gws: "",
    season_minutes: p.minutes, low_minute: p.minutes < PIPELINE_CONFIG.minMinutes ? 1 : 0,
    has_fixture: 1, has_xP: m.epNextAvailable ? 1 : 0, has_xg: 1, has_dc: 1,
    captured_at: capturedAt, in_squad: inSquad ? 1 : 0, ep_this: p.epThis ?? "", price: p.price,
    selected_by_pct: p.selectedByPercent, availability: p.availability.status,
    chance_next: p.availability.chanceOfPlayingNext ?? "",
    llm_rotationRisk: round4(l.rotationRisk), llm_injurySeverity: round4(l.injurySeverity),
    llm_adj: round4(sp.score.llmAdjustment), trend_class: sp.score.trendClassification ?? "",
    fidelity: sp.fidelity, // which scoring tier produced the row (all "full" from the pipeline)
    post_deadline: postDeadline ? 1 : 0,
  };
  for (const k of SM_KEYS) row[`sm_${k}`] = round4(sm[k] ?? 0);
  for (const k of TIER2_COLUMNS) row[k] = ""; // unavailable — Tier-2 features come from the historical archive only
  return row;
}

// The harness runs outside Next.js, so .env.local isn't auto-loaded. The LLM layer
// fail-safes without a key (deterministic pick unaffected), but the point of the live
// eval is the FULL pipeline — so surface the key if the file has one.
function loadEnvLocal() {
  if (process.env.ANTHROPIC_API_KEY) return;
  const envFile = join(import.meta.dirname, "../../.env.local");
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    // Dotenv-style tolerance: whitespace around `=`, quotes around the value.
    const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (v) process.env.ANTHROPIC_API_KEY = v;
  }
}

function toRecord(c: CaptainCandidate): CandidateRecord {
  return {
    id: c.player.player.id,
    webName: c.player.player.webName,
    captainScore: c.captainScore.total,
    breakdown: c.captainScore.breakdown,
    epNext: c.player.player.epNext,
    compositeTotal: c.player.score.total,
    effectiveOwnership: c.effectiveOwnership,
    rotationRisk: c.player.llmSignals.rotationRisk,
    injurySeverity: c.player.llmSignals.injurySeverity,
  };
}

function toAction(a: TransferAction): ActionRecord {
  return {
    type: a.type,
    moves: a.transfers.map((t) => {
      const epOut = t.weakPlayer.player.epNext;
      const epIn = t.candidate.player.epNext;
      return {
        outId: t.weakPlayer.player.id,
        outName: t.weakPlayer.player.webName,
        inId: t.candidate.player.id,
        inName: t.candidate.player.webName,
        priceDelta: t.priceDelta,
        epOut,
        epIn,
        epDelta: epOut !== null && epIn !== null ? epIn - epOut : null,
        gw1Gain: t.gw1Gain,
        gw5Gain: t.gw5Gain,
      };
    }),
    netPointsCost: a.netPointsCost,
    netGain: a.netGain,
    breakEvenGw: a.breakEvenGw,
  };
}

async function main() {
  loadEnvLocal();
  const teamId = Number(process.argv[2]) || DEFAULT_TEAM_ID;
  const now = new Date();

  const boot = await fetchBootstrap();
  // The GW this capture recommends for: the next deadline still in the future.
  const target =
    boot.gameweeks.find((g) => !g.finished && new Date(g.deadline_time) > now) ?? null;
  if (!target) {
    console.error("No upcoming gameweek deadline — season over or API mid-rollover. Nothing captured.");
    process.exit(1);
  }

  const log: LiveCaptureRecord[] = existsSync(LOG)
    ? JSON.parse(readFileSync(LOG, "utf8"))
    : [];
  const existing = log.find((r) => r.gw === target.id && r.teamId === teamId);
  if (existing && now >= new Date(existing.deadline)) {
    console.error(`GW ${target.id} has started — existing record preserved, not overwritten.`);
    process.exit(1);
  }

  console.log(`Capturing GW ${target.id} (deadline ${target.deadline_time}) for manager ${teamId}…`);
  const analysis = await runSquadAnalysisPipeline(teamId);
  const [managerProfile, fixtures] = await Promise.all([
    buildManagerProfile(teamId, boot),
    fetchFixtures(),
  ]);
  const result = await runCaptainWithContext({
    analysis,
    managerProfile,
    teams: boot.teams,
    fixtures,
  });

  const xiPicks = analysis.picks.filter((p) => p.position <= 11);
  const xiIds = xiPicks.map((p) => p.element);
  const xiScored = analysis.rankedSquad.filter((s) => xiIds.includes(s.player.id));
  const byPpg = [...xiScored].sort((a, b) => b.player.pointsPerGame - a.player.pointsPerGame)[0];
  const byOwn = [...xiScored].sort((a, b) => b.player.selectedByPercent - a.player.selectedByPercent)[0];

  // ── Transfer leg: the optimizer exactly as the app (and the deadline brief) run it ──
  let transfer: TransferCaptureRecord | string;
  if (target.id === 1) {
    transfer = "unavailable — GW1: squad changes are unlimited pre-deadline, there is no transfer decision to evaluate";
  } else {
    try {
      const [history, transferHistory] = await Promise.all([
        fetchHistory(teamId),
        fetchTransferHistory(teamId),
      ]);
      const freeTransfers = clampFt(deriveFreeTransfers(transferHistory, history.chips, target.id));
      const gwFlags = detectGameweekFlags(fixtures, analysis.currentGw, boot.teams.map((t) => t.id));
      const opt = await runOptimizerWithContext(
        { analysis, managerProfile, players: boot.players, teams: boot.teams, fixtures, gwFlags },
        freeTransfers,
        result.tripleCaptainAdvice ?? undefined
      );
      transfer = {
        freeTransfersAssumed: freeTransfers,
        bank: analysis.bank,
        primary: toAction(opt.primaryRecommendation),
        secondary: opt.secondaryRecommendation ? toAction(opt.secondaryRecommendation) : null,
        hitVerdict: opt.hitVerdict,
        dataNotice: opt.dataNotice,
        alerts: opt.alerts,
        confidence: opt.confidence,
        narrativeSummary: opt.narrativeSummary,
      };
    } catch (e) {
      transfer = `unavailable — optimizer failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // ── Deadline guard: re-read the clock now that the pipeline has run ─────────────
  // (`now` above chose the target GW; minutes have passed). A post-deadline capture
  // never overwrites a clean record or the clean pool file.
  const writeAt = new Date();
  const plan = planCaptureWrite({ gw: target.id, deadline: target.deadline_time, now: writeAt, existing });

  // ── Scored-pool dump (every row the pipeline scored, point-in-time) ────────────
  const capturedAt = writeAt.toISOString();
  const squadRows = analysis.rankedSquad.map((sp) => poolRow(sp, true, target.id, capturedAt, plan.postDeadline));
  const candidateRows = (analysis.scoredCandidatePool ?? []).map((sp) =>
    poolRow(sp, false, target.id, capturedAt, plan.postDeadline)
  );
  mkdirSync(POOL_DIR, { recursive: true });
  const poolFile = plan.poolFile;
  writeCsv(join(POOL_DIR, poolFile), POOL_COLUMNS, [...squadRows, ...candidateRows]);

  const record: LiveCaptureRecord = {
    gw: target.id,
    teamId,
    capturedAt,
    deadline: target.deadline_time,
    postDeadline: plan.postDeadline,
    captureMode: "pre-deadline",
    pipelineGw: analysis.currentGw,
    squadAsOfGw: analysis.currentGw,
    xi: xiIds,
    benchIds: analysis.picks.filter((p) => p.position > 11).map((p) => p.element),
    actualCaptainId: analysis.picks.find((p) => p.is_captain)?.element ?? null,
    appCaptain: result.captain ? toRecord(result.captain) : null,
    appVice: result.viceCaptain ? toRecord(result.viceCaptain) : null,
    rankedCandidates: result.rankedCandidates.map(toRecord),
    baselines: { ppgId: byPpg?.player.id ?? null, ownId: byOwn?.player.id ?? null },
    llm: process.env.ANTHROPIC_API_KEY
      ? { used: true, confidence: result.confidence, narrativeSummary: result.narrativeSummary }
      : "unavailable — ANTHROPIC_API_KEY not set (fail-safe synthesis; deterministic pick unaffected)",
    transfer,
    pool: {
      file: `pool/${poolFile}`,
      rows: squadRows.length + candidateRows.length,
      squadRows: squadRows.length,
      candidateRows: candidateRows.length,
    },
    // A previous score-live sync may already have written realized data for this GW
    // (only possible if the GW finished — in which case we never get here).
    ...(existing?.realized ? { realized: existing.realized } : {}),
  };

  if (plan.writeRecord) {
    const next = log
      .filter((r) => !(r.gw === target.id && r.teamId === teamId))
      .concat(record)
      .sort((a, b) => a.gw - b.gw || a.teamId - b.teamId);
    writeFileSync(LOG, JSON.stringify(next, null, 2) + "\n");
  }
  if (plan.note) console.error(`⚠ ${plan.note}`);

  const sumEp = (moves: { epDelta?: number | null }[]): number | null =>
    moves.every((m) => typeof m.epDelta === "number")
      ? moves.reduce((s, m) => s + (m.epDelta as number), 0)
      : null;
  const signed = (v: number, dp: number) => `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
  const transferLine =
    typeof transfer === "string"
      ? transfer
      : transfer.primary.moves.length
        ? `${transfer.primary.type} ${transfer.primary.moves.map((m) => `${m.outName}→${m.inName}`).join(", ")}` +
          ` (Δep ${sumEp(transfer.primary.moves) === null ? "unavailable" : signed(sumEp(transfer.primary.moves)!, 1)}` +
          `, composite ${signed(transfer.primary.netGain, 3)}, ${transfer.freeTransfersAssumed} FT assumed)`
        : `hold (${transfer.primary.type}; ${transfer.freeTransfersAssumed} FT assumed${transfer.dataNotice ? `; ${transfer.dataNotice}` : ""})`;
  console.log(
    `Captured GW ${target.id} (squad as locked for GW ${analysis.currentGw}):\n` +
      `  captain  → ${record.appCaptain?.webName ?? "unavailable"}` +
      ` (score ${record.appCaptain?.captainScore.toFixed(2) ?? "—"}, ep_next ${record.appCaptain?.epNext ?? "—"})` +
      `; your armband in that squad: ${record.actualCaptainId ?? "unavailable"}\n` +
      `  transfer → ${transferLine}\n` +
      `  pool     → ${record.pool!.rows} scored rows (${record.pool!.squadRows} squad + ${record.pool!.candidateRows} candidates) → ${record.pool!.file}` +
      (record.postDeadline
        ? `\n  ⚠ POST-DEADLINE — ${plan.writeRecord ? "record flagged, excluded from scoring" : "record NOT written (clean one preserved)"}; pool rows are audit-only`
        : "")
  );
}

main().catch((e) => {
  console.error(`Capture failed: ${e instanceof Error ? e.message : e}`);
  console.error(
    "Note: pre-GW1 the FPL picks endpoint may 404 until the manager's first squad locks —" +
      " GW1 capture becomes possible once the entry exists; from GW2 the last locked squad is always available."
  );
  process.exit(1);
});
