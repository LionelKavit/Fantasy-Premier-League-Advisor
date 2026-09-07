/**
 * Shared record types + constants for the live (prospective) squad-eval harness.
 * Side-effect free on purpose: capture.ts and score-live.ts both run `main()` at module
 * load, so neither may import a VALUE from the other (score-live once pulled a constant
 * from capture.ts and triggered a capture as a side effect — this module is the fix).
 */
import type { TransferType } from "../../lib/optimizer/types";

// 2026-27 entry (entries reset each season; 2025-26 was 10815578 — the replay's manager).
export const DEFAULT_TEAM_ID = 2558300;

// ── Deadline guard (pool-dump-deadline-guard) ─────────────────────────────────
// A capture's clock is checked when the RECORD is about to be written, not when the
// target GW was chosen: the pipeline takes minutes, and the launchd tick nearest the
// deadline can cross it mid-run. Once picks lock, `ep_next`/ownership shift and the
// lineups leak, so anything captured after the deadline is contaminated. Rule: a
// post-deadline capture NEVER overwrites a pre-deadline artefact (record or pool), and
// its pool rows go to a sidecar file the dataset builder never ingests.
export interface CaptureWritePlan {
  postDeadline: boolean;
  writeRecord: boolean; // false ⇒ keep the existing clean record untouched
  poolFile: string; // `gwNN.csv` (clean) or `gwNN.post-deadline.csv` (audit only)
  universeFile: string; // `gwNN.universe.csv` (clean) or `gwNN.universe.post-deadline.csv` (audit only)
  note: string | null; // human-readable reason when something was withheld
}

export const isPreDeadlineRecord = (r: { captureMode?: string; postDeadline: boolean }) =>
  (r.captureMode ?? "pre-deadline") === "pre-deadline" && !r.postDeadline;

export function planCaptureWrite(args: {
  gw: number;
  deadline: string;
  now: Date;
  existing?: LiveCaptureRecord | null;
}): CaptureWritePlan {
  const { gw, deadline, now, existing } = args;
  const base = `gw${String(gw).padStart(2, "0")}`;
  const postDeadline = now.getTime() >= new Date(deadline).getTime();
  if (!postDeadline)
    return { postDeadline, writeRecord: true, poolFile: `${base}.csv`, universeFile: `${base}.universe.csv`, note: null };
  const haveClean = !!existing && isPreDeadlineRecord(existing);
  return {
    postDeadline,
    writeRecord: !haveClean,
    poolFile: `${base}.post-deadline.csv`,
    universeFile: `${base}.universe.post-deadline.csv`,
    note: haveClean
      ? `POST-DEADLINE capture (${now.toISOString()} ≥ ${deadline}) — pre-deadline record from ${existing!.capturedAt} preserved; pool rows written to ${base}.post-deadline.csv (audit only, never ingested)`
      : `POST-DEADLINE capture (${now.toISOString()} ≥ ${deadline}) — no clean record existed, so the flagged record is kept for audit; it is excluded from scoring and its pool rows go to ${base}.post-deadline.csv (never ingested)`,
  };
}

export interface CandidateRecord {
  id: number;
  webName: string;
  captainScore: number;
  breakdown: Record<string, number>;
  epNext: number | null;
  compositeTotal: number;
  effectiveOwnership: number;
  rotationRisk: number;
  injurySeverity: number;
}

export interface MoveRecord {
  outId: number;
  outName: string;
  inId: number;
  inName: string;
  priceDelta: number;
  // The gate's own quantity (transfer-gain-units): FPL `ep_next` of each side at capture
  // time and their difference — what the 1.5/4-pt bar was applied to. Null when FPL had
  // no projection for a side. Absent on records captured before 2026-09-06 (never
  // back-computed — a later feed is not what the gate saw).
  epOut?: number | null;
  epIn?: number | null;
  epDelta?: number | null;
  // COMPOSITE-score deltas (0–1 scale) — display ordering only, not expected points.
  gw1Gain: number;
  gw5Gain: number;
}

export interface ActionRecord {
  type: TransferType;
  moves: MoveRecord[]; // empty ⇒ hold/roll
  netPointsCost: number; // hit cost the action pays (0 for free moves)
  netGain: number;
  breakEvenGw: number | null;
}

export interface TransferCaptureRecord {
  freeTransfersAssumed: number; // derived from public transfer + chip history (deadline-brief rule)
  bank: number;
  primary: ActionRecord;
  secondary: ActionRecord | null;
  hitVerdict: { recommended: boolean; reasoning: string; breakEvenGw: number | null };
  dataNotice: string | null; // set when the optimizer held because ep_next was unavailable
  alerts: string[];
  confidence: string;
  narrativeSummary: string;
}

// Written by score-live.ts once the GW is finished: the squad the manager ACTUALLY
// locked (public post-deadline) and its realized points — the comparison point.
export interface RealizedPlayer {
  id: number;
  webName: string;
  multiplier: number;
  isCaptain: boolean;
  isVice: boolean;
  points: number; // realized total_points (unmultiplied)
}

export interface RealizedGw {
  syncedAt: string;
  chip: string | null;
  xi: RealizedPlayer[]; // positions 1-11
  bench: RealizedPlayer[]; // positions 12-15
  captainId: number | null;
  viceId: number | null;
  gwPoints: number | null; // manager's GW score (hits deducted), from entry history
  pointsOnBench: number | null;
  gwRank: number | null;
  overallRank: number | null;
  transfers: { outId: number; outName: string; inId: number; inName: string; time: string }[];
  transfersCost: number;
  bank: number;
  squadValue: number;
}

export interface LiveCaptureRecord {
  gw: number;
  teamId: number;
  capturedAt: string;
  deadline: string;
  postDeadline: boolean;
  // "pre-deadline" = a real capture (absent on records written before 2026-09-04 — treat as
  // pre-deadline). "retrospective" = picks-only backfill written by score-live.ts for a GW
  // with no capture (e.g. GW1, where the public API exposes no picks pre-deadline); it
  // carries NO app recommendation and is never scored.
  captureMode?: "pre-deadline" | "retrospective";
  pipelineGw: number; // analysis.currentGw as the app computed it (transparency)
  squadAsOfGw?: number; // the locked picks the pipeline read (= pipelineGw; see capture.ts header)
  xi: number[];
  benchIds: number[];
  actualCaptainId: number | null; // the manager's captain in that locked squad
  appCaptain: CandidateRecord | null;
  appVice: CandidateRecord | null;
  rankedCandidates: CandidateRecord[];
  baselines: { ppgId: number | null; ownId: number | null }; // point-in-time, for scoring
  llm: { used: true; confidence: string; narrativeSummary: string } | string;
  // Absent on records captured before the transfer leg existed (GW2, GW3 of 2026-27).
  transfer?: TransferCaptureRecord | string; // string = `unavailable — <reason>`
  // Scored-pool dump (squad + candidate pool, one CSV row each, backtest schema) written
  // alongside the capture — see pool/ and score-live's live-dataset.csv. Absent on older records.
  pool?: {
    file: string; rows: number; squadRows: number; candidateRows: number;
    // live-dataset-universe: the full bootstrap scored at lite tier (absent on older records)
    universeFile?: string; universeRows?: number;
  };
  realized?: RealizedGw;
}
