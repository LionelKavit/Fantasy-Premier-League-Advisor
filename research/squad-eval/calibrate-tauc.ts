/**
 * Calibrate τ_c (composite-units fallback bar) on the EP-ABSENT floor composite — the
 * distribution the fallback actually gates (ep_next null → epNextSignal 0.5 for all).
 * For each GW decision, collect every valid transfer's (gw1Gain, realized next-3 gain),
 * bin by gw1Gain, and find where realized gain becomes reliably positive.
 *
 * Run:  npx tsx research/squad-eval/calibrate-tauc.ts
 */
import type { Pick, ElementSummary } from "../../lib/types";
import type { ScoredPlayer, LlmContextSignals } from "../../lib/pipeline/types";
import { scorePlayerLite } from "../../lib/pipeline/lite-scoring";
import { rankSquad, identifyWeakSpots, findCandidates } from "../../lib/pipeline/squad-ranker";
import { buildValidTransfers } from "../../lib/optimizer/setup";
import { load, teams, fixtures, realized, buildPlayer, allElementIds } from "./reconstruct";

const EMPTY_ES = new Map<number, ElementSummary>();
const EMPTY_LLM = new Map<number, LlmContextSignals>();
const pairs: { gain: number; realized: number }[] = [];

function gainOver(inId: number, outId: number, gw: number, span: number): number {
  let g = 0;
  for (let k = gw; k < gw + span && k <= 38; k++) g += realized(inId, k).points - realized(outId, k).points;
  return g;
}

for (let gw = 4; gw <= 38; gw++) {
  const prev = load(`picks-${gw - 1}`) as { picks: Pick[]; entry_history: { bank: number } };
  const bank = prev.entry_history.bank / 10;
  const scored: ScoredPlayer[] = prev.picks.map((p) =>
    scorePlayerLite(buildPlayer(p.element, gw), { fixtures, teams, currentGw: gw, maxEpNext: 1 }));
  const scoredCache = new Map(scored.map((sp) => [sp.player.id, sp]));
  const teamCounts = new Map<number, number>();
  for (const sp of scored) teamCounts.set(sp.player.teamId, (teamCounts.get(sp.player.teamId) ?? 0) + 1);
  const weakSpots = identifyWeakSpots(rankSquad(scored));
  const universe = allElementIds.map((id) => buildPlayer(id, gw));
  for (const ws of weakSpots)
    ws.targets = findCandidates(ws.player, universe, bank, teamCounts, scoredCache, fixtures, teams, gw, EMPTY_ES, EMPTY_LLM, 1);
  const valid = buildValidTransfers(
    { rankedSquad: scored, weakSpots, picks: prev.picks, chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 }, bank, currentGw: gw, generatedAt: "" },
    bank, teamCounts);
  for (const vt of valid)
    pairs.push({ gain: vt.gw1Gain, realized: gainOver(vt.candidate.player.id, vt.weakPlayer.player.id, gw, 3) });
}

console.log(`floor valid transfers: ${pairs.length}\n  ${"gw1Gain bin".padStart(16)}${"n".padStart(8)}${"mean realized3".padStart(16)}${"P(gain>0)".padStart(12)}`);
const edges = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0];
for (let i = 0; i < edges.length - 1; i++) {
  const m = pairs.filter((p) => p.gain >= edges[i] && p.gain < edges[i + 1]);
  if (m.length < 20) continue;
  const mean = m.reduce((s, p) => s + p.realized, 0) / m.length;
  const pos = m.filter((p) => p.realized > 0).length / m.length;
  console.log(`  ${`[${edges[i].toFixed(1)},${edges[i + 1].toFixed(1)})`.padStart(16)}${String(m.length).padStart(8)}${mean.toFixed(2).padStart(16)}${pos.toFixed(2).padStart(12)}`);
}
