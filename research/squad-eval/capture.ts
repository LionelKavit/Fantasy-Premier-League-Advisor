/**
 * squad-eval-captain-live — Phase A: pre-deadline capture of the app's FULL captain
 * pipeline (live `ep_next` + batched LLM context, exactly as the app ships it).
 *
 * Run BEFORE each gameweek deadline:
 *   npx tsx research/squad-eval/capture.ts [teamId]   (default: manager 2558300)
 *
 * Appends one record per GW to live-log.json. Idempotent pre-deadline (re-running
 * overwrites this GW's record); a record whose GW has started is NEVER overwritten;
 * a capture made after the deadline is stamped `postDeadline: true` so the score
 * step can exclude it (ep_next/ownership shift and lineups leak once picks lock).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fetchBootstrap, fetchFixtures, buildManagerProfile } from "../../lib/fpl-api";
import { runSquadAnalysisPipeline } from "../../lib/pipeline";
import { runCaptainWithContext } from "../../lib/captain";
import type { CaptainCandidate } from "../../lib/captain/types";

// 2026-27 entry (entries reset each season; 2025-26 was 10815578 — the replay's manager).
const DEFAULT_TEAM_ID = 2558300;
const LOG = join(import.meta.dirname, "live-log.json");

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

interface CandidateRecord {
  id: number;
  webName: string;
  captainScore: number;
  breakdown: Record<string, number>;
  epNext: number | null;
  compositeTotal: number;
  effectiveOwnership: number;
  rotationRisk: number;
  injurySeverity: number;
}

export interface LiveCaptureRecord {
  gw: number;
  teamId: number;
  capturedAt: string;
  deadline: string;
  postDeadline: boolean;
  pipelineGw: number; // analysis.currentGw as the app computed it (transparency)
  xi: number[];
  benchIds: number[];
  actualCaptainId: number | null; // the manager's own captain at capture time
  appCaptain: CandidateRecord | null;
  appVice: CandidateRecord | null;
  rankedCandidates: CandidateRecord[];
  baselines: { ppgId: number | null; ownId: number | null }; // point-in-time, for scoring
  llm: { used: true; confidence: string; narrativeSummary: string } | string;
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
  const existing = log.find((r) => r.gw === target.id);
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

  const record: LiveCaptureRecord = {
    gw: target.id,
    teamId,
    capturedAt: now.toISOString(),
    deadline: target.deadline_time,
    postDeadline: now >= new Date(target.deadline_time),
    pipelineGw: analysis.currentGw,
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
  };

  const next = log.filter((r) => r.gw !== target.id).concat(record).sort((a, b) => a.gw - b.gw);
  writeFileSync(LOG, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Captured GW ${target.id}: app captain ${record.appCaptain?.webName ?? "unavailable"}` +
      ` (score ${record.appCaptain?.captainScore.toFixed(2) ?? "—"}, ep_next ${record.appCaptain?.epNext ?? "—"})` +
      `, your captain at capture: ${record.actualCaptainId ?? "unavailable"}` +
      (record.postDeadline ? " · ⚠ POST-DEADLINE — will be excluded from scoring" : "")
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
