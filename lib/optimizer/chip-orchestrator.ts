// The chip orchestrator (chip-orchestrator): the chips.md-grounded LLM judgment
// layer over the deterministic candidate windows.
//
// It decides, per held chip, whether to play it THIS gameweek (`play-now`), keep a
// future `window`, or `hold` — and may judge a single-fixture Triple Captain from
// the captain signals. Grounded: it can only schedule a chip on a provided window
// (the single-fixture TC is the one exception). Keyless or on any failure it returns
// the deterministic windows unchanged, so This Week never auto-activates a chip (N2).
import type { ChipRecommendation, ChipName } from "./types";
import type { ChipsRemaining, GameweekFlags } from "../types";
import type { CaptainCandidate } from "../captain/types";
import { llm } from "../llm/client";
import { SCOUT_PERSONA } from "../llm/persona";
import { loadKnowledge } from "../knowledge";
import { CHIP_CALENDAR } from "../config";

const MAX_TOKENS = 700;
const CHIP_NAMES: ChipName[] = ["wildcard", "freeHit", "benchBoost", "tripleCaptain"];

function isChipName(s: unknown): s is ChipName {
  return typeof s === "string" && (CHIP_NAMES as string[]).includes(s);
}

export interface ChipOrchestratorInput {
  windows: ChipRecommendation[]; // deterministic candidate windows (all status "window")
  chipsRemaining: ChipsRemaining;
  currentGw: number;
  gwFlags: GameweekFlags[];
  captainTop: CaptainCandidate | null; // for the single-fixture Triple Captain judgment
}

export async function orchestrateChips(input: ChipOrchestratorInput): Promise<ChipRecommendation[]> {
  const held = (Object.keys(input.chipsRemaining) as (keyof ChipsRemaining)[]).filter(
    (k) => input.chipsRemaining[k] > 0
  );
  // Nothing to plan, or no window to act on and no Triple Captain to judge → windows as-is.
  const canAct = input.windows.length > 0 || input.chipsRemaining.tripleCaptain > 0;
  if (held.length === 0 || !canAct) return input.windows;

  // Keyless → deterministic windows unchanged (N2: no This Week activation).
  if (!llm.hasApiKey()) return input.windows;

  try {
    const text = await llm.complete({
      system: `${SCOUT_PERSONA}\n\n## Expert chip principles\n${loadKnowledge("chips")}`,
      prompt: buildPrompt(input),
      maxTokens: MAX_TOKENS,
    });
    return parsePlan(text, input) ?? input.windows;
  } catch {
    return input.windows; // graceful: any failure falls back to the deterministic windows
  }
}

