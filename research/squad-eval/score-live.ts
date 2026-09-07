/**
 * squad-eval live scoring — Phase B: once a captured gameweek's fixtures are finished,
 *   1. sync the squad the manager ACTUALLY locked for every finished GW (public
 *      post-deadline) + realized points into the log (`realized`), backfilling a
 *      picks-only record for any GW with no capture (GW1 — nothing is public before
 *      the first deadline), so the season log carries the full picture from GW1;
 *   2. score the captain captures with the SAME metric code as the historical replay
 *      (metrics.ts) against the locked XI, and write live-report.md with the
 *      side-by-side vs the deterministic floor;
 *   3. score the transfer captures (realized in − out over next-1 / next-3 vs hold and vs
 *      the manager's actual moves, net of hits) with the SAME aggregation as
 *      transfer-replay.ts, and write live-transfer-report.md with its floor side-by-side.
 *
 * Run any time after a captured GW finishes:
 *   npx tsx research/squad-eval/score-live.ts [teamId] [--gw 4,5]   (default: manager 2558300)
 * `--gw` restricts the realized sync + captain/transfer scoring to those gameweeks (the
 * datasets are always rebuilt in full); the default scores everything, idempotently.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readCsv, writeCsv } from "../composite-backtest/csv";
import {
  fetchBootstrap,
  fetchLiveEvent,
  fetchPicks,
  fetchHistory,
  fetchTransferHistory,
} from "../../lib/fpl-api";
import type { Gameweek } from "../../lib/types";
import { summarize, summarizeTransfers, type GwResult, type TransferRow } from "./metrics";
// Types/constants only — never import a value from capture.ts (it runs main() on load).
import { DEFAULT_TEAM_ID, type LiveCaptureRecord, type RealizedGw, type RealizedPlayer } from "./live-types";

const LOG = join(import.meta.dirname, "live-log.json");
const REPORT = join(import.meta.dirname, "live-report.md");
const TRANSFER_REPORT = join(import.meta.dirname, "live-transfer-report.md");
const POOL_DIR = join(import.meta.dirname, "pool");
const DATASET = join(import.meta.dirname, "live-dataset.csv"); // universe (lite) — the fit's input
const POOL_DATASET = join(import.meta.dirname, "live-pool-dataset.csv"); // squad + candidates (full tier)
const SEASON_GWS = 38;

// Deterministic-floor headlines (2025-26 replays) for the side-by-sides.
// Source: research/squad-eval/report.md + transfer-report.md — regenerate with
// replay.ts / transfer-replay.ts if the cache changes.
const FLOOR = {
  label: "2025-26 replay floor (ep_next absent, neutral LLM, 36 GWs)",
  hitRate: "10/36 = 28%",
  captured: "57%",
  headToHead: "6W / 26T / 4L · net +9 captain-pts (+18 squad pts)",
  meanAppPts: "7.06",
};
const TRANSFER_FLOOR = {
  label: "2025-26 replay floor (ep_next absent, 35 decision GWs, 1 FT assumed)",
  appTransferRate: "0/35 (held every GW)",
  appMean: "0.00 / 0.00",
  mgrMean: "3.49 / 5.83",
  headToHead: "2W / 19T / 14L · net −204 pts",
  noOp: "2/2",
};

const isPreDeadline = (r: LiveCaptureRecord) => (r.captureMode ?? "pre-deadline") === "pre-deadline";

async function main() {
  if (!existsSync(LOG)) {
    console.error(`No live-log.json yet — run capture.ts before a deadline first.`);
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  const gwFlag = argv.indexOf("--gw");
  const onlyGws = gwFlag >= 0 ? new Set((argv[gwFlag + 1] ?? "").split(",").map(Number).filter((n) => n > 0)) : null;
  const teamId = Number(argv.find((a, i) => /^\d+$/.test(a) && i !== gwFlag + 1)) || DEFAULT_TEAM_ID;
  const wanted = (gw: number) => onlyGws === null || onlyGws.has(gw);
  const now = new Date().toISOString();
  const log: LiveCaptureRecord[] = JSON.parse(readFileSync(LOG, "utf8"));
  const records = log.filter((r) => r.teamId === teamId);

  const boot = await fetchBootstrap();
  const nameOf = new Map(boot.players.map((p) => [p.id, p.webName]));
  const name = (id: number | null) => (id === null || id < 0 ? "—" : nameOf.get(id) ?? String(id));
  const gwById = new Map(boot.gameweeks.map((g) => [g.id, g]));
  const finished = new Set(boot.gameweeks.filter((g) => g.finished).map((g) => g.id));
  const lastFinished = Math.max(0, ...finished);

  // Realized points per GW, fetched once, only for finished GWs.
  const liveCache = new Map<number, Map<number, number>>();
  async function pointsFor(gw: number): Promise<Map<number, number> | null> {
    if (!finished.has(gw)) return null;
    if (!liveCache.has(gw)) {
      const live = await fetchLiveEvent(gw);
      liveCache.set(gw, new Map(live.elements.map((e) => [e.id, e.stats.total_points ?? 0])));
    }
    return liveCache.get(gw)!;
  }
  /** Realized (in − out) over [gw, gw+span-1]; null while any GW in the span is unfinished. */
  async function gainOver(moves: { inId: number; outId: number }[], gw: number, span: number): Promise<number | null> {
    let g = 0;
    for (let k = gw; k < gw + span && k <= SEASON_GWS; k++) {
      const pts = await pointsFor(k);
      if (!pts) return null;
      for (const m of moves) g += (pts.get(m.inId) ?? 0) - (pts.get(m.outId) ?? 0);
    }
    return g;
  }

  // ── 1. Realized sync: the locked squad + points for every finished GW ─────────
  const [history, transferHistory] = await Promise.all([
    fetchHistory(teamId),
    fetchTransferHistory(teamId),
  ]);
  const syncNotes: string[] = [];
  for (let gw = 1; gw <= lastFinished; gw++) {
    if (!wanted(gw)) continue;
    const picks = await fetchPicks(teamId, gw).catch(() => null);
    if (!picks) {
      syncNotes.push(`GW ${gw}: locked picks unavailable — picks endpoint failed (entry may not have existed yet)`);
      continue;
    }
    const pts = (await pointsFor(gw))!;
    const toPlayer = (p: (typeof picks.picks)[number]): RealizedPlayer => ({
      id: p.element,
      webName: nameOf.get(p.element) ?? String(p.element),
      multiplier: p.multiplier,
      isCaptain: p.is_captain,
      isVice: p.is_vice_captain,
      points: pts.get(p.element) ?? 0,
    });
    const h = history.current.find((c) => c.event === gw);
    const realized: RealizedGw = {
      syncedAt: now,
      chip: picks.active_chip,
      xi: picks.picks.filter((p) => p.position <= 11).map(toPlayer),
      bench: picks.picks.filter((p) => p.position > 11).map(toPlayer),
      captainId: picks.picks.find((p) => p.is_captain)?.element ?? null,
      viceId: picks.picks.find((p) => p.is_vice_captain)?.element ?? null,
      gwPoints: h?.points ?? null,
      pointsOnBench: h?.pointsOnBench ?? picks.entry_history.points_on_bench,
      gwRank: h?.rank ?? null,
      overallRank: h?.overallRank ?? null,
      transfers: transferHistory
        .filter((t) => t.event === gw)
        .map((t) => ({
          outId: t.elementOut,
          outName: nameOf.get(t.elementOut) ?? String(t.elementOut),
          inId: t.elementIn,
          inName: nameOf.get(t.elementIn) ?? String(t.elementIn),
          time: t.time,
        })),
      transfersCost: picks.entry_history.event_transfers_cost,
      bank: picks.entry_history.bank,
      squadValue: picks.entry_history.value,
    };

    const rec = records.find((r) => r.gw === gw);
    if (rec) {
      rec.realized = realized;
    } else {
      // No capture existed for this GW — backfill a picks-only record so the season log
      // is complete from GW1. It carries no app recommendation and is never scored.
      const g: Gameweek | undefined = gwById.get(gw);
      const reason =
        gw === 1
          ? "no pre-deadline capture — the public API exposes no picks before the GW1 deadline"
          : "no pre-deadline capture was made for this gameweek";
      records.push({
        gw,
        teamId,
        capturedAt: now,
        deadline: g?.deadline_time ?? "",
        postDeadline: false,
        captureMode: "retrospective",
        pipelineGw: gw,
        squadAsOfGw: gw,
        xi: realized.xi.map((p) => p.id),
        benchIds: realized.bench.map((p) => p.id),
        actualCaptainId: realized.captainId,
        appCaptain: null,
        appVice: null,
        rankedCandidates: [],
        baselines: { ppgId: null, ownId: null },
        llm: `unavailable — ${reason}`,
        transfer: `unavailable — ${reason}`,
        realized,
      });
    }
  }
  records.sort((a, b) => a.gw - b.gw);
  const merged = log
    .filter((r) => r.teamId !== teamId)
    .concat(records)
    .sort((a, b) => a.gw - b.gw || a.teamId - b.teamId);
  writeFileSync(LOG, JSON.stringify(merged, null, 2) + "\n");

  // ── 2. Captain scoring — against the XI the manager actually locked ───────────
  const rows: GwResult[] = [];
  const skipped: string[] = [];
  const drift: string[] = [];
  for (const rec of records) {
    if (!wanted(rec.gw)) continue;
    if (!isPreDeadline(rec)) {
      skipped.push(`GW ${rec.gw}: picks-only backfill (no pre-deadline capture) — excluded`);
      continue;
    }
    if (rec.postDeadline) {
      skipped.push(`GW ${rec.gw}: captured post-deadline (contaminated) — excluded`);
      continue;
    }
    if (!finished.has(rec.gw) || !rec.realized) {
      skipped.push(`GW ${rec.gw}: not finished yet — pending`);
      continue;
    }
    if (rec.appCaptain === null) {
      skipped.push(`GW ${rec.gw}: no app captain recorded — excluded`);
      continue;
    }
    const pts = (await pointsFor(rec.gw))!;
    const ptsOf = (id: number | null) => (id === null ? 0 : pts.get(id) ?? 0);
    const r = rec.realized;
    const lockedXi = r.xi.map((p) => p.id);
    const xiPts = r.xi.map((p) => p.points);

    // The capture saw the previous GW's locked squad; report what changed before lock.
    const capturedSet = new Set(rec.xi);
    const lockedSet = new Set(lockedXi);
    const out = rec.xi.filter((id) => !lockedSet.has(id)).map((id) => name(id));
    const inn = lockedXi.filter((id) => !capturedSet.has(id)).map((id) => name(id));
    const notes: string[] = [];
    if (out.length || inn.length) notes.push(`XI changed before lock (out: ${out.join(", ") || "—"}; in: ${inn.join(", ") || "—"})`);
    if (rec.actualCaptainId !== r.captainId)
      notes.push(`armband moved ${name(rec.actualCaptainId)} → ${name(r.captainId)} before lock`);
    if (!lockedSet.has(rec.appCaptain.id))
      notes.push(`app pick ${rec.appCaptain.webName} was NOT in the locked XI (scored on their points regardless)`);
    if (notes.length) drift.push(`GW ${rec.gw}: ${notes.join("; ")}`);

    rows.push({
      gw: rec.gw,
      chip: r.chip,
      appId: rec.appCaptain.id,
      appPts: ptsOf(rec.appCaptain.id),
      actualId: r.captainId ?? -1,
      actualPts: ptsOf(r.captainId),
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
    `captured pre-deadline each gameweek and scored on realized \`total_points\` against the XI`,
    `you actually locked (fetched post-deadline; the capture itself only sees the previous`,
    `GW's locked squad — see "Squad drift").`,
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
    ...(drift.length
      ? [`## Squad drift (capture saw the previous locked squad)`, ``, ...drift.map((s) => `- ${s}`), ``]
      : []),
    `## Per-gameweek detail`,
    ``,
    `| GW | chip | app pick | app pts | your pick | your pts | best in XI |`,
    `|---|---|---|---|---|---|---|`,
    ...rows.map(
      (r) =>
        `| ${r.gw} | ${r.chip ?? ""} | ${name(r.appId)} | ${r.appPts} | ${name(r.actualId)} | ${r.actualPts} | ${r.bestPts} |`
    ),
    ``,
    `## Season log — squads as locked`,
    ``,
    ...records.flatMap((rec) => {
      const r = rec.realized;
      const tag = (p: RealizedPlayer) => `${p.webName}${p.isCaptain ? " (C)" : p.isVice ? " (VC)" : ""} ${p.points}`;
      const head = `### GW ${rec.gw}`;
      if (!r) return [head, `- realized: pending (gameweek not finished)`, ``];
      const capture = isPreDeadline(rec)
        ? `pre-deadline capture ${rec.capturedAt} (squad as locked for GW ${rec.squadAsOfGw ?? rec.pipelineGw})`
        : "no capture — picks-only backfill";
      const transfers = r.transfers.length
        ? r.transfers.map((t) => `${t.outName}→${t.inName}`).join(", ") + (r.transfersCost ? ` (hit −${r.transfersCost})` : "")
        : "none";
      return [
        head,
        `- ${r.gwPoints ?? "unavailable"} pts (bench ${r.pointsOnBench ?? "—"}) · GW rank ${r.gwRank?.toLocaleString() ?? "—"} · overall ${r.overallRank?.toLocaleString() ?? "—"} · chip ${r.chip ?? "none"} · bank £${r.bank.toFixed(1)}m · value £${r.squadValue.toFixed(1)}m`,
        `- XI: ${r.xi.map(tag).join(", ")}`,
        `- Bench: ${r.bench.map(tag).join(", ")}`,
        `- Transfers for this GW: ${transfers}`,
        `- App: ${rec.appCaptain ? `captain ${rec.appCaptain.webName} (ep_next ${rec.appCaptain.epNext ?? "—"})` : "captain unavailable"} · ${typeof rec.transfer === "string" ? `transfer ${rec.transfer}` : rec.transfer ? `transfer ${describeAction(rec.transfer.primary)}` : "transfer unavailable — capture predates the transfer leg"}`,
        `- Capture: ${capture}`,
        ``,
      ];
    }),
    ...(syncNotes.length ? [`## Sync notes`, ``, ...syncNotes.map((s) => `- ${s}`), ``] : []),
  ];
  const report = out.join("\n");
  writeFileSync(REPORT, report);
  console.log(report);

  // ── 3. Transfer scoring — realized (in − out) vs hold and vs your actual moves ──
  const tRows: TransferRow[] = [];
  const tSkipped: string[] = [];
  for (const rec of records) {
    if (!wanted(rec.gw)) continue;
    if (!isPreDeadline(rec)) {
      tSkipped.push(`GW ${rec.gw}: picks-only backfill (no pre-deadline capture) — excluded`);
      continue;
    }
    if (rec.postDeadline) {
      tSkipped.push(`GW ${rec.gw}: captured post-deadline (contaminated) — excluded`);
      continue;
    }
    if (rec.transfer === undefined) {
      tSkipped.push(`GW ${rec.gw}: capture predates the transfer leg (captain only) — excluded`);
      continue;
    }
    if (typeof rec.transfer === "string") {
      tSkipped.push(`GW ${rec.gw}: transfer recommendation ${rec.transfer} — excluded`);
      continue;
    }
    if (!finished.has(rec.gw) || !rec.realized) {
      tSkipped.push(`GW ${rec.gw}: not finished yet — pending`);
      continue;
    }
    const appMoves = rec.transfer.primary.moves.map((m) => ({ inId: m.inId, outId: m.outId }));
    const appHold = appMoves.length === 0;
    const appHit = rec.transfer.primary.netPointsCost;
    const mgrMoves = rec.realized.transfers.map((t) => ({ inId: t.inId, outId: t.outId }));
    const mgrHit = rec.realized.transfersCost;
    const net = (g: number | null, hit: number) => (g === null ? null : g - hit);
    tRows.push({
      gw: rec.gw,
      appHold,
      appMoves,
      appG1: appHold ? 0 : net(await gainOver(appMoves, rec.gw, 1), appHit),
      appG3: appHold ? 0 : net(await gainOver(appMoves, rec.gw, 3), appHit),
      mgrTransferred: mgrMoves.length > 0,
      mgrMoves,
      mgrG1: mgrMoves.length ? net(await gainOver(mgrMoves, rec.gw, 1), mgrHit) : 0,
      mgrG3: mgrMoves.length ? net(await gainOver(mgrMoves, rec.gw, 3), mgrHit) : 0,
      mgrHit,
    });
  }

  const tn = tRows.length;
  const tProvisional = tn < SEASON_GWS - 1;
  const t3 = tRows.filter((r) => r.appG3 !== null && r.mgrG3 !== null);
  const meanOf = (subset: TransferRow[], f: (r: TransferRow) => number) =>
    subset.length ? (subset.reduce((s, r) => s + f(r), 0) / subset.length).toFixed(2) : "—";
  const t1 = tRows.filter((r) => r.appG1 !== null && r.mgrG1 !== null);
  const tOut: string[] = [
    `# Transfer live-eval — full pipeline, 2026-27${tProvisional ? ` (PROVISIONAL, n=${tn})` : ""}`,
    ``,
    `Prospective scoring of the app's full transfer optimizer (live \`ep_next\` + LLM context,`,
    `free transfers derived from your public history), captured pre-deadline each gameweek on`,
    `the squad as locked for the previous GW, and scored on realized (in − out) \`total_points\``,
    `over the next 1 and next 3 gameweeks — net of the hit each side paid — vs holding and vs`,
    `your actual transfers.`,
    tProvisional
      ? `**Provisional:** ${tn} decision gameweek${tn === 1 ? "" : "s"} scored — read directionally, not conclusively.`
      : ``,
    ``,
    ...summarizeTransfers(tRows, (id) => name(id)),
    `## Full pipeline vs deterministic floor`,
    ``,
    `| | ${TRANSFER_FLOOR.label} | Live full pipeline (n=${tn}${tProvisional ? ", provisional" : ""}) |`,
    `|---|---|---|`,
    `| App transfer rate | ${TRANSFER_FLOOR.appTransferRate} | ${tn ? `${tRows.filter((r) => !r.appHold).length}/${tn}` : "unavailable — no scored GWs"} |`,
    `| App mean gain next-1 / next-3 | ${TRANSFER_FLOOR.appMean} | ${tn ? `${meanOf(t1, (r) => r.appG1!)} / ${meanOf(t3, (r) => r.appG3!)}` : "unavailable — no scored GWs"} |`,
    `| Your mean gain next-1 / next-3 (net) | ${TRANSFER_FLOOR.mgrMean} | ${tn ? `${meanOf(t1, (r) => r.mgrG1!)} / ${meanOf(t3, (r) => r.mgrG3!)}` : "unavailable — no scored GWs"} |`,
    `| Head-to-head (next-3) | ${TRANSFER_FLOOR.headToHead} | ${t3.length ? `${t3.filter((r) => r.appG3! > r.mgrG3!).length}W / ${t3.filter((r) => r.appG3 === r.mgrG3).length}T / ${t3.filter((r) => r.appG3! < r.mgrG3!).length}L · net ${fmtSigned(t3.reduce((s, r) => s + (r.appG3! - r.mgrG3!), 0))} pts` : "unavailable — no GW with next-3 realized"} |`,
    `| No-op accuracy | ${TRANSFER_FLOOR.noOp} | ${t3.length ? `${t3.filter((r) => r.mgrTransferred && r.mgrG3! < 0 && r.appHold).length}/${t3.filter((r) => r.mgrTransferred && r.mgrG3! < 0).length}` : "unavailable — no GW with next-3 realized"} |`,
    ``,
    ...(tSkipped.length ? [`## Not scored`, ``, ...tSkipped.map((s) => `- ${s}`), ``] : []),
    `## Captured recommendations`,
    ``,
    `Projected Δep is the gate's own quantity (\`ep_next\` in − out at capture); the composite`,
    `delta the optimizer also carries is NOT expected points and is not shown here.`,
    ``,
    `| GW | FT assumed | bank | app primary | projected Δep | realized next-1 | hit | your move(s) | your hit |`,
    `|---|---|---|---|---|---|---|---|---|`,
    ...records
      .filter((rec) => isPreDeadline(rec) && rec.transfer !== undefined)
      .map((rec) => {
        const t = rec.transfer!;
        const yours = rec.realized
          ? rec.realized.transfers.map((x) => `${x.outName}→${x.inName}`).join(", ") || "hold"
          : "pending";
        const yourHit = rec.realized ? rec.realized.transfersCost : "—";
        if (typeof t === "string") return `| ${rec.gw} | — | — | ${t} | — | — | — | ${yours} | ${yourHit} |`;
        const proj = projectedEp(t.primary.moves);
        const row = tRows.find((r) => r.gw === rec.gw);
        const realized = !t.primary.moves.length ? "—" : row ? (row.appG1 === null ? "pending" : fmtSigned(row.appG1)) : "pending";
        return `| ${rec.gw} | ${t.freeTransfersAssumed} | £${t.bank.toFixed(1)}m | ${describeAction(t.primary)} | ${!t.primary.moves.length ? "—" : typeof proj === "number" ? fmtSigned(proj, 1) : proj} | ${realized} | ${t.primary.netPointsCost} | ${yours} | ${yourHit} |`;
      }),
    ``,
    ...calibrationLine(records, tRows),
  ];
  const tReport = tOut.join("\n");
  writeFileSync(TRANSFER_REPORT, tReport);
  console.log(tReport);

  // ── 4. Live datasets: labelled rows from the pool dumps (live-dataset-universe) ──
  //   live-dataset.csv      ← gwNN.universe.csv  (lite tier, one row per bootstrap player — the fit's input)
  //   live-pool-dataset.csv ← gwNN.csv           (full tier, squad + candidate pool — decision-layer analysis)
  // Only clean dumps are ingested: post-deadline sidecars are ignored and any row flagged
  // `post_deadline=1` is dropped (pool-dump-deadline-guard). `label_gws` counts FINISHED
  // gameweeks in the next-3 window (3 = complete, the fit's eligibility bar); unlike the
  // archive, a blank GW still counts as finished with 0 points — the live feed lists every
  // element regardless. No (element, gw) may appear twice in an output — that is a bug.
  const buildLabelled = async (label: string, fileRe: RegExp, sidecarRe: RegExp, out: string): Promise<string[]> => {
    const entries = readdirSync(POOL_DIR);
    const files = entries.filter((f) => fileRe.test(f)).sort();
    const sidecars = entries.filter((f) => sidecarRe.test(f)).sort();
    const all: Record<string, string>[] = [];
    let columns: string[] = [];
    let complete = 0;
    let contaminated = 0;
    const seen = new Set<string>();
    for (const f of files) {
      const poolRows = readCsv(join(POOL_DIR, f));
      if (!poolRows.length) continue;
      if (!columns.length) columns = Object.keys(poolRows[0]);
      for (const r of poolRows) {
        if (r.post_deadline === "1") {
          contaminated++;
          continue;
        }
        const key = `${r.element}:${r.gw}`;
        if (seen.has(key)) throw new Error(`${label}: duplicate (element, gw) ${key} in ${f} — one row per player per gameweek is the contract`);
        seen.add(key);
        const gw = Number(r.gw);
        const el = Number(r.element);
        const p1 = await pointsFor(gw);
        let n3 = 0;
        let labelGws = 0;
        for (let k = gw; k <= gw + 2 && k <= SEASON_GWS; k++) {
          const pts = await pointsFor(k);
          if (!pts) break; // the window is scored in order; stop at the first unfinished GW
          n3 += pts.get(el) ?? 0;
          labelGws++;
        }
        r.next1_points = p1 ? String(p1.get(el) ?? 0) : "";
        r.next3_points = labelGws ? String(n3) : "";
        r.label_gws = String(labelGws);
        if (labelGws === 3) complete++;
        all.push(r);
      }
    }
    writeCsv(out, columns, all);
    console.log(
      `${label}: ${all.length} rows across ${files.length} file(s); ${complete} with a complete next-3 label.` +
        (contaminated ? ` Dropped ${contaminated} post-deadline row(s).` : "") +
        (sidecars.length ? ` Ignored ${sidecars.length} post-deadline sidecar file(s): ${sidecars.join(", ")}.` : "") +
        (all.length ? "" : " (no dumps yet — run capture.ts before a deadline)")
    );
    return files;
  };
  if (existsSync(POOL_DIR)) {
    console.log("");
    const universeFiles = await buildLabelled(
      "live-dataset.csv (universe, lite)", /^gw\d+\.universe\.csv$/, /^gw\d+\.universe\.post-deadline\.csv$/, DATASET
    );
    const poolFiles = await buildLabelled(
      "live-pool-dataset.csv (pool, full)", /^gw\d+\.csv$/, /^gw\d+\.post-deadline\.csv$/, POOL_DATASET
    );
    for (const f of poolFiles) {
      const gw = f.slice(2, 4);
      if (!universeFiles.includes(`gw${gw}.universe.csv`))
        console.log(`GW${Number(gw)}: universe unavailable — captured before live-dataset-universe`);
    }
  } else {
    console.log(`\nlive-dataset.csv / live-pool-dataset.csv: unavailable — no pool/ dumps yet (captures before 2026-09-04 predate the scored-pool dump).`);
  }
}

// Sum of the gate's per-move ep deltas, or an honesty marker (transfer-gain-units).
function projectedEp(moves: { epDelta?: number | null }[]): number | string {
  if (moves.some((m) => m.epDelta === undefined)) return "unavailable — captured before transfer-gain-units";
  if (moves.some((m) => m.epDelta === null)) return "unavailable — ep_next missing for a side";
  return moves.reduce((s, m) => s + (m.epDelta as number), 0);
}

// Projected-vs-realized means over rows that have both — a calibration readout, not a
// verdict (that is new-season-readiness Task 4's call once n is meaningful).
function calibrationLine(records: LiveCaptureRecord[], tRows: TransferRow[]): string[] {
  const pairs: { proj: number; real: number }[] = [];
  for (const rec of records) {
    if (!isPreDeadline(rec) || typeof rec.transfer !== "object" || !rec.transfer.primary.moves.length) continue;
    const proj = projectedEp(rec.transfer.primary.moves);
    const row = tRows.find((r) => r.gw === rec.gw);
    if (typeof proj !== "number" || !row || row.appG1 === null) continue;
    pairs.push({ proj, real: row.appG1 });
  }
  if (!pairs.length) return [];
  const mean = (f: (p: { proj: number; real: number }) => number) =>
    (pairs.reduce((s, p) => s + f(p), 0) / pairs.length).toFixed(2);
  return [
    `**Calibration (n=${pairs.length}):** mean projected Δep ${mean((p) => p.proj)} vs mean realized next-1 (in − out, net of hit) ${mean((p) => p.real)}.`,
    ``,
  ];
}

function describeAction(a: { type: string; moves: { outName: string; inName: string }[] }): string {
  if (!a.moves.length) return `hold (${a.type})`;
  return `${a.type}: ${a.moves.map((m) => `${m.outName}→${m.inName}`).join(", ")}`;
}

function fmtSigned(v: number, dp = 0): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
}

main().catch((e) => {
  console.error(`Scoring failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
