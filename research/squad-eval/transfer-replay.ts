/**
 * squad-eval-transfer-replay — Tasks 1-3: replay the app's transfer optimizer on the
 * manager's real 2025-26 squad each gameweek and score it against holding and against
 * the manager's actual transfers.
 *
 * Decision point: at the deadline for gameweek G we hold the squad as picked for G-1 and
 * have data through G-1 (rounds < G). The optimizer recommends a transfer for G; we score
 * realized (in - out) over G (next-1) and G..G+2 (next-3). Runs off the local cache.
 *
 * Caveats: ep_next absent, neutral LLM + neutral trend (deterministic floor, same as the
 * captain replay). Manager hit costs are EXACT (from event_transfers_cost); the app's
 * single transfer assumes one free transfer available (the standard case) — no fragile
 * free-transfer inference. FPL API end-to-end; no vaastav, no xP.
 *
 * Run:  npx tsx research/squad-eval/transfer-replay.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Pick, ManagerProfile, ElementSummary } from "../../lib/types";
import type { ScoredPlayer, SquadAnalysisResult, LlmContextSignals } from "../../lib/pipeline/types";
import { scorePlayerLite } from "../../lib/pipeline/lite-scoring";
import { rankSquad, identifyWeakest3, findCandidates } from "../../lib/pipeline/squad-ranker";
import { buildValidTransfers } from "../../lib/optimizer/setup";
import { evaluateSingleTransfer } from "../../lib/optimizer/single-transfer";
import { CACHE, load, teams, fixtures, staticById, realized, buildPlayer, allElementIds } from "./reconstruct";

const TARGET_GWS = Array.from({ length: 35 }, (_, i) => i + 4); // decide for GW4..38 (squad from G-1)
const PROFILE_STUB = {} as unknown as ManagerProfile; // evaluateSingleTransfer ignores it
const EMPTY_ES = new Map<number, ElementSummary>();
const EMPTY_LLM = new Map<number, LlmContextSignals>();

interface Transfer { element_in: number; element_out: number; event: number; }
const allTransfers = load("manager-transfers") as Transfer[];

/** Realized (in - out) points over [gw, gw+span-1]. */
function gainOver(inId: number, outId: number, gw: number, span: number): number {
  let g = 0;
  for (let k = gw; k < gw + span && k <= 38; k++) g += realized(inId, k).points - realized(outId, k).points;
  return g;
}

interface Row {
  gw: number; appHold: boolean; recIn: number; recOut: number; appG1: number; appG3: number;
  mgrTransferred: boolean; mgrG1: number; mgrG3: number; mgrHit: number;
}

function decide(gw: number): Row | null {
  const prev = load(`picks-${gw - 1}`) as { picks: Pick[]; entry_history: { bank: number } };
  const squad = prev.picks;
  if (squad.length < 15) return null;
  const bank = prev.entry_history.bank / 10; // raw cache is in tenths

  // Reconstruct + score the squad point-in-time (rounds < gw).
  const scoredSquad: ScoredPlayer[] = squad.map((p) =>
    scorePlayerLite(buildPlayer(p.element, gw), { fixtures, teams, currentGw: gw, maxEpNext: 1 }));
  const scoredCache = new Map(scoredSquad.map((sp) => [sp.player.id, sp]));
  const teamCounts = new Map<number, number>();
  for (const sp of scoredSquad) teamCounts.set(sp.player.teamId, (teamCounts.get(sp.player.teamId) ?? 0) + 1);

  const ranked = rankSquad(scoredSquad);
  const weakest3 = identifyWeakest3(ranked);

  // Candidate universe, point-in-time.
  const universe = allElementIds.map((id) => buildPlayer(id, gw));
  for (const ws of weakest3) {
    ws.targets = findCandidates(ws.player, universe, bank, teamCounts, scoredCache,
      fixtures, teams, gw, EMPTY_ES, EMPTY_LLM, 1);
  }

  const analysis: SquadAnalysisResult = {
    rankedSquad: ranked, weakest3, picks: squad,
    chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 },
    bank, currentGw: gw, generatedAt: "",
  };
  const valid = buildValidTransfers(analysis, bank, teamCounts);
  const { bestSingle } = evaluateSingleTransfer(valid, PROFILE_STUB, 1, analysis, bank, teamCounts);

  const appHold = !bestSingle;
  const recIn = bestSingle?.candidate.player.id ?? -1;
  const recOut = bestSingle?.weakPlayer.player.id ?? -1;
  const appG1 = appHold ? 0 : gainOver(recIn, recOut, gw, 1);
  const appG3 = appHold ? 0 : gainOver(recIn, recOut, gw, 3);

  // Manager's actual transfer(s) for this GW, net of their exact hit cost.
  const mgrTs = allTransfers.filter((t) => t.event === gw);
  const mgrHit = (load(`picks-${gw}`) as { entry_history: { event_transfers_cost: number } })
    .entry_history.event_transfers_cost;
  const mgrG1 = mgrTs.reduce((s, t) => s + gainOver(t.element_in, t.element_out, gw, 1), 0) - mgrHit;
  const mgrG3 = mgrTs.reduce((s, t) => s + gainOver(t.element_in, t.element_out, gw, 3), 0) - mgrHit;

  return { gw, appHold, recIn, recOut, appG1, appG3,
    mgrTransferred: mgrTs.length > 0, mgrG1, mgrG3, mgrHit };
}

