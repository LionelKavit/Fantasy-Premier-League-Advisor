/**
 * live-eval-automation — the hourly tick (launchd: scripts/com.pocketscout.live-eval.plist).
 * Runs, in order, each step idempotent and independently retryable; a failing step is
 * logged and counted, later independent steps still run, status ALWAYS runs:
 *   1. capture   — inside `deadline − 5h`: research/squad-eval/capture.ts (guard decides writes)
 *   2. score     — for clean recorded GWs FPL marks finished + data_checked: score-live.ts
 *   3. dataset   — after a successful score: Parquet for live-dataset.csv / live-pool-dataset.csv
 *   4. fit       — hand-off to scripts/refit-gate.ts (composite-refit-gate) when installed
 *   5. status    — rewrite research/squad-eval/live-status.md
 *   6. sync      — commit + push artefacts to the `live-eval-data` branch via a worktree
 *   alerts       — Resend email on a missed capture window, two consecutive step failures,
 *                  or a refit-gate pass. No "all good" mail: the status file is the heartbeat.
 * State: scripts/.live-eval-state.json (gitignored), written after each step's outcome.
 *
 * Run:      npx tsx scripts/live-eval-tick.ts
 * Testing:  LIVE_EVAL_DRY_RUN=1 (log decisions, spawn/send/commit nothing)
 *           LIVE_EVAL_FORCE=1   (bypass the capture window gate)
 *           LIVE_EVAL_DATA_BRANCH=<name> (sync to a throwaway branch)
 *           LIVE_EVAL_PYTHON=<path> (default python3 on PATH; launchd uses a login shell)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { fetchBootstrap } from "../lib/fpl-api";
import type { Gameweek } from "../lib/types";
import { loadEnvLocal } from "./lib/env";
import {
  emptyState, captureWindow, pendingScoreGws, awaitingDataCheck, missedWindows, applyStep,
  type TickState, type StepName,
} from "./live-eval-logic";
// Types/constants only — research/squad-eval/live-types.ts is side-effect free by contract.
import { DEFAULT_TEAM_ID, type LiveCaptureRecord } from "../research/squad-eval/live-types";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SE = join(ROOT, "research", "squad-eval");
const CB_OUT = join(ROOT, "research", "composite-backtest", "out");
const STATE = join(ROOT, "scripts", ".live-eval-state.json");
const LOG = join(SE, "live-log.json");
const STATUS = join(SE, "live-status.md");
const REFIT_GATE = join(ROOT, "scripts", "refit-gate.ts");
const DATA_BRANCH = process.env.LIVE_EVAL_DATA_BRANCH || "live-eval-data";
const WORKTREE = join(ROOT, ".worktrees", DATA_BRANCH);
const DRY = process.env.LIVE_EVAL_DRY_RUN === "1";
const FORCE = process.env.LIVE_EVAL_FORCE === "1";
const PYTHON = process.env.LIVE_EVAL_PYTHON || "python3";
const TIMEOUT = { capture: 300_000, score: 600_000, dataset: 120_000, fit: 600_000, sync: 120_000 } as const;

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

function readState(): TickState {
  if (!existsSync(STATE)) return emptyState();
  return { ...emptyState(), ...JSON.parse(readFileSync(STATE, "utf8")) };
}
function writeState(s: TickState) {
  if (DRY) return;
  writeFileSync(STATE, JSON.stringify(s, null, 2) + "\n");
}
function readRecords(teamId: number): LiveCaptureRecord[] {
  if (!existsSync(LOG)) return [];
  return (JSON.parse(readFileSync(LOG, "utf8")) as LiveCaptureRecord[]).filter((r) => r.teamId === teamId);
}

/** Spawn a child with a timeout; returns ok + the tail of its output for the log/state. */
function run(cmd: string, args: string[], timeout: number, cwd = ROOT): { ok: boolean; out: string } {
  if (DRY) {
    log(`[dry-run] would run: ${cmd} ${args.join(" ")}`);
    return { ok: true, out: "" };
  }
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout, env: process.env });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  const ok = r.status === 0 && !r.error;
  if (!ok) log(`  ✗ ${cmd} ${args[0] ?? ""} exit=${r.status ?? "signal"}${r.error ? ` (${r.error.message})` : ""}\n${tail(out, 12)}`);
  return { ok, out: r.error ? `${r.error.message}\n${out}` : out };
}
const tail = (s: string, n: number) => s.split("\n").slice(-n).join("\n");

