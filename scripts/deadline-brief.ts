/**
 * deadline-brief-email — hourly-ticked runner (launchd) that, inside the
 * `deadline − 5h → deadline` window for the next gameweek:
 *   1. refreshes the live-eval capture (safety net; manual capture stays primary), and
 *   2. emails the app's recommended transfers + captain via Resend — once per GW.
 *
 * Outside the window it exits quietly. Deadlines are read live from bootstrap-static
 * every tick, so FPL's moving deadlines need no schedule maintenance.
 *
 * Run (normally via scripts/com.pocketscout.deadline-brief.plist):
 *   npx tsx scripts/deadline-brief.ts
 * Testing flags: BRIEF_FORCE=1 bypasses the window gate; BRIEF_DRY_RUN=1 prints the
 * composed email instead of sending (and records no state).
 *
 * Config (.env.local — never committed): RESEND_API_KEY, BRIEF_EMAIL_TO,
 * BRIEF_TEAM_ID (default 2558300), ANTHROPIC_API_KEY (optional — plan prose).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { fetchBootstrap, fetchHistory, fetchTransferHistory } from "../lib/fpl-api";
import { deriveFreeTransfers } from "../lib/free-transfers";
import { clampFt } from "../lib/config";
import { runGameweekPlan } from "../lib/plan";
import { buildBriefGrounding, formatDeadline } from "../lib/scout/brief";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STATE = join(ROOT, "scripts", ".deadline-brief-state.json");
const WINDOW_HOURS = 5;
const DEFAULT_TEAM_ID = 2558300;

// Dotenv-style tolerance (Next.js accepts these, so .env.local may use them):
// whitespace around `=` and single/double quotes around the value.
function loadEnvLocal() {
  const envFile = join(ROOT, ".env.local");
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  loadEnvLocal();
  const teamId = Number(process.env.BRIEF_TEAM_ID) || DEFAULT_TEAM_ID;
  const now = new Date();

  // ── Window gate ─────────────────────────────────────────────────────────────
  const boot = await fetchBootstrap();
  const target =
    boot.gameweeks.find((g) => !g.finished && new Date(g.deadline_time) > now) ?? null;
  if (!target) {
    console.log("No upcoming deadline — season over or API mid-rollover. Quiet exit.");
    return;
  }
  const deadline = new Date(target.deadline_time);
  const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft > WINDOW_HOURS && process.env.BRIEF_FORCE !== "1") {
    console.log(
      `GW ${target.id} deadline in ${hoursLeft.toFixed(1)}h — outside the ${WINDOW_HOURS}h window. Quiet exit.`
    );
    return;
  }

  // ── 1. Capture safety net (failure logged, never blocks the email) ──────────
  const capture = spawnSync(
    "npx",
    ["tsx", join(ROOT, "research", "squad-eval", "capture.ts"), String(teamId)],
    { cwd: ROOT, encoding: "utf8", timeout: 300_000 }
  );
  if (capture.status === 0) {
    console.log(`Capture refreshed for GW ${target.id}.`);
  } else {
    console.error(`Capture failed (continuing to email): ${capture.stderr?.trim() || capture.stdout?.trim() || "unknown"}`);
  }

  // ── 2. Email brief — once per gameweek ──────────────────────────────────────
  const state: { lastEmailedGw?: number } = existsSync(STATE)
    ? JSON.parse(readFileSync(STATE, "utf8"))
    : {};
  if (state.lastEmailedGw === target.id && process.env.BRIEF_DRY_RUN !== "1") {
    console.log(`GW ${target.id} brief already sent — nothing to do.`);
    return;
  }

  const [history, transferHistory] = await Promise.all([
    fetchHistory(teamId),
    fetchTransferHistory(teamId),
  ]);
  const derivedFt = deriveFreeTransfers(transferHistory, history.chips, target.id);
  const plan = await runGameweekPlan(teamId, { freeTransfers: clampFt(derivedFt) });
  const g = buildBriefGrounding(plan);

  const deadlineLabel = formatDeadline(target.deadline_time) ?? target.deadline_time;
  const moves = g.transfer?.moves ?? [];
  const primary = plan.transfers?.primaryRecommendation ?? null;
  const gains = new Map(
    (primary?.transfers ?? []).map((t) => [
      `${t.weakPlayer.player.webName}→${t.candidate.player.webName}`,
      t.gw1Gain,
    ])
  );

  const lines: string[] = [];
  lines.push(`GW ${target.id} · deadline ${deadlineLabel}`);
  lines.push("");
  if (target.id === 1) {
    lines.push("GW1: squad changes are unlimited until the deadline — the transfer plan below is moot; set your XI and armband.");
  } else if (g.transfer && moves.length > 0) {
    lines.push(`TRANSFERS — ${g.transfer.headline}`);
    for (const m of moves) {
      const gain = gains.get(`${m.out}→${m.in}`);
      lines.push(`  OUT ${m.out} → IN ${m.in}${gain !== undefined ? ` (+${gain.toFixed(1)} ep next GW)` : ""}`);
    }
    if (primary && primary.netGain > 0) lines.push(`  Net projected gain: +${primary.netGain.toFixed(1)} ep`);
  } else {
    lines.push("TRANSFERS — Hold: no move clears the points bar this week; bank the transfer.");
  }
  lines.push("");
  if (g.captain) {
    lines.push(`CAPTAIN — ${g.captain.name}${g.captain.vice ? ` (vice: ${g.captain.vice})` : ""}`);
    if (g.captain.why) lines.push(`  ${g.captain.why}`);
  } else {
    lines.push("CAPTAIN — unavailable this week");
  }
  if (g.chip) {
    lines.push("");
    lines.push(`CHIP — Play your ${g.chip.label}: ${g.chip.reason}`);
  }
  if (g.topAlert) {
    lines.push("");
    lines.push(`ALERT — ${g.topAlert}`);
  }
  if (plan.transfers?.dataNotice) {
    lines.push("");
    lines.push(`NOTE — ${plan.transfers.dataNotice}`);
  }
  lines.push("");
  lines.push(
    `Assuming ${derivedFt} free transfer${derivedFt === 1 ? "" : "s"} (derived from your transfer history) — if that's wrong, re-run in the app with the true count.`
  );
  lines.push(
    process.env.ANTHROPIC_API_KEY
      ? `Generated ${now.toISOString()} by Pocket Scout.`
      : `Generated ${now.toISOString()} by Pocket Scout — deterministic engine only (no ANTHROPIC_API_KEY on this machine; prose reasoning unavailable).`
  );

  const text = lines.join("\n");
  const html = `<pre style="font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap;">${esc(text)}</pre>`;
  const captainBit = g.captain ? `${g.captain.name} (C)` : "no captain";
  const transferBit =
    target.id === 1 ? "set your squad" : moves.length > 0 ? `${moves.length} transfer${moves.length === 1 ? "" : "s"}` : "hold";
  const subject = `Pocket Scout — GW ${target.id}: ${captainBit}, ${transferBit} · deadline ${deadlineLabel}`;

  if (process.env.BRIEF_DRY_RUN === "1") {
    console.log(`[dry-run] Subject: ${subject}\n\n${text}`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BRIEF_EMAIL_TO;
  if (!apiKey || !to) {
    console.error(
      `Email unavailable — ${!apiKey ? "RESEND_API_KEY" : "BRIEF_EMAIL_TO"} not set in .env.local (capture already ran).`
    );
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Pocket Scout <onboarding@resend.dev>", to: [to], subject, text, html }),
  });
  if (!res.ok) {
    console.error(`Resend error ${res.status}: ${await res.text()} — state not recorded; next tick retries.`);
    process.exit(1);
  }
  writeFileSync(STATE, JSON.stringify({ lastEmailedGw: target.id }) + "\n");
  console.log(`GW ${target.id} brief sent to ${to}.`);
}

main().catch((e) => {
  console.error(`deadline-brief failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
