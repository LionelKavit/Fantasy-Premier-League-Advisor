// Derive the one-line glanceable verdict from a committed GameweekPlan.
//
// Pure and deterministic *given the final plan*. The verdict is only shown once
// the insights phase has produced the optimizer transfer + LLM-refined captain
// (the bar shows a placeholder until then) — so a shown decision never swaps
// mid-flight. Transfer wording reuses `groupTransferMoves`, so it can't drift
// from This Week.
import type { GameweekPlan } from "@/lib/plan/types";
import { groupTransferMoves } from "./transferMoves";

export interface Verdict {
  /** Move / roll / play-chip, or an unavailable note if the optimizer didn't run. */
  transfer: string;
  /** Captain web name (no prefix — the bar adds "Captain "); null if not computed. */
  captain: string | null;
  /** Chip call, e.g. "Hold your chips". Empty when a chip is in the transfer segment. */
  chip: string;
}

// Local chip labels — kept here so this lib stays independent of components.
const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freeHit: "Free Hit",
  benchBoost: "Bench Boost",
  tripleCaptain: "Triple Captain",
};

// The chip the plan plays *this* gameweek (orchestrator-set play-now), if any.
function activePlayNowChip(plan: GameweekPlan) {
  return (
    plan.transfers?.chipPlan?.find(
      (c) => c.status === "play-now" && c.triggerGw === plan.currentGw
    ) ?? null
  );
}

const chipLabel = (chip: string) => `Play your ${CHIP_LABELS[chip] ?? chip}`;

// A transfer chip (Wildcard / Free Hit) carries a transfer draft — it IS the
// week's transfer plan. A draftless chip (Bench Boost / Triple Captain) coexists
// with the normal free transfer.
function isTransferChip(chip: { draft: unknown[] | null } | null): boolean {
  return !!chip && Array.isArray(chip.draft) && chip.draft.length > 0;
}

function transferSegment(plan: GameweekPlan): string {
  const t = plan.transfers;
  if (!t) return "Transfer analysis unavailable"; // insights didn't produce an optimizer result

  // Wildcard / Free Hit: the chip is the transfer plan — show it here.
  const chip = activePlayNowChip(plan);
  if (isTransferChip(chip) && chip) return chipLabel(chip.chip);

  // Otherwise show the normal move (a draftless chip still makes a free transfer).
  const action = t.primaryRecommendation;
  if (action.type === "ROLL") return "Roll your transfer";

  const groups = groupTransferMoves(action.transfers);
  if (groups.length === 0) return "Roll your transfer"; // no concrete move → effectively a hold

  const [first, ...rest] = groups;
  const move = `${first.out} → ${first.candidates.join(" / ")}`;
  return rest.length > 0 ? `${move} +${rest.length} more` : move;
}

function chipSegment(plan: GameweekPlan): string {
  const chip = activePlayNowChip(plan);
  if (chip) {
    // A transfer chip is already named in the transfer segment — don't repeat it.
    // A draftless chip (BB/TC) is announced here, alongside the transfer.
    return isTransferChip(chip) ? "" : chipLabel(chip.chip);
  }
  const r = plan.chipsRemaining;
  const remaining = r.wildcard + r.freeHit + r.benchBoost + r.tripleCaptain;
  return remaining > 0 ? "Hold your chips" : "No chips left";
}

export function buildVerdict(plan: GameweekPlan): Verdict {
  return {
    transfer: transferSegment(plan),
    // Only the LLM-refined captain — never the provisional base armband, so the
    // verdict shows one final captain (or none), never a swap.
    captain: plan.captaincy?.captain.player.player.webName ?? null,
    chip: chipSegment(plan),
  };
}
