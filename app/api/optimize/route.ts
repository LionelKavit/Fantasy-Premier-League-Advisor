import { NextRequest, NextResponse } from "next/server";
import { runOptimizerPipeline } from "@/lib/optimizer";
import { FREE_TRANSFER_RANGE, clampFt } from "@/lib/config";
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
    ? clampFt(parseInt(freeTransfersParam))
    : FREE_TRANSFER_RANGE.default;

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
