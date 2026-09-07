/**
 * live-eval-automation — the tick's decisions as PURE functions (unit-tested; no I/O).
 * scripts/live-eval-tick.ts applies them. Keep every rule here so a change to "when do we
 * capture / score / alert" is a test change, not a scheduler debugging session.
 */
import type { Gameweek } from "../lib/types";

export const WINDOW_HOURS = 5;
// A missed window is only worth alerting about while it is recent — an alert for a GW
// three weeks ago is noise, and the dedupe list keeps one alert per GW anyway.
export const MISSED_WINDOW_LOOKBACK_DAYS = 14;

export type StepName = "capture" | "score" | "dataset" | "fit" | "sync";
export const STEPS: StepName[] = ["capture", "score", "dataset", "fit", "sync"];

export interface TickState {
  lastTickAt: string | null;
  lastCapturedGw: number | null;
  lastCaptureAt: string | null;
  lastScoredGw: number; // 0 = nothing scored yet
  lastScoreAt: string | null;
  lastDatasetAt: string | null;
  lastFitGw: number; // 0 = never
  missedWindowAlerted: number[]; // GWs already alerted (one alert per GW)
  failures: Record<StepName, number>; // consecutive failures per step; reset on success
  lastError: { step: StepName; message: string; at: string } | null;
}

export function emptyState(): TickState {
  return {
    lastTickAt: null,
    lastCapturedGw: null,
    lastCaptureAt: null,
    lastScoredGw: 0,
    lastScoreAt: null,
    lastDatasetAt: null,
    lastFitGw: 0,
    missedWindowAlerted: [],
    failures: { capture: 0, score: 0, dataset: 0, fit: 0, sync: 0 },
    lastError: null,
  };
}

// Records as the tick sees them (a structural subset of LiveCaptureRecord).
export interface RecordLike {
  gw: number;
  postDeadline: boolean;
  captureMode?: string;
}
export const isCleanRecord = (r: RecordLike): boolean =>
  (r.captureMode ?? "pre-deadline") === "pre-deadline" && !r.postDeadline;

export interface CaptureWindow {
  target: Gameweek | null; // the next deadline still in the future
  hoursLeft: number | null;
  inWindow: boolean; // deadline − WINDOW_HOURS ≤ now < deadline
}

/** The next deadline and whether the tick is inside its capture window. */
export function captureWindow(events: Gameweek[], now: Date): CaptureWindow {
  const target =
    [...events]
      .filter((g) => !g.finished && new Date(g.deadline_time).getTime() > now.getTime())
      .sort((a, b) => a.id - b.id)[0] ?? null;
  if (!target) return { target: null, hoursLeft: null, inWindow: false };
  const hoursLeft = (new Date(target.deadline_time).getTime() - now.getTime()) / 3_600_000;
  return { target, hoursLeft, inWindow: hoursLeft <= WINDOW_HOURS };
}

/**
 * Gameweeks that have a clean capture, are newer than the last scored one, and that FPL
 * reports finished AND data-checked (bonus finalised) — the scoring trigger. Ascending.
 */
export function pendingScoreGws(
  records: RecordLike[],
  events: Gameweek[],
  lastScoredGw: number
): number[] {
  const byId = new Map(events.map((g) => [g.id, g]));
  return [...new Set(records.filter(isCleanRecord).map((r) => r.gw))]
    .filter((gw) => gw > lastScoredGw)
    .filter((gw) => {
      const g = byId.get(gw);
      return !!g && g.finished && g.data_checked;
    })
    .sort((a, b) => a - b);
}

/** Gameweeks awaiting `data_checked` (finished but bonus not final) — for the status file. */
export function awaitingDataCheck(records: RecordLike[], events: Gameweek[], lastScoredGw: number): number[] {
  const byId = new Map(events.map((g) => [g.id, g]));
  return [...new Set(records.filter(isCleanRecord).map((r) => r.gw))]
    .filter((gw) => gw > lastScoredGw)
    .filter((gw) => {
      const g = byId.get(gw);
      return !!g && g.finished && !g.data_checked;
    })
    .sort((a, b) => a - b);
}

/**
 * Deadlines that passed recently with NO clean pre-deadline record — the one failure the
 * operator must hear about. GW1 is never reportable (nothing is public before its
 * deadline). One alert per GW, tracked by the caller via `alerted`.
 */
export function missedWindows(
  records: RecordLike[],
  events: Gameweek[],
  now: Date,
  alerted: number[]
): number[] {
  const clean = new Set(records.filter(isCleanRecord).map((r) => r.gw));
  const floor = now.getTime() - MISSED_WINDOW_LOOKBACK_DAYS * 86_400_000;
  return events
    .filter((g) => g.id >= 2)
    .filter((g) => {
      const d = new Date(g.deadline_time).getTime();
      return d <= now.getTime() && d >= floor;
    })
    .filter((g) => !clean.has(g.id) && !alerted.includes(g.id))
    .map((g) => g.id)
    .sort((a, b) => a - b);
}

/**
 * Record a step outcome. Failures count consecutively and reset on success; an alert is
 * due exactly when a step reaches its second consecutive failure (once, not every tick).
 */
export function applyStep(
  state: TickState,
  step: StepName,
  ok: boolean,
  at: string,
  message?: string
): { state: TickState; alert: boolean } {
  const failures = { ...state.failures };
  if (ok) {
    failures[step] = 0;
    return { state: { ...state, failures }, alert: false };
  }
  failures[step] = (failures[step] ?? 0) + 1;
  return {
    state: { ...state, failures, lastError: { step, message: message ?? "unknown", at } },
    alert: failures[step] === 2,
  };
}
