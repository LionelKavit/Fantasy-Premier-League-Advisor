import type { GameweekPlan } from "../plan/types";

export interface ApiError {
  error: string;
  status: number;
}

/** Fetch the gameweek plan for a manager. Throws Error(message) on failure. */
export async function fetchPlan(
  managerId: number | string,
  freeTransfers: number,
  horizon?: number
): Promise<GameweekPlan> {
  const params = new URLSearchParams({
    team_id: String(managerId),
    free_transfers: String(freeTransfers),
  });
  if (horizon) params.set("horizon", String(horizon));

  const res = await fetch(`/api/plan?${params.toString()}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    if (res.status === 404) message = "No manager found for that ID. Double-check it and try again.";
    throw new Error(message);
  }
  return (await res.json()) as GameweekPlan;
}
