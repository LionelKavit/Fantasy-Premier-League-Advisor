import type { GameweekPlan, PlanInsights } from "../plan/types";

export interface ApiError {
  error: string;
  status: number;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
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
  return (await res.json()) as T;
}

function planParams(
  managerId: number | string,
  freeTransfers: number,
  horizon?: number
): URLSearchParams {
  const params = new URLSearchParams({
    team_id: String(managerId),
    free_transfers: String(freeTransfers),
  });
  if (horizon) params.set("horizon", String(horizon));
  return params;
}

/** Fetch the full (merged) gameweek plan. Throws Error(message) on failure. */
export function fetchPlan(
  managerId: number | string,
  freeTransfers: number,
  horizon?: number
): Promise<GameweekPlan> {
  return getJson<GameweekPlan>(`/api/plan?${planParams(managerId, freeTransfers, horizon)}`);
}

/** Fast base phase — squad/pitch/meta + deterministic captain (no LLM wait). */
export function fetchPlanBase(
  managerId: number | string,
  freeTransfers: number,
  horizon?: number
): Promise<GameweekPlan> {
  return getJson<GameweekPlan>(`/api/plan/base?${planParams(managerId, freeTransfers, horizon)}`);
}

/** Slow insights phase — the LLM syntheses. `force` bypasses the server cache. */
export function fetchPlanInsights(
  managerId: number | string,
  freeTransfers: number,
  opts: { horizon?: number; force?: boolean } = {}
): Promise<PlanInsights> {
  const params = planParams(managerId, freeTransfers, opts.horizon);
  if (opts.force) params.set("force", "1");
  return getJson<PlanInsights>(`/api/plan/insights?${params}`);
}
