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
import { rankSquad, identifyWeakSpots, findCandidates } from "../../lib/pipeline/squad-ranker";
import { buildValidTransfers } from "../../lib/optimizer/setup";
import { evaluateSingleTransfer } from "../../lib/optimizer/single-transfer";
import { CACHE, load, teams, fixtures, staticById, realized, buildPlayer, allElementIds } from "./reconstruct";
import { summarizeTransfers, type TransferRow } from "./metrics";

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

function decide(gw: number): TransferRow | null {
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
  const weakSpots = identifyWeakSpots(ranked);

  // Candidate universe, point-in-time.
  const universe = allElementIds.map((id) => buildPlayer(id, gw));
  for (const ws of weakSpots) {
    ws.targets = findCandidates(ws.player, universe, bank, teamCounts, scoredCache,
      fixtures, teams, gw, EMPTY_ES, EMPTY_LLM, 1);
  }

  const analysis: SquadAnalysisResult = {
    rankedSquad: ranked, weakSpots, picks: squad,
    chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 },
    bank, currentGw: gw, deadline: null, generatedAt: "",
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

  return {
    gw, appHold, appMoves: appHold ? [] : [{ outId: recOut, inId: recIn }], appG1, appG3,
    mgrTransferred: mgrTs.length > 0,
    mgrMoves: mgrTs.map((t) => ({ outId: t.element_out, inId: t.element_in })),
    mgrG1, mgrG3, mgrHit,
  };
}

// ── Aggregate + report ── shared `summarizeTransfers` lives in metrics.ts ────
function main() {
  const rows = TARGET_GWS.map(decide).filter((r): r is TransferRow => r !== null);
  const name = (id: number) => (id < 0 ? "—" : staticById.get(id)?.webName ?? id);
  const out: string[] = [
    `# Transfer replay — manager 10815578, 2025-26 (decisions for GW4-38)`,
    ``,
    `The app's transfer optimizer replayed on the real squad each GW, scored by realized points.`,
    `**Caveats:** deterministic floor (\`ep_next\` absent, neutral LLM + trend); manager hit costs`,
    `exact (\`event_transfers_cost\`); app single transfer assumes 1 free transfer; no xP/vaastav.`,
    ``,
    ...summarizeTransfers(rows, name),
  ];
  const report = out.join("\n");
  writeFileSync(join(CACHE, "..", "transfer-report.md"), report);
  console.log(report);
}

main();
