/**
 * Shared captain-eval metric aggregation (squad-eval-captain-live Task 0) — extracted
 * unchanged from replay.ts so the historical replay (deterministic floor) and the live
 * forward eval (full pipeline) agree by construction.
 */
export interface GwResult {
  gw: number; chip: string | null; appId: number; appPts: number; actualId: number;
  actualPts: number; bestPts: number; ppgPts: number; ownPts: number; randomPts: number;
}

export function summarize(rows: GwResult[], label: string): string[] {
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
