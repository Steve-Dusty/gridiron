/**
 * Standalone ElevenLabs test script.
 * Generates sample TTS narration + music to audio/test/
 *
 * Usage:  npx tsx scripts/test-elevenlabs.ts
 *
 * Requires ELEVENLABS_API_KEY in .env
 * Zero Odyssey/Anthropic usage.
 */

import { loadEnvConfig } from "@next/env";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { mkdirSync, writeFileSync, statSync } from "fs";
import { join } from "path";

// Load .env from project root
loadEnvConfig(process.cwd());

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("ELEVENLABS_API_KEY not found in .env");
  process.exit(1);
}

const elevenlabs = new ElevenLabsClient({ apiKey });
const outDir = join(process.cwd(), "audio", "test");
mkdirSync(outDir, { recursive: true });

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function main() {
  console.log("ElevenLabs Test Script");
  console.log("=====================\n");

  // --- TTS Narration ---
  const ttsStart = Date.now();
  console.log("Generating narration...");
  const audio = await elevenlabs.textToSpeech.convert(
    "JBFqnCBsd6RMkjVDRZzb",
    {
      text: "This is the future of advertising. One prompt. Three visions. Infinite possibilities.",
      modelId: "eleven_multilingual_v2",
    }
  );
  const narrationBuffer = await streamToBuffer(
    audio as unknown as ReadableStream<Uint8Array>
  );
  const narrationPath = join(outDir, "narration.mp3");
  writeFileSync(narrationPath, narrationBuffer);
  const ttsTime = Date.now() - ttsStart;
  const narrationSize = statSync(narrationPath).size;
  console.log(
    `  Narration: ${narrationPath} (${(narrationSize / 1024).toFixed(1)} KB, ${ttsTime}ms)\n`
  );

  // --- Music ---
  const musicStart = Date.now();
  console.log("Generating music...");
  const music = await elevenlabs.music.compose({
    prompt: "cinematic orchestral build-up, modern and bold, anticipation",
    musicLengthMs: 15000,
    forceInstrumental: true,
  });
  const musicBuffer = await streamToBuffer(
    music as unknown as ReadableStream<Uint8Array>
  );
  const musicPath = join(outDir, "music.mp3");
  writeFileSync(musicPath, musicBuffer);
  const musicTime = Date.now() - musicStart;
  const musicSize = statSync(musicPath).size;
  console.log(
    `  Music: ${musicPath} (${(musicSize / 1024).toFixed(1)} KB, ${musicTime}ms)\n`
  );

  console.log("Done! Play the files to verify:");
  console.log(`  open ${narrationPath}`);
  console.log(`  open ${musicPath}`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
