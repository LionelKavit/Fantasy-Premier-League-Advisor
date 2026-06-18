import type { GameweekPlan } from "../plan/types";

const CHIP_NAMES: Record<string, string> = {
  wildcard: "Wildcard",
  freeHit: "Free Hit",
  benchBoost: "Bench Boost",
  tripleCaptain: "Triple Captain",
};
const chipName = (c: string) => CHIP_NAMES[c] ?? c;

function listChips(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Deterministic, client-side long-term summary stitched from the structured
 * data in the plan (horizon timing + chip windows + chips remaining). No LLM,
 * works offline. Returns one short paragraph per topic.
 */
export function buildLongTermSummary(plan: GameweekPlan): string[] {
  const out: string[] = [];
  const horizon = plan.transfers?.horizon ?? [];
  const chipPlan = plan.transfers?.chipPlan ?? [];
  const isFinalGw = plan.currentGw >= 38;

  // ── Horizon sentence ──
  if (horizon.length === 0) {
    out.push(
      isFinalGw
        ? "The season's done — there are no future fixtures to plan transfers around."
        : "No transfer target stands out over the next five gameweeks, so your squad looks well set for now."
    );
  } else {
    const top = horizon[0];
    const inName = top.candidate.player.webName;
    const outName = top.weakPlayer.player.webName;
    let phrase: string;
    switch (top.timing) {
      case "BUY_NOW":
        phrase = `${inName} is the standout move and is worth bringing in now for ${outName} — the gain holds across the next few gameweeks`;
        break;
      case "WAIT":
        phrase = `${inName} (for ${outName}) is one to watch — the gain builds later, so it can wait rather than coming in this week`;
        break;
      default:
        phrase = `${inName} gives an early boost over ${outName}, but the edge fades — bring it in now and plan to move it on later`;
        break;
    }
    const others = horizon
      .slice(1, 3)
      .map((h) => h.candidate.player.webName);
    out.push(
      others.length > 0
        ? `Over the horizon, ${phrase}. Also keep an eye on ${listChips(others)}.`
        : `Over the horizon, ${phrase}.`
    );
  }

  // ── Chip sentence ──
  const remaining = plan.chipsRemaining;
  const heldNames = (["wildcard", "freeHit", "benchBoost", "tripleCaptain"] as const)
    .filter((k) => remaining[k] > 0)
    .map(chipName);

  if (chipPlan.length > 0) {
    const windows = [...chipPlan].sort((a, b) => a.triggerGw - b.triggerGw);
    const parts = windows.map((w) => `play your ${chipName(w.chip)} in GW${w.triggerGw}`);
    out.push(`On chips: ${listChips(parts)}.`);
  } else if (heldNames.length === 0) {
    out.push("All your chips are spent, so there's nothing left to schedule.");
  } else {
    out.push(
      `You still hold your ${listChips(heldNames)}, but no upcoming gameweek clears the bar to play one just yet — hold for a stronger week.`
    );
  }

  return out;
}
