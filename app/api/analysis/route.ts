import { NextRequest, NextResponse } from "next/server";
import { runSquadAnalysisPipeline } from "@/lib/pipeline";
import type { ApiErrorResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team_id");

  if (!teamId) {
    return NextResponse.json(
      { error: "team_id is required", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  try {
    const result = await runSquadAnalysisPipeline(parseInt(teamId));
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
