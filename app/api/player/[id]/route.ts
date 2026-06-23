import { NextRequest, NextResponse } from "next/server";
import { fetchBootstrap, fetchElementSummary } from "@/lib/fpl-api";
import { buildPlayerDetail } from "@/lib/player-detail";
import type { ApiErrorResponse } from "@/lib/types";

// Per-player detail for the dialog. Reuses the warm caches the insights pipeline
// already populated: fetchBootstrap (normalized players) + fetchElementSummary
// (per-GW history → minutes last week). For any analyzed player this issues no
// new FPL request; element-summary failure degrades to minutesLastWeek = null.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (!Number.isInteger(playerId)) {
    return NextResponse.json(
      { error: "invalid player id", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  try {
    const bootstrap = await fetchBootstrap();
    const player = bootstrap.players.find((p) => p.id === playerId);
    if (!player) {
      return NextResponse.json(
        { error: "player not found", status: 404 } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    const summary = await fetchElementSummary(playerId).catch(() => null);
    return NextResponse.json(buildPlayerDetail(player, summary));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message, status: 500 } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
