/**
 * composite-refit-gate — fit on live data, evaluate the PRE-REGISTERED ship criteria, and on
 * a pass open a refit branch (never main) with the candidate weights, reports, a
 * counterfactual and a drafted PR body. Invoked by scripts/live-eval-tick.ts after each new
 * labelled gameweek; safe to run by hand.
 *
 * Order: fit_live.py → criteria → gate.json → drift_live.py (reads the gate) → [on pass]
 * counterfactual → branch → narrative → delivery → out/gate-passed.flag (the tick emails it).
 *
 * The criteria constants below are pre-registered by the OpenSpec change and are NOT
 * env-configurable; change them only through a new change.
 *
 * Env: REFIT_DATASET=<parquet> (default research/squad-eval/live-dataset.parquet)
 *      REFIT_DRY_RUN=1   no branch / push / PR / flag (reports + gate.json still written)
 *      REFIT_NARRATIVE=off   skip the Claude CLI and use the deterministic PR body
 *      REFIT_BRANCH_PREFIX=<prefix>   default "refit/" (tests use a throwaway prefix)
 *      LIVE_EVAL_PYTHON=<path>   default python3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import scoringWeights from "../lib/scoring-weights.json";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CB = join(ROOT, "research", "composite-backtest");
const OUT = join(CB, "out");
const DATASET = process.env.REFIT_DATASET || join(ROOT, "research", "squad-eval", "live-dataset.parquet");
const DRY = process.env.REFIT_DRY_RUN === "1";
const NARRATIVE = process.env.REFIT_NARRATIVE !== "off";
const PREFIX = process.env.REFIT_BRANCH_PREFIX || "refit/";
const PYTHON = process.env.LIVE_EVAL_PYTHON || "python3";

// ── Pre-registered ship criteria (composite-refit-gate spec, requirement 4) ──────────
const CRITERIA = {
  MIN_TRAIN: 200, // rows per position
  MIN_HOLDOUT: 100,
  MARGIN: 0.02, // candidate held-out Spearman ≥ shipped + MARGIN (row-weighted overall)
  CONSECUTIVE: 2, // passes on consecutive runs with different holdout windows
  MATERIAL_WEIGHT: 1.0, // shipped |w| ≥ this may not flip sign
  EP_FLOOR: 0.9, // candidate ≥ EP_FLOOR × raw ep_next Spearman
} as const;

const log = (m: string) => console.log(`${new Date().toISOString()} refit-gate: ${m}`);

function run(cmd: string, args: string[], cwd = ROOT, timeout = 600_000) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout, env: process.env });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0 || r.error) throw new Error(`${cmd} ${args[0]} failed (exit ${r.status ?? "signal"}): ${out.split("\n").slice(-15).join("\n")}`);
  return out;
}
const git = (args: string[], cwd = ROOT) => spawnSync("git", args, { cwd, encoding: "utf8" });

interface Metric { mean_spearman: number; top5_precision: number; groups: number; rows: number }
interface FitReport {
  labelled_gws: number[]; holdout_gws: number[]; train_gws: number[]; complete: boolean; eligible_rows: number;
  positions: Record<string, { status: string; n_train: number; n_heldout: number; heldout_rho?: number }>;
  heldout_comparison: { overall?: { candidate: Metric | null; shipped_composite: Metric | null; ep_next: Metric | null } };
  candidate: { SCORING_WEIGHTS: Record<string, Record<string, number>>; COMPOSITE_SQUASH: { center: number; scale: number } } | null;
}
interface GateState { streak: number; lastPassHoldout: number[] | null }
interface Criterion { ok: boolean; detail: string }

function evaluate(fit: FitReport, prev: GateState): { criteria: Record<string, Criterion>; pass: boolean; streak: number; corePass: boolean } {
  const pos = Object.entries(fit.positions);
  const floorsOk = fit.complete && pos.every(([, p]) => p.status === "fitted" && p.n_train >= CRITERIA.MIN_TRAIN && p.n_heldout >= CRITERIA.MIN_HOLDOUT);
  const c1: Criterion = { ok: floorsOk, detail: pos.map(([k, p]) => `${k}: ${p.status} ${p.n_train}/${p.n_heldout}`).join("; ") };

  const ov = fit.heldout_comparison?.overall;
  const cand = ov?.candidate?.mean_spearman ?? null;
  const ship = ov?.shipped_composite?.mean_spearman ?? null;
  const ep = ov?.ep_next?.mean_spearman ?? null;
  const c2: Criterion = {
    ok: cand !== null && ship !== null && cand >= ship + CRITERIA.MARGIN,
    detail: cand === null || ship === null ? "unavailable — no held-out comparison" : `candidate ${cand} vs shipped ${ship} (need +${CRITERIA.MARGIN})`,
  };

  const flips: string[] = [];
  if (fit.candidate) {
    for (const [p, w] of Object.entries(scoringWeights.SCORING_WEIGHTS)) {
      for (const [k, shippedW] of Object.entries(w)) {
        if (Math.abs(shippedW) < CRITERIA.MATERIAL_WEIGHT) continue;
        const cw = fit.candidate.SCORING_WEIGHTS[p]?.[k];
        if (cw === undefined) flips.push(`${p}.${k} missing in candidate (shipped ${shippedW})`);
        else if (Math.sign(cw) !== Math.sign(shippedW)) flips.push(`${p}.${k} ${shippedW} → ${cw}`);
      }
    }
  }
  const c4: Criterion = { ok: !!fit.candidate && flips.length === 0, detail: fit.candidate ? (flips.join("; ") || "none") : "no candidate" };

  const c5: Criterion = {
    ok: cand !== null && ep !== null && cand >= CRITERIA.EP_FLOOR * ep,
    detail: cand === null || ep === null ? "unavailable" : `candidate ${cand} vs ${CRITERIA.EP_FLOOR} × ep_next ${ep} = ${(CRITERIA.EP_FLOOR * ep).toFixed(4)}`,
  };

  const corePass = c1.ok && c2.ok && c4.ok && c5.ok;
  const sameWindow = prev.lastPassHoldout !== null && JSON.stringify(prev.lastPassHoldout) === JSON.stringify(fit.holdout_gws);
  const streak = corePass ? (sameWindow ? prev.streak : prev.streak + 1) : 0;
  const c3: Criterion = {
    ok: corePass && streak >= CRITERIA.CONSECUTIVE,
    detail: corePass ? `${streak}/${CRITERIA.CONSECUTIVE} on holdout ${JSON.stringify(fit.holdout_gws)}${sameWindow ? " (same window as last pass — not double-counted)" : ""}` : "core criteria failed — streak reset",
  };
  const pass = corePass && c3.ok;
  return { criteria: { c1_sample_floors: c1, c2_margin: c2, c3_consecutive: c3, c4_no_sign_flips: c4, c5_ep_floor: c5 }, pass, streak, corePass };
}

function deterministicBody(gate: { criteria: Record<string, Criterion>; streak: number }, fit: FitReport, counterfactual: string): string {
  const ov = fit.heldout_comparison.overall!;
  const rows = Object.entries(gate.criteria).map(([k, v]) => `| ${k} | ${v.ok ? "✓" : "✗"} | ${v.detail} |`);
  return [
    "## Summary", "",
    `Candidate composite weights fitted on live 2026-27 data (train GWs ${JSON.stringify(fit.train_gws)}, holdout ${JSON.stringify(fit.holdout_gws)}, ${fit.eligible_rows} eligible rows).`,
    `Held-out Spearman: candidate ${ov.candidate?.mean_spearman} · shipped composite ${ov.shipped_composite?.mean_spearman} · raw ep_next ${ov.ep_next?.mean_spearman}.`,
    `Squash: ${JSON.stringify(scoringWeights.COMPOSITE_SQUASH)} → ${JSON.stringify(fit.candidate?.COMPOSITE_SQUASH)}.`, "",
    "## Gate", "", "| criterion | | detail |", "|---|---|---|", ...rows, "", `Streak: ${gate.streak}.`, "",
    "## What moves", "", counterfactual.split("\n").slice(0, 60).join("\n"), "",
    "## Anomalies", "", "narrative: fallback (deterministic body — the Claude CLI narrative was unavailable or disabled).", "",
    "## Not covered", "", "Captain and transfer decisions are ep_next-gated and are not rescored by this change.", "",
  ].join("\n");
}

function narrative(worktree: string, files: string[]): string | null {
  if (!NARRATIVE) return null;
  const which = spawnSync("which", ["claude"], { encoding: "utf8" });
  if (which.status !== 0) return null;
  const prompt = readFileSync(join(ROOT, "scripts", "refit-pr-prompt.md"), "utf8").replace("{{FILES}}", files.map((f) => `- ${f}`).join("\n"));
  const r = spawnSync("claude", ["-p", prompt, "--allowedTools", "Read", "--output-format", "text"], { cwd: worktree, encoding: "utf8", timeout: 300_000, env: process.env });
  const text = (r.stdout ?? "").trim();
  if (r.status !== 0 || r.error || text.length < 200 || text.length > 20_000 || !text.includes("## ")) return null;
  return text;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const statePath = join(OUT, "gate-state.json");
  const prev: GateState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { streak: 0, lastPassHoldout: null };

  log(`fit_live.py on ${DATASET}`);
  run(PYTHON, [join(CB, "fit_live.py"), DATASET], CB);
  const fit: FitReport = JSON.parse(readFileSync(join(OUT, "live-fit.json"), "utf8"));

  const { criteria, pass, streak, corePass } = evaluate(fit, prev);
  const gate = { at: new Date().toISOString(), holdout_gws: fit.holdout_gws, labelled_gws: fit.labelled_gws, streak, pass, criteria, constants: CRITERIA };
  writeFileSync(join(OUT, "gate.json"), JSON.stringify(gate, null, 2) + "\n");
  const nextState: GateState = pass ? { streak: 0, lastPassHoldout: fit.holdout_gws } : { streak, lastPassHoldout: corePass ? fit.holdout_gws : prev.lastPassHoldout };
  if (!DRY) writeFileSync(statePath, JSON.stringify(nextState, null, 2) + "\n");
  log(`gate: ${pass ? "PASS" : "no pass"} — ` + Object.entries(criteria).map(([k, v]) => `${k}=${v.ok ? "✓" : "✗"}`).join(" "));

  log("drift_live.py");
  run(PYTHON, [join(CB, "drift_live.py"), DATASET], CB);

  if (!pass) return;

  // ── Pass: counterfactual → branch → narrative → delivery → flag ─────────────────
  const gwTag = `gw${String(Math.max(...fit.labelled_gws)).padStart(2, "0")}`;
  const branch = `${PREFIX}${gwTag}-${new Date().toISOString().slice(0, 10)}`;
  const candPath = join(OUT, "live-weights-candidate.json");
  const cfPath = join(OUT, "refit-counterfactual.md");
  run("npx", ["tsx", join(ROOT, "scripts", "rescore-counterfactual.ts"), candPath, cfPath]);
  const counterfactual = readFileSync(cfPath, "utf8");

  if (DRY) {
    writeFileSync(join(OUT, "refit-pr-body.md"), deterministicBody(gate, fit, counterfactual));
    log(`[dry-run] would create branch ${branch}, push, draft PR — deterministic body written to out/refit-pr-body.md`);
    return;
  }

  const wt = join(ROOT, ".worktrees", `refit-${gwTag}`);
  const cleanup = () => {
    git(["worktree", "remove", "--force", wt]);
    git(["branch", "-D", branch]);
  };
  try {
    const f = git(["fetch", "origin", "main"]);
    if (f.status !== 0) throw new Error(`git fetch failed: ${f.stderr}`);
    mkdirSync(join(ROOT, ".worktrees"), { recursive: true });
    const w = git(["worktree", "add", "-b", branch, wt, "origin/main"]);
    if (w.status !== 0) throw new Error(`git worktree add failed: ${w.stderr}`);

    cpSync(candPath, join(wt, "lib", "scoring-weights.json"));
    // research/composite-backtest/out/ is gitignored, so refit reports live under refits/<gwTag>/.
    const reportDir = join(wt, "research", "composite-backtest", "refits", gwTag);
    mkdirSync(reportDir, { recursive: true });
    const files: string[] = [];
    for (const name of ["live-fit.json", "live-fit.md", "live-drift.json", "live-drift.md", "gate.json", "refit-counterfactual.md"]) {
      const src = join(OUT, name);
      if (existsSync(src)) {
        cpSync(src, join(reportDir, name));
        files.push(`research/composite-backtest/refits/${gwTag}/${name}`);
      }
    }
    const body = narrative(wt, [...files, "lib/scoring-weights.json"]) ?? deterministicBody(gate, fit, counterfactual);
    const narrativeMode = body.includes("narrative: fallback") ? "fallback" : "claude";
    writeFileSync(join(reportDir, "refit-pr-body.md"), body);
    writeFileSync(join(OUT, "refit-pr-body.md"), body);

    git(["add", "lib/scoring-weights.json", `research/composite-backtest/refits/${gwTag}`], wt);
    const c = git(["commit", "-q", "-m", `refit(composite): candidate weights from live data through ${gwTag}\n\nPre-registered gate passed (see research/composite-backtest/refits/${gwTag}/gate.json).\nOpened by scripts/refit-gate.ts; a human merges.`], wt);
    if (c.status !== 0) throw new Error(`commit failed: ${c.stderr}`);
    const p = git(["push", "-q", "-u", "origin", branch], wt);
    if (p.status !== 0) throw new Error(`push failed: ${p.stderr.split("\n").slice(-5).join("\n")}`);
    git(["worktree", "remove", "--force", wt]);

    const remote = git(["remote", "get-url", "origin"]).stdout.trim().replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
    const compare = `${remote}/compare/main...${encodeURIComponent(branch)}?expand=1`;
    let delivery = `no gh CLI — open the PR from ${compare}`;
    const gh = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
    if (gh.status === 0) {
      const pr = spawnSync("gh", ["pr", "create", "--draft", "--base", "main", "--head", branch, "--title", `refit(composite): candidate weights through ${gwTag}`, "--body-file", join(OUT, "refit-pr-body.md")], { cwd: ROOT, encoding: "utf8" });
      delivery = pr.status === 0 ? `draft PR opened: ${pr.stdout.trim()}` : `gh pr create failed (${pr.stderr.trim()}) — open from ${compare}`;
    }
    writeFileSync(join(OUT, "gate-passed.flag"), [
      `Refit gate PASSED through ${gwTag} (branch ${branch}).`, `Delivery: ${delivery}`, `Narrative: ${narrativeMode}`, "", body,
    ].join("\n"));
    log(`branch ${branch} pushed; ${delivery}; narrative: ${narrativeMode}`);
  } catch (e) {
    cleanup();
    throw e;
  }
}

try {
  main();
} catch (e) {
  console.error(`${new Date().toISOString()} refit-gate failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
