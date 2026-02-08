import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: NextRequest) {
  const { userPrompt, agentPrompts, campaignType } = await request.json();

  if (!userPrompt || !agentPrompts) {
    return NextResponse.json(
      { error: "userPrompt and agentPrompts required" },
      { status: 400 }
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a senior creative director combining the best elements from three distinct video ad concepts into one unified vision.

Campaign type: ${campaignType || "general"}
Original brief: "${userPrompt}"

Three agent concepts:
- KINETIC (dynamic, high-energy): "${agentPrompts.kinetic}"
- CONTEMPLATIVE (atmospheric, emotional): "${agentPrompts.contemplative}"
- CLASSICAL (elegant, composed): "${agentPrompts.classical}"

Synthesize these into ONE cohesive video prompt that takes the strongest visual elements, emotional beats, and cinematic techniques from each. The result should be 2-3 sentences, vivid and cinematic — a single scene description ready for AI video generation.

Return ONLY the combined prompt text, nothing else.`,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Anthropic");
    }

    return NextResponse.json({ combinedPrompt: textContent.text.trim() });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("Combine error:", errMessage);
    return NextResponse.json(
      { error: "Failed to combine prompts" },
      { status: 500 }
    );
  }
}
