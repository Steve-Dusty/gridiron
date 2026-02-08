import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/runs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: run.id,
    status: run.status,
    error: run.error || null,
    agents: run.agents.map((a) => ({
      role: a.role,
      status: a.status,
      prompt: a.prompt,
      videoPath: a.videoPath,
    })),
  });
}
