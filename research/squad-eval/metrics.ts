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

// ── Transfer aggregation (new-season-readiness Task 2) ────────────────────────
// Extracted unchanged from transfer-replay.ts so the historical floor and the live
// forward eval agree by construction. Generalised in two ways the replay never
// exercises (so its output is byte-identical): an action may carry several moves
// (the live optimizer allocates up to 5 free transfers), and a realized gain may be
// `null` while the gameweeks it spans are still being played (live only).
export interface TransferMove { outId: number; inId: number; }

export interface TransferRow {
  gw: number;
  appHold: boolean; appMoves: TransferMove[];
  appG1: number | null; appG3: number | null;       // realized (in − out) over next-1 / next-3, net of any hit
  mgrTransferred: boolean; mgrMoves: TransferMove[];
  mgrG1: number | null; mgrG3: number | null;       // same, net of the manager's exact hit cost
  mgrHit: number;
}

export function summarizeTransfers(
  rows: TransferRow[],
  name: (id: number) => string | number
): string[] {
  const n = rows.length;
  const rows1 = rows.filter((r) => r.appG1 !== null && r.mgrG1 !== null);
  const rows3 = rows.filter((r) => r.appG3 !== null && r.mgrG3 !== null);
  const mean = (subset: TransferRow[], f: (r: TransferRow) => number) =>
    subset.length ? (subset.reduce((s, r) => s + f(r), 0) / subset.length).toFixed(2) : "unavailable — no scored GWs";
  const appTransfers = rows.filter((r) => !r.appHold).length;
  const mgrTransfers = rows.filter((r) => r.mgrTransferred).length;

  // Head-to-head on next-3 realized gain (app action vs manager action).
  const wins = rows3.filter((r) => r.appG3! > r.mgrG3!).length;
  const ties = rows3.filter((r) => r.appG3 === r.mgrG3).length;
  const losses = rows3.filter((r) => r.appG3! < r.mgrG3!).length;
  const net3 = rows3.reduce((s, r) => s + (r.appG3! - r.mgrG3!), 0);
  // No-op accuracy: when the manager transferred and lost points (next-3), did the app hold?
  const mgrBadMoves = rows3.filter((r) => r.mgrTransferred && r.mgrG3! < 0);
  const appHeldOnBad = mgrBadMoves.filter((r) => r.appHold).length;

  const moves = (ms: TransferMove[]) => ms.map((m) => `${name(m.outId)}→${name(m.inId)}`).join(", ");
  const pending = (v: number | null) => (v === null ? "pending" : v);

  return [
    `### Decision points: ${n} gameweeks`,
    `- App recommended a transfer in **${appTransfers}/${n}** GWs (held ${n - appTransfers}); you transferred in **${mgrTransfers}/${n}**.`,
    ...(rows1.length < n || rows3.length < n
      ? [`- Realized so far: next-1 scored for **${rows1.length}/${n}**, next-3 for **${rows3.length}/${n}** (the rest span gameweeks still being played).`]
      : []),
    ``,
    `**Counterfactual gain vs holding** (realized in − out):`,
    `| | next-1 GW | next-3 GW |`,
    `|---|---|---|`,
    `| App recommendation | ${mean(rows1, (r) => r.appG1!)} | ${mean(rows3, (r) => r.appG3!)} |`,
    `| Your actual transfers (net of hits) | ${mean(rows1, (r) => r.mgrG1!)} | ${mean(rows3, (r) => r.mgrG3!)} |`,
    ``,
    `**Head-to-head (next-3 gain):** app ${wins}W / ${ties}T / ${losses}L vs you · net **${net3 >= 0 ? "+" : ""}${net3}** pts over the season`,
    `**No-op accuracy:** of your ${mgrBadMoves.length} transfers that lost points (next-3), the app would have held **${appHeldOnBad}/${mgrBadMoves.length}**.`,
    ``,
    `## Per-gameweek detail`,
    ``,
    `| GW | app rec (out→in) | app +/- (3GW) | your move | your +/- (3GW, net) |`,
    `|---|---|---|---|---|`,
    ...rows.map((r) =>
      `| ${r.gw} | ${r.appHold ? "hold" : moves(r.appMoves)} | ${r.appHold ? "—" : pending(r.appG3)} | ${r.mgrTransferred ? "transfer" + (r.mgrHit ? ` (-${r.mgrHit})` : "") : "hold"} | ${r.mgrTransferred ? pending(r.mgrG3) : "—"} |`),
    ``,
  ];
}
