/**
 * squad-eval-captain-live — Phase B: score captured gameweeks once their fixtures are
 * finished, with the SAME metric code as the historical replay (metrics.ts), and write
 * live-report.md including the side-by-side vs the deterministic floor.
 *
 * Run any time after a captured GW finishes:
 *   npx tsx research/squad-eval/score-live.ts [teamId]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fetchBootstrap, fetchLiveEvent, fetchPicks } from "../../lib/fpl-api";
import { summarize, type GwResult } from "./metrics";
import type { LiveCaptureRecord } from "./capture";

const LOG = join(import.meta.dirname, "live-log.json");
const REPORT = join(import.meta.dirname, "live-report.md");
const SEASON_GWS = 38;

// Deterministic-floor headline (2025-26 replay, 36 GWs) for the side-by-side.
// Source: research/squad-eval/report.md — regenerate with replay.ts if the cache changes.
const FLOOR = {
  label: "2025-26 replay floor (ep_next absent, neutral LLM, 36 GWs)",
  hitRate: "10/36 = 28%",
  captured: "57%",
  headToHead: "6W / 26T / 4L · net +9 captain-pts (+18 squad pts)",
  meanAppPts: "7.06",
};

async function main() {
  if (!existsSync(LOG)) {
    console.error(`No live-log.json yet — run capture.ts before a deadline first.`);
    process.exit(1);
  }
  const teamId = Number(process.argv[2]) || undefined;
  const log: LiveCaptureRecord[] = JSON.parse(readFileSync(LOG, "utf8"));
  const records = teamId ? log.filter((r) => r.teamId === teamId) : log;

  const boot = await fetchBootstrap();
  const nameOf = new Map(boot.players.map((p) => [p.id, p.webName]));
  const finished = new Set(boot.gameweeks.filter((g) => g.finished).map((g) => g.id));

  const rows: GwResult[] = [];
  const skipped: string[] = [];
  for (const rec of records) {
    if (rec.postDeadline) {
      skipped.push(`GW ${rec.gw}: captured post-deadline (contaminated) — excluded`);
      continue;
    }
    if (!finished.has(rec.gw)) {
      skipped.push(`GW ${rec.gw}: not finished yet — pending`);
      continue;
    }
    if (rec.appCaptain === null) {
      skipped.push(`GW ${rec.gw}: no app captain recorded — excluded`);
      continue;
    }
    const live = await fetchLiveEvent(rec.gw);
    const pts = new Map(live.elements.map((e) => [e.id, e.stats.total_points ?? 0]));
    const ptsOf = (id: number | null) => (id === null ? 0 : pts.get(id) ?? 0);
    const xiPts = rec.xi.map((id) => ptsOf(id));
    // The chip actually played is realized data (like points), not a captured input.
    const chip = await fetchPicks(rec.teamId, rec.gw)
      .then((p) => p.active_chip)
      .catch(() => null);
    rows.push({
      gw: rec.gw,
      chip,
      appId: rec.appCaptain.id,
      appPts: ptsOf(rec.appCaptain.id),
      actualId: rec.actualCaptainId ?? -1,
      actualPts: ptsOf(rec.actualCaptainId),
      bestPts: Math.max(...xiPts),
      ppgPts: ptsOf(rec.baselines.ppgId),
      ownPts: ptsOf(rec.baselines.ownId),
      randomPts: xiPts.reduce((s, p) => s + p, 0) / xiPts.length,
    });
  }

  const n = rows.length;
  const provisional = n < SEASON_GWS;
  const tc = rows.filter((r) => r.chip === "3xc");
  const out: string[] = [
    `# Captain live-eval — full pipeline, 2026-27${provisional ? ` (PROVISIONAL, n=${n})` : ""}`,
    ``,
    `Prospective scoring of the app's full captain pipeline (live \`ep_next\` + LLM context),`,
    `captured pre-deadline each gameweek and scored on realized \`total_points\`.`,
    provisional
      ? `**Provisional:** ${n} of ~${SEASON_GWS} gameweeks scored — read directionally, not conclusively.`
      : ``,
    ``,
    ...summarize(rows, "All scored gameweeks"),
    ...(tc.length ? summarize(rows.filter((r) => r.chip !== "3xc"), "Excluding Triple-Captain GWs") : []),
    `## Full pipeline vs deterministic floor`,
    ``,
    `| | ${FLOOR.label} | Live full pipeline (n=${n}${provisional ? ", provisional" : ""}) |`,
    `|---|---|---|`,
    `| Captain hit-rate | ${FLOOR.hitRate} | ${n ? `${rows.filter((r) => r.appPts >= r.bestPts && r.bestPts > 0).length}/${n}` : "unavailable — no scored GWs"} |`,
    `| Points-captured | ${FLOOR.captured} | ${n ? `${(100 * rows.reduce((s, r) => s + (r.bestPts > 0 ? r.appPts / r.bestPts : 1), 0) / n).toFixed(0)}%` : "unavailable — no scored GWs"} |`,
    `| Head-to-head vs actual | ${FLOOR.headToHead} | ${n ? `${rows.filter((r) => r.appPts > r.actualPts).length}W / ${rows.filter((r) => r.appPts === r.actualPts).length}T / ${rows.filter((r) => r.appPts < r.actualPts).length}L` : "unavailable — no scored GWs"} |`,
    `| Mean app captain pts/GW | ${FLOOR.meanAppPts} | ${n ? (rows.reduce((s, r) => s + r.appPts, 0) / n).toFixed(2) : "unavailable — no scored GWs"} |`,
    ``,
    ...(skipped.length ? [`## Not scored`, ``, ...skipped.map((s) => `- ${s}`), ``] : []),
    `## Per-gameweek detail`,
    ``,
    `| GW | chip | app pick | app pts | your pick | your pts | best in XI |`,
    `|---|---|---|---|---|---|---|`,
    ...rows.map(
      (r) =>
        `| ${r.gw} | ${r.chip ?? ""} | ${nameOf.get(r.appId) ?? r.appId} | ${r.appPts} | ${nameOf.get(r.actualId) ?? r.actualId} | ${r.actualPts} | ${r.bestPts} |`
    ),
    ``,
  ];

  const report = out.filter((l) => l !== null).join("\n");
  writeFileSync(REPORT, report);
  console.log(report);
}

main().catch((e) => {
  console.error(`Scoring failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
