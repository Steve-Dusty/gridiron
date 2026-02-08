import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const CAMPAIGN_LABELS: Record<string, string> = {
  "product-launch": "Product Launch",
  "brand-story": "Brand Story",
  "testimonial": "Testimonial",
};

export async function POST(request: NextRequest) {
  const { prompt, campaignType } = await request.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const campaignLabel = CAMPAIGN_LABELS[campaignType] || "General";

  const systemPrompt = `You are simulating a creative agency meeting between three AI video directors debating how to approach an ad campaign. Each has a distinct personality and visual philosophy:

- **KINETIC** — Loud, passionate, loves speed. Thinks every ad needs explosions of energy, rapid cuts, and intense visuals. Pushes for bold, in-your-face approaches. Uses short punchy sentences.
- **CONTEMPLATIVE** — Quiet, thoughtful, poetic. Believes in the power of silence, slow reveals, and emotional resonance. Often disagrees with Kinetic. Speaks in flowing, measured prose.
- **CLASSICAL** — Refined, authoritative, experienced. Values composition, symmetry, and timeless elegance. Acts as the mediator but has strong opinions about "proper" filmmaking. Speaks formally.

They are discussing how to create a "${campaignLabel}" ad for: "${prompt}"

Rules:
- Output ONLY a JSON array of message objects: [{"agent": "kinetic", "text": "..."}, ...]
- Generate 8-12 messages total showing a natural back-and-forth debate
- They should disagree, build on each other's ideas, and eventually converge on a shared vision
- Keep each message 1-3 sentences. Natural and conversational, not stiff.
- They should reference the specific prompt/product — be concrete, not generic
- No markdown, no code fences — just the raw JSON array`;

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    messages: [{ role: "user", content: systemPrompt }],
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      let messagesSent = 0;
      let inString = false;
      let escaped = false;
      let depth = 0;
      let objectStart = -1;
      let scanPos = 0;

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          buffer += event.delta.text;

          // Parse JSON objects incrementally from the buffer
          for (let i = scanPos; i < buffer.length; i++) {
            const ch = buffer[i];

            if (escaped) {
              escaped = false;
              continue;
            }

            if (ch === "\\" && inString) {
              escaped = true;
              continue;
            }

            if (ch === '"') {
              inString = !inString;
              continue;
            }

            if (inString) continue;

            if (ch === "{") {
              if (depth === 0) objectStart = i;
              depth++;
            } else if (ch === "}") {
              depth--;
              if (depth === 0 && objectStart !== -1) {
                const jsonStr = buffer.slice(objectStart, i + 1);
                try {
                  const msg = JSON.parse(jsonStr);
                  if (msg.agent && msg.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)
                    );
                    messagesSent++;
                  }
                } catch {
                  // partial or malformed, skip
                }
                objectStart = -1;
              }
            }
          }

          scanPos = buffer.length;

          // Trim processed buffer
          if (objectStart === -1 && depth === 0) {
            const lastBrace = buffer.lastIndexOf("}");
            if (lastBrace !== -1) {
              buffer = buffer.slice(lastBrace + 1);
              scanPos = buffer.length;
            }
          }
        }
      }

      // Try parsing any remaining buffer
      if (buffer.trim()) {
        try {
          const remaining = JSON.parse(buffer);
          if (Array.isArray(remaining)) {
            for (const msg of remaining) {
              if (msg.agent && msg.text && messagesSent === 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)
                );
              }
            }
          }
        } catch {
          // ignore
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
