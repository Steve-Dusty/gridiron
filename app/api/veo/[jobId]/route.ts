import { NextResponse } from "next/server";
import { getVeoJob } from "@/lib/veoJobs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getVeoJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    videoPath: job.videoPath ?? null,
    error: job.error ?? null,
  });
}
