/**
 * squad-eval-captain-replay — Tasks 1-3: reconstruct point-in-time state, replay the
 * app's real captain pipeline on the manager's actual 2025-26 XI each GW, and score it.
 *
 * Runs entirely off the local cache (run fetch-cache.ts first). FPL API end-to-end;
 * no vaastav, no xP. Caveats baked in: ep_next absent (epBlend falls back to the model
 * projection), neutral LLM, availability assumed available, penalty order + ownership
 * total from the season-end bootstrap snapshot. Captaincy scored on realized total_points.
 *
 * Run:  npx tsx research/squad-eval/replay.ts
 */
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Pick } from "../../lib/types";
import { scorePlayerLite } from "../../lib/pipeline/lite-scoring";
import { batchComputeCaptainScores } from "../../lib/captain/scoring";
import { rankCaptains, selectCaptaincy } from "../../lib/captain/ranker";
import { CACHE, load, teams, fixtures, staticById, realized, buildPlayer } from "./reconstruct";

const GWS = Array.from({ length: 36 }, (_, i) => i + 3); // GW3..38

// ── Per-GW replay ─────────────────────────────────────────────────────────────
interface GwResult {
  gw: number; chip: string | null; appId: number; appPts: number; actualId: number;
  actualPts: number; bestPts: number; ppgPts: number; ownPts: number; randomPts: number;
}
function replayGw(gw: number): GwResult | null {
  const file = join(CACHE, `picks-${gw}.json`);
  if (!existsSync(file)) return null;
  const picksData = load(`picks-${gw}`) as { picks: Pick[]; active_chip: string | null };
  const xi = picksData.picks.filter((p) => p.position <= 11);
  if (xi.length < 11) return null;
  const actualId = picksData.picks.find((p) => p.is_captain)?.element ?? -1;

  const scored = xi.map((p) => scorePlayerLite(buildPlayer(p.element, gw),
    { fixtures, teams, currentGw: gw, maxEpNext: 1 }));
  const candidates = batchComputeCaptainScores(scored, picksData.picks, fixtures, teams, gw, true);
  const ranked = rankCaptains(candidates);
  const { captain } = selectCaptaincy(ranked, fixtures, gw);
  const appId = captain?.player.player.id ?? ranked[0]?.player.player.id ?? -1;

  // realized points within the XI
  const xiPts = xi.map((p) => ({ id: p.element, pts: realized(p.element, gw).points }));
  const bestPts = Math.max(...xiPts.map((x) => x.pts));
  const ptsOf = (id: number) => xiPts.find((x) => x.id === id)?.pts ?? 0;
  // baselines, computed from point-in-time signals on the same XI
  const byPpg = [...scored].sort((a, b) => b.player.pointsPerGame - a.player.pointsPerGame)[0];
  const byOwn = [...scored].sort((a, b) => b.player.selectedByPercent - a.player.selectedByPercent)[0];
  const randomPts = xiPts.reduce((s, x) => s + x.pts, 0) / xiPts.length; // expected random captain

  return {
    gw, chip: picksData.active_chip, appId, appPts: ptsOf(appId), actualId, actualPts: ptsOf(actualId),
    bestPts, ppgPts: ptsOf(byPpg.player.id), ownPts: ptsOf(byOwn.player.id), randomPts,
  };
}

// ── Aggregate + report ────────────────────────────────────────────────────────
function summarize(rows: GwResult[], label: string): string[] {
  const n = rows.length;
  if (!n) return [`### ${label}: no gameweeks`];
  const hit = rows.filter((r) => r.appPts >= r.bestPts && r.bestPts > 0).length;
  const captured = rows.reduce((s, r) => s + (r.bestPts > 0 ? r.appPts / r.bestPts : 1), 0) / n;
  const wins = rows.filter((r) => r.appPts > r.actualPts).length;
  const ties = rows.filter((r) => r.appPts === r.actualPts).length;
  const losses = rows.filter((r) => r.appPts < r.actualPts).length;
  const netRaw = rows.reduce((s, r) => s + (r.appPts - r.actualPts), 0);
  const mean = (k: keyof GwResult) => (rows.reduce((s, r) => s + (r[k] as number), 0) / n).toFixed(2);
  return [
    `### ${label} — ${n} gameweeks`,
    ``,
    `**Captain hit-rate** (app pick = realized top scorer in XI): **${hit}/${n} = ${(100 * hit / n).toFixed(0)}%**`,
    `**Points-captured ratio** (app captain ÷ best-in-XI): **${(100 * captured).toFixed(0)}%**`,
    ``,
    `**Head-to-head vs your actual captain:** ${wins}W / ${ties}T / ${losses}L · net **${netRaw >= 0 ? "+" : ""}${netRaw}** captain-pts (×2 ⇒ ${netRaw >= 0 ? "+" : ""}${netRaw * 2} squad pts over the season)`,
    ``,
    `| predictor | mean captain pts/GW |`,
    `|---|---|`,
    `| Perfect (top scorer in XI) | ${mean("bestPts")} |`,
    `| **App captain pipeline** | **${mean("appPts")}** |`,
    `| Your actual captain | ${mean("actualPts")} |`,
    `| Baseline: highest season-to-date PPG | ${mean("ppgPts")} |`,
    `| Baseline: highest ownership | ${mean("ownPts")} |`,
    `| Baseline: random-in-XI (expected) | ${mean("randomPts")} |`,
    ``,
  ];
}

function main() {
  const rows = GWS.map(replayGw).filter((r): r is GwResult => r !== null);
  const tc = rows.filter((r) => r.chip === "3xc");
  const out: string[] = [
    `# Captain replay — manager 10815578, 2025-26 (GW3-38)`,
    ``,
    `Replay of the app's real captain pipeline on the actual squads, scored vs realized points.`,
    `**Caveats:** \`ep_next\` absent (epBlend → model projection); neutral LLM; availability assumed`,
    `available; penalty order + ownership-total from the season-end bootstrap. Captaincy scored on`,
    `realized \`total_points\` (multiplier-invariant comparison).`,
    ``,
    ...summarize(rows, "All gameweeks"),
    ...(tc.length ? summarize(rows.filter((r) => r.chip !== "3xc"), "Excluding Triple-Captain GWs") : []),
    ...(tc.length ? [`_Triple-Captain GW(s): ${tc.map((r) => r.gw).join(", ")}._`, ``] : []),
    `## Per-gameweek detail`,
    ``,
    `| GW | chip | app pick | app pts | your pick | your pts | best in XI |`,
    `|---|---|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.gw} | ${r.chip ?? ""} | ${staticById.get(r.appId)?.webName ?? r.appId} | ${r.appPts} | ${staticById.get(r.actualId)?.webName ?? r.actualId} | ${r.actualPts} | ${r.bestPts} |`),
    ``,
  ];
  const report = out.join("\n");
  writeFileSync(join(import.meta.dirname, "report.md"), report);
  console.log(report);
}

main();
