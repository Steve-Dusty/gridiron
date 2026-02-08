import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, createWriteStream, existsSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import Anthropic from "@anthropic-ai/sdk";
import { Odyssey } from "@odysseyml/odyssey";
import { setRun, getRun, type RunState } from "@/lib/runs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const odyssey = new Odyssey({ apiKey: process.env.ODYSSEY_API_KEY! });

const videosDir = join(process.cwd(), "videos");
if (!existsSync(videosDir)) mkdirSync(videosDir);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CAMPAIGN_CONTEXT: Record<string, string> = {
  "product-launch": "This is a Product Launch ad campaign. Focus on revealing and showcasing the product — unboxing energy, feature highlights, premium materials, the moment of first impression.",
  "brand-story": "This is a Brand Story ad campaign. Focus on origin narrative, craftsmanship, company identity, the people and process behind the brand, emotional connection.",
  "testimonial": "This is a Testimonial ad campaign. Focus on real human reactions, social proof, customer satisfaction, authentic emotion, trust-building moments.",
};

async function runPipeline(runState: RunState, runDir: string, campaignType?: string) {
  try {
    // 1. Generate 3 styled prompt variations via Anthropic Claude
    console.log(`[${runState.id}] Generating prompt variations...`);

    const campaignContext = campaignType && CAMPAIGN_CONTEXT[campaignType]
      ? `\n\nCampaign context: ${CAMPAIGN_CONTEXT[campaignType]}`
      : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a creative director for video advertising. Given a user prompt, create 3 distinct video scene descriptions for an ad.
Return ONLY valid JSON with no other text: { "variations": [{ "role": "kinetic", "prompt": "..." }, { "role": "contemplative", "prompt": "..." }, { "role": "classical", "prompt": "..." }] }
Each should be 1-2 sentences, vivid and cinematic. Kinetic = fast, dynamic, intense energy. Contemplative = slow, atmospheric, meditative calm. Classical = elegant, composed, timeless beauty.${campaignContext}

User prompt: ${runState.prompt}`,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Anthropic");
    }

    // Strip markdown code fences if present (Claude often wraps JSON in ```json ... ```)
    let rawJson = textContent.text.trim();
    if (rawJson.startsWith("```")) {
      rawJson = rawJson.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const { variations } = JSON.parse(rawJson);
    for (const v of variations) {
      const agent = runState.agents.find((a) => a.role === v.role);
      if (agent) agent.prompt = v.prompt;
    }

    console.log(
      `[${runState.id}] Prompts ready. Processing 3 agents sequentially...`
    );

    // 2. Process each agent FULLY sequentially: submit → poll → download → next
    for (const agent of runState.agents) {
      runState.status = `processing_${agent.role}`;
      agent.status = "submitting";

      const agentPrompt = agent.prompt ?? "";
      const script = [
        { timestamp_ms: 0, start: { prompt: agentPrompt } },
        { timestamp_ms: 3000, interact: { prompt: agentPrompt } },
        { timestamp_ms: 9000, end: {} },
      ];

      // Submit via SDK
      console.log(
        `[${runState.id}] Submitting ${agent.role}: "${agent.prompt}"`
      );
      let job: { job_id: string };
      try {
        job = await odyssey.simulate({ script, portrait: false });
        console.log(
          `[${runState.id}] ${agent.role} job started: ${job.job_id}`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[${runState.id}] ${agent.role} submit failed:`,
          message
        );
        agent.status = "failed";
        continue;
      }

      // Poll until complete
      agent.status = "processing";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let status: any;
      while (true) {
        await sleep(5000);
        try {
          status = await odyssey.getSimulateStatus(job.job_id);
          console.log(
            `[${runState.id}] ${agent.role} status: ${status.status}`
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[${runState.id}] ${agent.role} poll error:`,
            message
          );
          continue;
        }

        if (status.status === "completed") break;
        if (status.status === "failed") {
          console.error(
            `[${runState.id}] ${agent.role} failed:`,
            status.error_message
          );
          agent.status = "failed";
          break;
        }
        if (status.status === "cancelled") {
          agent.status = "failed";
          break;
        }
      }

      if (agent.status === "failed") continue;

      // Get recording URL and download
      agent.status = "downloading";
      try {
        for (const stream of status!.streams) {
          const recording = await odyssey.getRecording(stream.stream_id);
          console.log(
            `[${runState.id}] ${agent.role} video URL: ${recording.video_url}`
          );

          const videoFilename = `${agent.role}.mp4`;
          const videoPath = join(runDir, videoFilename);

          const videoRes = await fetch(recording.video_url as string);
          if (videoRes.ok) {
            await pipeline(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Readable.fromWeb(videoRes.body as any),
              createWriteStream(videoPath)
            );
            agent.videoPath = `/api/videos/${runState.id}/${videoFilename}`;
            agent.status = "done";
            console.log(`[${runState.id}] ${agent.role} saved to ${videoPath}`);
          } else {
            console.error(
              `[${runState.id}] ${agent.role} download failed: ${videoRes.status}`
            );
            agent.status = "failed";
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[${runState.id}] ${agent.role} recording/download error:`,
          message
        );
        agent.status = "failed";
      }
    }

    runState.status = "complete";
    console.log(`[${runState.id}] All done!`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${runState.id}] Pipeline error:`, err);
    runState.status = "failed";
    runState.error = message;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prompt, campaignType } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const runId = `run_${Date.now()}`;
  const runDir = join(videosDir, runId);
  mkdirSync(runDir, { recursive: true });

  const runState: RunState = {
    id: runId,
    prompt,
    status: "generating_prompts",
    agents: [
      { role: "kinetic", status: "waiting", prompt: null, videoPath: null },
      {
        role: "contemplative",
        status: "waiting",
        prompt: null,
        videoPath: null,
      },
      { role: "classical", status: "waiting", prompt: null, videoPath: null },
    ],
  };
  setRun(runId, runState);

  // Fire and forget — processing happens in background
  runPipeline(runState, runDir, campaignType);

  return NextResponse.json({ runId });
}