function main() {
  const rows = TARGET_GWS.map(decide).filter((r): r is Row => r !== null);
  const n = rows.length;
  const mean = (f: (r: Row) => number) => (rows.reduce((s, r) => s + f(r), 0) / n).toFixed(2);
  const appTransfers = rows.filter((r) => !r.appHold).length;
  const mgrTransfers = rows.filter((r) => r.mgrTransferred).length;

  // Head-to-head on next-3 realized gain (app action vs manager action).
  const wins = rows.filter((r) => r.appG3 > r.mgrG3).length;
  const ties = rows.filter((r) => r.appG3 === r.mgrG3).length;
  const losses = rows.filter((r) => r.appG3 < r.mgrG3).length;
  const net3 = rows.reduce((s, r) => s + (r.appG3 - r.mgrG3), 0);
  // No-op accuracy: when the manager transferred and lost points (next-3), did the app hold?
  const mgrBadMoves = rows.filter((r) => r.mgrTransferred && r.mgrG3 < 0);
  const appHeldOnBad = mgrBadMoves.filter((r) => r.appHold).length;

  const name = (id: number) => (id < 0 ? "—" : staticById.get(id)?.webName ?? id);
  const out: string[] = [
    `# Transfer replay — manager 10815578, 2025-26 (decisions for GW4-38)`,
    ``,
    `The app's transfer optimizer replayed on the real squad each GW, scored by realized points.`,
    `**Caveats:** deterministic floor (\`ep_next\` absent, neutral LLM + trend); manager hit costs`,
    `exact (\`event_transfers_cost\`); app single transfer assumes 1 free transfer; no xP/vaastav.`,
    ``,
    `### Decision points: ${n} gameweeks`,
    `- App recommended a transfer in **${appTransfers}/${n}** GWs (held ${n - appTransfers}); you transferred in **${mgrTransfers}/${n}**.`,
    ``,
    `**Counterfactual gain vs holding** (realized in − out):`,
    `| | next-1 GW | next-3 GW |`,
    `|---|---|---|`,
    `| App recommendation | ${mean((r) => r.appG1)} | ${mean((r) => r.appG3)} |`,
    `| Your actual transfers (net of hits) | ${mean((r) => r.mgrG1)} | ${mean((r) => r.mgrG3)} |`,
    ``,
    `**Head-to-head (next-3 gain):** app ${wins}W / ${ties}T / ${losses}L vs you · net **${net3 >= 0 ? "+" : ""}${net3}** pts over the season`,
    `**No-op accuracy:** of your ${mgrBadMoves.length} transfers that lost points (next-3), the app would have held **${appHeldOnBad}/${mgrBadMoves.length}**.`,
    ``,
    `## Per-gameweek detail`,
    ``,
    `| GW | app rec (out→in) | app +/- (3GW) | your move | your +/- (3GW, net) |`,
    `|---|---|---|---|---|`,
    ...rows.map((r) =>
      `| ${r.gw} | ${r.appHold ? "hold" : `${name(r.recOut)}→${name(r.recIn)}`} | ${r.appHold ? "—" : r.appG3} | ${r.mgrTransferred ? "transfer" + (r.mgrHit ? ` (-${r.mgrHit})` : "") : "hold"} | ${r.mgrTransferred ? r.mgrG3 : "—"} |`),
    ``,
  ];
  const report = out.join("\n");
  writeFileSync(join(CACHE, "..", "transfer-report.md"), report);
  console.log(report);
}

main();
