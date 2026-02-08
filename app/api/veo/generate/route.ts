import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { setVeoJob } from "@/lib/veoJobs";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

async function runVeoPipeline(jobId: string, prompt: string) {
  try {
    setVeoJob(jobId, { id: jobId, status: "generating" });

    let operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt,
      config: {
        aspectRatio: "16:9",
        numberOfVideos: 1,
      },
    });

    console.log(`[veo] Job ${jobId} started, polling...`);

    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
    }

    const generatedVideos = operation.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error("No videos returned from Veo");
    }

    const video = generatedVideos[0];
    const videoDir = path.join(process.cwd(), "videos");
    await mkdir(videoDir, { recursive: true });

    const outputPath = path.join(videoDir, `veo_${jobId}.mp4`);

    // Download the video using the SDK's file download
    const videoUri = video.video?.uri;
    if (!videoUri) {
      throw new Error("No video URI in response");
    }

    const videoUrl = `${videoUri}&key=${process.env.GOOGLE_API_KEY}`;
    const resp = await fetch(videoUrl);
    if (!resp.ok) {
      throw new Error(`Failed to download video: ${resp.status}`);
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    await writeFile(outputPath, buffer);

    console.log(`[veo] Job ${jobId} complete, saved to ${outputPath}`);

    setVeoJob(jobId, {
      id: jobId,
      status: "complete",
      videoPath: `/api/videos/veo_${jobId}.mp4`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[veo] Job ${jobId} failed:`, message);
    setVeoJob(jobId, {
      id: jobId,
      status: "failed",
      error: message,
    });
  }
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const jobId = crypto.randomUUID().slice(0, 8);
    setVeoJob(jobId, { id: jobId, status: "pending" });

    // Fire and forget
    runVeoPipeline(jobId, prompt);

    return NextResponse.json({ jobId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