function buildPrompt(input: ChipOrchestratorInput): string {
  const { windows, chipsRemaining, currentGw, gwFlags, captainTop } = input;
  const deadline =
    currentGw <= CHIP_CALENDAR.firstHalfExpiryGw ? CHIP_CALENDAR.firstHalfExpiryGw : CHIP_CALENDAR.seasonEndGw;
  const half =
    currentGw <= CHIP_CALENDAR.firstHalfExpiryGw
      ? `first half (GW1–${CHIP_CALENDAR.firstHalfExpiryGw})`
      : `second half (GW${CHIP_CALENDAR.secondHalfStartGw}–${CHIP_CALENDAR.seasonEndGw})`;

  const inHalf = (f: GameweekFlags) => f.gameweek >= currentGw && f.gameweek <= deadline;
  const doubles = gwFlags.filter((f) => f.isDGW && inHalf(f)).map((f) => f.gameweek);
  const blanks = gwFlags.filter((f) => f.isBGW && inHalf(f)).map((f) => f.gameweek);

  const cap = captainTop
    ? {
        name: captainTop.player.player.webName,
        formSignal: captainTop.captainScore.breakdown.formSignal ?? null,
        fixtureMultiplier: captainTop.captainScore.breakdown.fixtureMultiplier ?? null,
        ceilingBoost: captainTop.captainScore.breakdown.ceilingBoost ?? null,
        minutesCertainty: captainTop.captainScore.breakdown.minutesCertainty ?? null,
        isDouble: captainTop.captainScore.isDgw,
        effectiveOwnership: captainTop.effectiveOwnership,
      }
    : null;

  return `Plan this manager's chips. Current gameweek: GW${currentGw}. These are the manager's ${half} chips; they expire at GW${deadline}. Refer to them as ${half} chips — do not mislabel the half.

## Chips still held
${JSON.stringify(chipsRemaining)}

## Candidate windows — the ONLY gameweeks you may schedule a chip (never invent a gameweek)
${JSON.stringify(windows.map((w) => ({ chip: w.chip, gw: w.triggerGw, reason: w.reason })), null, 2)}

## Confirmed calendar (this half)
Doubles: ${doubles.length ? doubles.join(", ") : "none"}
Blanks: ${blanks.length ? blanks.join(", ") : "none"}

## Top captain candidate this gameweek (for the single-fixture Triple Captain judgment)
${cap ? JSON.stringify(cap, null, 2) : "unavailable"}

## Instructions
For each chip the manager still holds, decide "play-now" (use it THIS gameweek, GW${currentGw}), "sequence" (keep it for a listed future window), or "hold". You may "sequence" a chip ONLY to a gameweek that appears in its candidate windows. At most ONE chip may be "play-now" (one chip per gameweek). Apply the expert principles: a chip wasted by its deadline is ~10-15 points lost, so as GW${deadline} nears, bias toward using a held chip on its best available window.

Single-fixture Triple Captain (no Double): recommend playing the Triple Captain this gameweek ONLY if there is no Double before GW${deadline} AND the top captain candidate's ceiling is fixture-driven (high fixtureMultiplier = very weak opponent), the player is in form (high formSignal/ceilingBoost), and nailed on minutes (high minutesCertainty). Otherwise HOLD the Triple Captain for a Double — a Double is the textbook spot.

## Output (JSON only)
{ "plan": [ { "chip": "wildcard|freeHit|benchBoost|tripleCaptain", "decision": "play-now|sequence|hold", "gw": number|null, "reason": "one sentence" } ] }
Return ONLY valid JSON.`;
}

function parsePlan(text: string, input: ChipOrchestratorInput): ChipRecommendation[] | null {
  let raw: unknown;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    raw = JSON.parse(m[0]);
  } catch {
    return null;
  }
  const entries = (raw as { plan?: unknown })?.plan;
  if (!Array.isArray(entries)) return null;

  const out: ChipRecommendation[] = [];
  const seen = new Set<ChipName>();
  let playNowUsed = false;

  for (const e of entries as Record<string, unknown>[]) {
    const chip = e?.chip;
    if (!isChipName(chip) || seen.has(chip)) continue;
    if (input.chipsRemaining[chip] <= 0) continue;
    seen.add(chip);

    const window = input.windows.find((w) => w.chip === chip);
    const reason = typeof e.reason === "string" && e.reason ? e.reason : (window?.reason ?? "");
    const decision = e.decision;

    if (decision === "play-now" && !playNowUsed) {
      const windowNow = input.windows.find((w) => w.chip === chip && w.triggerGw === input.currentGw);
      if (windowNow) {
        out.push({ chip, triggerGw: input.currentGw, status: "play-now", reason, draft: windowNow.draft });
        playNowUsed = true;
      } else if (chip === "tripleCaptain") {
        // Single-fixture TC exception: no fixture window required (judged from signals).
        out.push({ chip, triggerGw: input.currentGw, status: "play-now", reason, draft: null });
        playNowUsed = true;
      }
      // else: no opportunity this week — fall through; the deterministic window is kept below.
      continue;
    }

    if (decision === "sequence") {
      const w = input.windows.find((x) => x.chip === chip && x.triggerGw === Number(e.gw));
      if (w) out.push({ ...w, reason }); // grounded: gw must match a provided window
      continue; // else keep its deterministic window (below)
    }

    if (decision === "hold" && window) {
      out.push({ chip, triggerGw: window.triggerGw, status: "hold", reason, draft: window.draft });
    }
    // unknown decision → ignore; the deterministic window is kept below.
  }

  // Any deterministic window the LLM didn't resolve stays as a window (single source).
  for (const w of input.windows) {
    if (!out.some((o) => o.chip === w.chip)) out.push(w);
  }
  return out;
}
