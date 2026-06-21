// Contextual conversation starters for "Ask The Scout", derived from the loaded
// plan so the suggested prompts name this week's actual recommendation instead
// of four generic strings. Pure (no fetch) — sibling of buildLongTermSummary.

import type { GameweekPlan } from "../plan/types";

// The pre-rec fallback (also used before insights land / when a sub-pipeline failed).
const GENERIC = [
  "Who should I captain this week?",
  "What's my best transfer right now?",
  "Should I take a -4 hit?",
  "Which of my players are at risk?",
];

/** 3–4 prompts grounded in the plan; falls back to the generic set when there's no rec. */
export function buildScoutStarters(plan: GameweekPlan): string[] {
  const { transfers, captaincy } = plan;
  if (!transfers && !captaincy) return GENERIC;

  const starters: string[] = [];

  // Captaincy — the single biggest weekly swing.
  if (captaincy) {
    const cap = captaincy.captain.player.player.webName;
    const vice = captaincy.viceCaptain?.player.player.webName;
    starters.push(vice && vice !== cap ? `Why ${cap} over ${vice}?` : `Why captain ${cap}?`);
  } else {
    starters.push("Who should I captain this week?");
  }

  // The recommended transfer move (or whether to move at all).
  if (transfers) {
    const move = transfers.primaryRecommendation.transfers[0];
    starters.push(
      move
        ? `Walk me through ${move.weakPlayer.player.webName} → ${move.candidate.player.webName}`
        : "Is there a transfer worth making?"
    );
  } else {
    starters.push("What's my best transfer right now?");
  }

  // Evergreen follow-ups that read naturally after the brief.
  starters.push("Should I take a hit instead?");
  starters.push("Which of my players are at risk?");

  return starters;
}
