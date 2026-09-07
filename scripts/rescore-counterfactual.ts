/**
 * composite-refit-gate — counterfactual rescoring (a RESCORING, not a re-decision).
 *
 * Recomputes the composite for the latest scored-pool dumps under candidate weights + squash
 * and compares to the shipped values: top-10 per position before/after with rank deltas, and
 * squash saturation (composite ≥ 0.98) before/after on the universe rows. Both sides are
 * computed the same way from the stored signal-map columns (Σ w·sm + trend_adj + llm_adj →
 * squash); the suspension penalty (≤ 0.05, weight-independent) is omitted from BOTH, so the
 * comparison isolates the weights/squash change. Captain and transfer decisions are
 * ep_next-gated and are NOT rescored — see the report's last section.
 *
 * Run:  npx tsx scripts/rescore-counterfactual.ts <candidate.json> <out.md>
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { SCORING_WEIGHTS, COMPOSITE_SQUASH } from "../lib/config";
import type { Position } from "../lib/types";
import { readCsv } from "../research/composite-backtest/csv";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const POOL_DIR = join(ROOT, "research", "squad-eval", "pool");
const SATURATION = 0.98;
const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

interface Weights { SCORING_WEIGHTS: Record<Position, Record<string, number>>; COMPOSITE_SQUASH: { center: number; scale: number } }

function composite(row: Record<string, string>, w: Weights): number {
  const pos = row.position as Position;
  let raw = 0;
  for (const [k, coef] of Object.entries(w.SCORING_WEIGHTS[pos] ?? {})) {
    const col = k === "epNext" ? "sm_epNextSignal" : `sm_${k}`;
    raw += coef * (Number(row[col]) || 0);
  }
  raw += (Number(row.trend_adj) || 0) + (Number(row.llm_adj) || 0);
  return 1 / (1 + Math.exp(-(raw - w.COMPOSITE_SQUASH.center) / w.COMPOSITE_SQUASH.scale));
}

function latest(kind: "universe" | "pool"): { file: string; rows: Record<string, string>[] } | null {
  if (!existsSync(POOL_DIR)) return null;
  const re = kind === "universe" ? /^gw(\d+)\.universe\.csv$/ : /^gw(\d+)\.csv$/;
  const files = readdirSync(POOL_DIR).filter((f) => re.test(f)).sort();
  const file = files[files.length - 1];
  return file ? { file, rows: readCsv(join(POOL_DIR, file)) } : null;
}

function main() {
  const [candPath, outPath] = process.argv.slice(2);
  if (!candPath || !outPath) {
    console.error("usage: rescore-counterfactual.ts <candidate.json> <out.md>");
    process.exit(2);
  }
  const cand: Weights = JSON.parse(readFileSync(candPath, "utf8"));
  const shipped: Weights = { SCORING_WEIGHTS, COMPOSITE_SQUASH };
  const L: string[] = ["# Refit counterfactual — rescoring under the candidate weights", ""];
  L.push(
    "Both columns are recomputed from the stored signal-map columns (Σ w·sm + trend_adj + llm_adj → squash);",
    "the suspension penalty (≤ 0.05, weight-independent) is omitted from both sides. A rank delta is",
    "candidate rank minus shipped rank (negative = climbed).",
    ""
  );
  for (const kind of ["universe", "pool"] as const) {
    const d = latest(kind);
    if (!d) {
      L.push(`## ${kind}: unavailable — no ${kind} dump in research/squad-eval/pool`, "");
      continue;
    }
    const scored = d.rows.map((r) => ({ r, before: composite(r, shipped), after: composite(r, cand) }));
    const sat = (k: "before" | "after") => scored.filter((s) => s[k] >= SATURATION).length;
    L.push(`## ${kind} (${d.file}, ${scored.length} rows)`, "",
      `Saturation (composite ≥ ${SATURATION}): shipped **${sat("before")}** → candidate **${sat("after")}**.`, "");
    for (const pos of POSITIONS) {
      const sub = scored.filter((s) => s.r.position === pos);
      if (!sub.length) continue;
      const rankBefore = new Map([...sub].sort((a, b) => b.before - a.before).map((s, i) => [s.r.element, i + 1]));
      const top = [...sub].sort((a, b) => b.after - a.after).slice(0, 10);
      const beforeTop = new Set([...sub].sort((a, b) => b.before - a.before).slice(0, 10).map((s) => s.r.element));
      L.push(`### ${pos} — top-10 under the candidate`, "", "| # | player | xP | shipped | candidate | Δrank | note |", "|---|---|---|---|---|---|---|");
      top.forEach((s, i) => {
        const rb = rankBefore.get(s.r.element) ?? 0;
        const note = beforeTop.has(s.r.element) ? "" : "**enters top-10**";
        L.push(`| ${i + 1} | ${s.r.name} | ${s.r.xP || "—"} | ${s.before.toFixed(4)} | ${s.after.toFixed(4)} | ${i + 1 - rb >= 0 ? "+" : ""}${i + 1 - rb} | ${note} |`);
      });
      const dropped = [...beforeTop].filter((e) => !top.some((s) => s.r.element === e)).map((e) => sub.find((s) => s.r.element === e)!.r.name);
      L.push("", dropped.length ? `Leaves top-10: ${dropped.join(", ")}` : "No changes to top-10 membership.", "");
    }
  }
  L.push("## Not rescored", "",
    "unavailable — decision layer is ep-denominated: captain and transfer recommendations are gated on",
    "`ep_next` deltas (allocate.ts / single-transfer.ts), which candidate weights do not change; only",
    "display ordering and the fallback-score filter would move. The live captain/transfer logs are therefore",
    "not rescored here.", "");
  writeFileSync(outPath, L.join("\n"));
  console.log(`counterfactual written → ${outPath}`);
}

main();
