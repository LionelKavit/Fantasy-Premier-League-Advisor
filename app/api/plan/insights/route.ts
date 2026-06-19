import { NextRequest, NextResponse } from "next/server";
import { runGameweekPlanInsights } from "@/lib/plan";
import { CAPTAIN_CONFIG } from "@/lib/config";
import type { ApiErrorResponse } from "@/lib/types";

// Slow LLM phase: optimizer + captaincy + long-term syntheses. Cached per
// team+gw+ft+horizon; `force=1` (Re-analyze) bypasses the cache.
export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team_id");
  const freeTransfersParam = request.nextUrl.searchParams.get("free_transfers");
  const horizonParam = request.nextUrl.searchParams.get("horizon");
  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!teamId) {
    return NextResponse.json(
      { error: "team_id is required", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  const freeTransfers = freeTransfersParam
    ? Math.min(2, Math.max(1, parseInt(freeTransfersParam)))
    : 1;
  const captainHorizon = horizonParam
    ? Math.min(10, Math.max(1, parseInt(horizonParam)))
    : CAPTAIN_CONFIG.horizonLengthDefault;

  try {
    const result = await runGameweekPlanInsights(
      parseInt(teamId),
      { freeTransfers, captainHorizon },
      { force }
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json(
      { error: message, status } satisfies ApiErrorResponse,
      { status }
    );
  }
}
