import { NextRequest, NextResponse } from "next/server";
import { fetchBootstrap, fetchPicks, buildManagerProfile } from "@/lib/fpl-api";
import { detectCurrentGameweek } from "@/lib/gameweek";
import type { ApiErrorResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team_id");
  const freeTransfers = parseInt(
    request.nextUrl.searchParams.get("free_transfers") ?? "1"
  );

  if (!teamId) {
    return NextResponse.json(
      { error: "team_id is required", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  try {
    const bootstrap = await fetchBootstrap();
    const profile = await buildManagerProfile(parseInt(teamId), bootstrap);

    const currentGw = detectCurrentGameweek(bootstrap.gameweeks);
    if (!currentGw) {
      return NextResponse.json(
        { error: "Could not determine current gameweek", status: 500 } satisfies ApiErrorResponse,
        { status: 500 }
      );
    }

    const picksData = await fetchPicks(parseInt(teamId), currentGw.id);

    const playerMap = new Map(bootstrap.players.map((p) => [p.id, p]));
    const squad = picksData.picks.map((pick) => ({
      ...pick,
      player: playerMap.get(pick.element) ?? null,
    }));

    return NextResponse.json({
      manager: profile.entry,
      squad,
      bank: picksData.entry_history.bank,
      freeTransfers,
      currentGameweek: currentGw,
      activeChip: picksData.active_chip,
      chipsRemaining: profile.chipsRemaining,
      riskProfile: profile.riskProfile,
      transferPatterns: profile.transferPatterns,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json(
      { error: message, status } satisfies ApiErrorResponse,
      { status }
    );
  }
}