async function sendAlert(subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BRIEF_EMAIL_TO;
  if (DRY) {
    log(`[dry-run] would email: ${subject}`);
    return;
  }
  if (!apiKey || !to) {
    log(`alert NOT sent (RESEND_API_KEY/BRIEF_EMAIL_TO missing): ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Pocket Scout <onboarding@resend.dev>", to: [to], subject: `Pocket Scout live-eval — ${subject}`, text }),
  });
  log(res.ok ? `alert sent: ${subject}` : `alert FAILED (${res.status}): ${subject}`);
}

function gitHead(): { branch: string; head: string } {
  const b = spawnSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  const h = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  return { branch: b || "(detached)", head: h };
}

// ── Sync: artefacts → worktree on the data branch → commit → push ─────────────────
const ARTEFACTS = [
  "research/squad-eval/live-log.json",
  "research/squad-eval/live-report.md",
  "research/squad-eval/live-transfer-report.md",
  "research/squad-eval/live-dataset.csv",
  "research/squad-eval/live-dataset.parquet",
  "research/squad-eval/live-pool-dataset.csv",
  "research/squad-eval/live-pool-dataset.parquet",
  "research/squad-eval/live-status.md",
  "research/squad-eval/pool",
];
function git(args: string[], cwd: string) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}
function ensureWorktree(): string | null {
  if (existsSync(join(WORKTREE, ".git"))) return null;
  mkdirSync(join(ROOT, ".worktrees"), { recursive: true });
  const remote = git(["ls-remote", "--heads", "origin", DATA_BRANCH], ROOT).stdout.trim();
  const local = git(["show-ref", "--verify", "--quiet", `refs/heads/${DATA_BRANCH}`], ROOT).status === 0;
  if (remote && !local) {
    git(["fetch", "origin", `${DATA_BRANCH}:${DATA_BRANCH}`], ROOT);
  } else if (!remote && !local) {
    // Orphan branch from an empty tree, built with plumbing so the working tree is untouched
    // (git 2.33 here has no `worktree add --orphan`).
    const tree = git(["hash-object", "-t", "tree", "/dev/null"], ROOT).stdout.trim();
    const commit = git(["commit-tree", tree, "-m", "data(live-eval): init"], ROOT).stdout.trim();
    if (!commit) return "could not create the orphan data branch";
    const b = git(["branch", DATA_BRANCH, commit], ROOT);
    if (b.status !== 0) return `git branch failed: ${b.stderr}`;
  }
  const w = git(["worktree", "add", WORKTREE, DATA_BRANCH], ROOT);
  return w.status === 0 ? null : `git worktree add failed: ${w.stderr}`;
}
function syncArtefacts(message: string): { ok: boolean; out: string } {
  if (DRY) {
    log(`[dry-run] would sync artefacts to ${DATA_BRANCH} (${WORKTREE})`);
    return { ok: true, out: "" };
  }
  const err = ensureWorktree();
  if (err) return { ok: false, out: err };
  for (const rel of ARTEFACTS) {
    const src = join(ROOT, rel);
    const dst = join(WORKTREE, rel);
    if (!existsSync(src)) continue;
    mkdirSync(join(dst, ".."), { recursive: true });
    rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true });
  }
  for (const f of ["live-fit.json", "live-fit.md", "live-drift.md", "live-drift.json", "live-weights-candidate.json", "gate.json"]) {
    const src = join(CB_OUT, f);
    if (existsSync(src)) {
      mkdirSync(join(WORKTREE, "research", "composite-backtest", "out"), { recursive: true });
      cpSync(src, join(WORKTREE, "research", "composite-backtest", "out", f));
    }
  }
  git(["add", "research"], WORKTREE);
  const dirty = git(["status", "--porcelain"], WORKTREE).stdout.trim();
  if (!dirty) return { ok: true, out: "nothing to commit" };
  const c = git(["commit", "-q", "-m", message], WORKTREE);
  if (c.status !== 0) return { ok: false, out: `commit failed: ${c.stderr}` };
  const p = git(["push", "-q", "-u", "origin", DATA_BRANCH], WORKTREE);
  if (p.status !== 0) return { ok: false, out: `push failed: ${tail(p.stderr, 5)}` };
  return { ok: true, out: `pushed ${git(["rev-parse", "--short", "HEAD"], WORKTREE).stdout.trim()} to ${DATA_BRANCH}` };
}

// ── Status file ───────────────────────────────────────────────────────────────────
function writeStatus(s: TickState, events: Gameweek[], records: LiveCaptureRecord[], teamId: number) {
  const now = new Date();
  const { target, hoursLeft } = captureWindow(events, now);
  const { branch, head } = gitHead();
  const latest = [...records].filter((r) => (r.captureMode ?? "pre-deadline") === "pre-deadline").sort((a, b) => b.gw - a.gw)[0];
  const rows = (f: string) => {
    const p = join(SE, f);
    if (!existsSync(p)) return "unavailable";
    const lines = readFileSync(p, "utf8").split("\n").filter(Boolean);
    const hdr = lines[0]?.split(",") ?? [];
    const i = hdr.indexOf("label_gws");
    const complete = i >= 0 ? lines.slice(1).filter((l) => l.split(",")[i] === "3").length : 0;
    return `${lines.length - 1} rows, ${complete} complete-label`;
  };
  const fitLine = existsSync(join(CB_OUT, "live-drift.md"))
    ? (readFileSync(join(CB_OUT, "live-drift.md"), "utf8").split("\n").find((l) => l.startsWith("**")) ?? "see live-drift.md")
    : "not installed (composite-refit-gate)";
  const md = [
    `# Live-eval status`,
    ``,
    `_Rewritten every tick by scripts/live-eval-tick.ts — ${now.toISOString()}. Checkout: \`${branch}\` @ ${head}._`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Next deadline | ${target ? `GW ${target.id} · ${target.deadline_time} · ${hoursLeft!.toFixed(1)}h left${hoursLeft! <= 5 ? " · **IN CAPTURE WINDOW**" : ""}` : "none (season over / API mid-rollover)"} |`,
    `| Last capture | ${latest ? `GW ${latest.gw} at ${latest.capturedAt}${latest.postDeadline ? " ⚠ post-deadline" : ""} · captain ${latest.appCaptain?.webName ?? "unavailable"} · transfer ${typeof latest.transfer === "object" ? (latest.transfer.primary.moves.map((m) => `${m.outName}→${m.inName}`).join(", ") || "hold") : (latest.transfer ?? "unavailable")}` : "none"} |`,
    `| Last scored GW | ${s.lastScoredGw || "none"}${s.lastScoreAt ? ` (${s.lastScoreAt})` : ""} |`,
    `| Awaiting data_checked | ${awaitingDataCheck(records, events, s.lastScoredGw).join(", ") || "—"} |`,
    `| live-dataset.csv (universe) | ${rows("live-dataset.csv")} |`,
    `| live-pool-dataset.csv (pool) | ${rows("live-pool-dataset.csv")} |`,
    `| Last dataset build | ${s.lastDatasetAt ?? "never"} |`,
    `| Refit gate | ${fitLine} |`,
    `| Failures (consecutive) | ${Object.entries(s.failures).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(", ") || "none"} |`,
    `| Last error | ${s.lastError ? `${s.lastError.step} @ ${s.lastError.at}: ${s.lastError.message.split("\n")[0]}` : "none"} |`,
    `| Missed windows alerted | ${s.missedWindowAlerted.join(", ") || "none"} |`,
    `| Manager | ${teamId} |`,
    ``,
  ].join("\n");
  if (!DRY) writeFileSync(STATUS, md);
  else log(`[dry-run] status:\n${md}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────────
async function main() {
  loadEnvLocal(ROOT);
  const teamId = Number(process.env.BRIEF_TEAM_ID) || DEFAULT_TEAM_ID;
  let state = readState();
  const now = new Date();
  const changed: string[] = [];
  log(`tick start${DRY ? " [dry-run]" : ""}${FORCE ? " [force]" : ""} manager=${teamId}`);

  const boot = await fetchBootstrap();
  const events = boot.gameweeks;
  let records = readRecords(teamId);

  const step = async (name: StepName, fn: () => Promise<{ ok: boolean; out: string }>) => {
    const r = await fn();
    const applied = applyStep(state, name, r.ok, new Date().toISOString(), r.out);
    state = applied.state;
    writeState(state);
    if (applied.alert) {
      await sendAlert(`${name} failed twice in a row`, `Step "${name}" has failed on two consecutive ticks.\n\nLast output:\n${tail(r.out, 30)}\n\nStatus: research/squad-eval/live-status.md`);
    }
    return r.ok;
  };

  // 1. capture
  const win = captureWindow(events, now);
  if (win.target && (win.inWindow || FORCE)) {
    log(`capture: GW ${win.target.id} deadline in ${win.hoursLeft!.toFixed(1)}h — running`);
    const ok = await step("capture", async () => run("npx", ["tsx", join(SE, "capture.ts"), String(teamId)], TIMEOUT.capture));
    if (ok && !DRY) {
      state = { ...state, lastCapturedGw: win.target.id, lastCaptureAt: new Date().toISOString() };
      writeState(state);
      changed.push(`capture GW${win.target.id}`);
      records = readRecords(teamId);
    }
  } else {
    log(`capture: ${win.target ? `GW ${win.target.id} deadline in ${win.hoursLeft!.toFixed(1)}h — outside the window` : "no upcoming deadline"}`);
  }

  // missed-window alert (one per GW)
  const missed = missedWindows(records, events, now, state.missedWindowAlerted);
  for (const gw of missed) {
    await sendAlert(`GW ${gw} capture window missed`, `The GW ${gw} deadline passed with no clean pre-deadline capture in live-log.json.\nThat gameweek cannot be scored. Check the tick log (~/Library/Logs/pocketscout-live-eval.log) and whether the Mac was awake inside the 5h window.`);
    if (!DRY) {
      state = { ...state, missedWindowAlerted: [...state.missedWindowAlerted, gw] };
      writeState(state);
    }
  }

  // 2. score
  const pending = pendingScoreGws(records, events, state.lastScoredGw);
  const waiting = awaitingDataCheck(records, events, state.lastScoredGw);
  if (waiting.length) log(`score: GW ${waiting.join(", ")} finished but awaiting data_checked`);
  let scored = false;
  if (pending.length) {
    log(`score: GW ${pending.join(", ")} finished + data_checked — running score-live`);
    scored = await step("score", async () => run("npx", ["tsx", join(SE, "score-live.ts"), String(teamId)], TIMEOUT.score));
    if (scored && !DRY) {
      state = { ...state, lastScoredGw: Math.max(...pending), lastScoreAt: new Date().toISOString() };
      writeState(state);
      changed.push(`score GW${pending.join("+")}`);
    }
  } else {
    log(`score: nothing newly finished (last scored GW ${state.lastScoredGw || "none"})`);
  }

  // 3. dataset (Parquet) — after a successful score, or if never built while CSVs exist
  const needDataset = scored || (!state.lastDatasetAt && existsSync(join(SE, "live-dataset.csv")));
  let dataset = false;
  if (needDataset) {
    dataset = await step("dataset", async () => {
      for (const f of ["live-dataset.csv", "live-pool-dataset.csv"]) {
        if (!existsSync(join(SE, f))) continue;
        const r = run(PYTHON, [join(ROOT, "research", "composite-backtest", "to_parquet.py"), join(SE, f)], TIMEOUT.dataset);
        if (!r.ok) return r;
      }
      return { ok: true, out: "parquet derived" };
    });
    if (dataset && !DRY) {
      state = { ...state, lastDatasetAt: new Date().toISOString() };
      writeState(state);
      changed.push("dataset");
    }
  } else {
    log("dataset: up to date");
  }

  // 4. refit hand-off (composite-refit-gate)
  if (existsSync(REFIT_GATE)) {
    if (state.lastScoredGw > state.lastFitGw && (dataset || scored)) {
      log(`fit: handing off to refit-gate for GW ${state.lastScoredGw}`);
      const ok = await step("fit", async () => run("npx", ["tsx", REFIT_GATE], TIMEOUT.fit));
      if (ok && !DRY) {
        state = { ...state, lastFitGw: state.lastScoredGw };
        writeState(state);
        changed.push(`fit GW${state.lastScoredGw}`);
        if (existsSync(join(CB_OUT, "gate-passed.flag"))) {
          await sendAlert(`refit gate PASSED (GW ${state.lastScoredGw})`, readFileSync(join(CB_OUT, "gate-passed.flag"), "utf8"));
          rmSync(join(CB_OUT, "gate-passed.flag"), { force: true });
        }
      }
    } else {
      log(`fit: nothing new (last fit GW ${state.lastFitGw || "none"}, last scored GW ${state.lastScoredGw || "none"})`);
    }
  } else {
    log("fit: refit gate not installed (composite-refit-gate) — skipped");
  }

  // 5. status — always
  writeStatus(state, events, records, teamId);

  // 6. sync — only when something changed this tick (quiet ticks don't commit)
  const errored = Object.values(state.failures).some((n) => n > 0);
  if (changed.length || errored) {
    const msg = `data(live-eval): ${changed.join(", ") || "status"} ${new Date().toISOString().slice(0, 16)}Z`;
    await step("sync", async () => syncArtefacts(msg));
  } else {
    log("sync: nothing changed — skipped");
  }

  state = { ...state, lastTickAt: new Date().toISOString() };
  writeState(state);
  log(`tick end (${changed.join(", ") || "quiet"})`);
}

main().catch((e) => {
  console.error(`${new Date().toISOString()} live-eval-tick failed: ${e instanceof Error ? e.stack ?? e.message : e}`);
  process.exit(1);
});
