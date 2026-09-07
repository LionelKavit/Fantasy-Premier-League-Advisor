/**
 * deadline-brief-email — hourly-ticked runner (launchd) that, inside the
 * `deadline − 5h → deadline` window for the next gameweek, emails the app's recommended
 * transfers + captain via Resend — once per GW.
 *
 * It no longer runs the live-eval capture: that is owned by scripts/live-eval-tick.ts
 * (live-eval-automation), so exactly one process writes live-log.json.
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
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { fetchBootstrap, fetchHistory, fetchTransferHistory } from "../lib/fpl-api";
import { deriveFreeTransfers } from "../lib/free-transfers";
import { clampFt } from "../lib/config";
import { runGameweekPlan } from "../lib/plan";
import { buildBriefGrounding, formatDeadline } from "../lib/scout/brief";
import { loadEnvLocal } from "./lib/env";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STATE = join(ROOT, "scripts", ".deadline-brief-state.json");
const WINDOW_HOURS = 5;
const DEFAULT_TEAM_ID = 2558300;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  loadEnvLocal(ROOT);
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

  // ── Email brief — once per gameweek ──────────────────────────────────────
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
  // Projected gain in EXPECTED POINTS — the quantity the transfer gate actually decides
  // on (`epNext(in) − epNext(out)` vs the 1.5/4-pt bar). `gw1Gain`/`netGain` are
  // composite-score deltas and must never be printed as "ep" (transfer-gain-units).
  // Both players' epNext come from the same in-memory bootstrap the plan used.
  const epDeltas = new Map<string, number | null>(
    (primary?.transfers ?? []).map((t) => {
      const inEp = t.candidate.player.epNext;
      const outEp = t.weakPlayer.player.epNext;
      return [
        `${t.weakPlayer.player.webName}→${t.candidate.player.webName}`,
        inEp !== null && outEp !== null ? inEp - outEp : null,
      ];
    })
  );
  const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

  const lines: string[] = [];
  lines.push(`GW ${target.id} · deadline ${deadlineLabel}`);
  lines.push("");
  if (target.id === 1) {
    lines.push("GW1: squad changes are unlimited until the deadline — the transfer plan below is moot; set your XI and armband.");
  } else if (g.transfer && moves.length > 0) {
    lines.push(`TRANSFERS — ${g.transfer.headline}`);
    const deltas: (number | null | undefined)[] = [];
    for (const m of moves) {
      const d = epDeltas.get(`${m.out}→${m.in}`);
      deltas.push(d);
      lines.push(
        `  OUT ${m.out} → IN ${m.in}` +
          (d === undefined ? "" : d === null ? " (ep unavailable)" : ` (${signed(d)} ep next GW)`)
      );
    }
    // Net line only when every move has a projection — never substitute the composite.
    if (deltas.length > 0 && deltas.every((d): d is number => typeof d === "number")) {
      lines.push(`  Net projected gain: ${signed(deltas.reduce((s, d) => s + d, 0))} ep`);
    }
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
      `Email unavailable — ${!apiKey ? "RESEND_API_KEY" : "BRIEF_EMAIL_TO"} not set in .env.local.`
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
