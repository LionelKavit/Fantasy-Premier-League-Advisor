import { NextRequest, NextResponse } from "next/server";
import { runOptimizerPipeline } from "@/lib/optimizer";
import type { ApiErrorResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team_id");
  const freeTransfersParam = request.nextUrl.searchParams.get("free_transfers");

  if (!teamId) {
    return NextResponse.json(
      { error: "team_id is required", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  const freeTransfers = freeTransfersParam
    ? Math.min(2, Math.max(1, parseInt(freeTransfersParam)))
    : 1;

  try {
    const result = await runOptimizerPipeline(
      parseInt(teamId),
      freeTransfers
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
