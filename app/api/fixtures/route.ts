import { NextResponse } from "next/server";
import { fetchBootstrap, fetchFixtures } from "@/lib/fpl-api";
import {
  detectCurrentGameweek,
  detectGameweekFlags,
  computeFdrRun,
} from "@/lib/gameweek";
import type { ApiErrorResponse } from "@/lib/types";

export async function GET() {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      fetchBootstrap(),
      fetchFixtures(),
    ]);

    const currentGw = detectCurrentGameweek(bootstrap.gameweeks);
    if (!currentGw) {
      return NextResponse.json(
        { error: "Could not determine current gameweek", status: 500 } satisfies ApiErrorResponse,
        { status: 500 }
      );
    }

    const allTeamIds = bootstrap.teams.map((t) => t.id);
    const gwFlags = detectGameweekFlags(fixtures, currentGw.id, allTeamIds);

    const teamFdrRuns = Object.fromEntries(
      allTeamIds.map((teamId) => [
        teamId,
        computeFdrRun(teamId, fixtures, currentGw.id, 6),
      ])
    );

    return NextResponse.json({
      fixtures,
      currentGameweek: currentGw,
      gameweekFlags: gwFlags,
      teamFdrRuns,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message, status: 500 } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
