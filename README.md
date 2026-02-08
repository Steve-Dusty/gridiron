# Gridiron.mp4

AI-powered triptych video engine. Type one ad idea, three AI creative directors debate and generate competing video interpretations in real-time, then merge everything into a polished final cut with voiceover and music — all in under a minute.

## How It Works

1. **Type one sentence** — describe the ad you want to make
2. **Pick a campaign style** — Product Launch, Brand Story, or Testimonial
3. **Watch three AI directors compete** — Kinetic (fast, explosive), Contemplative (slow, emotional), Classical (elegant, timeless) each generate a unique video while debating their approach live
4. **Direct the scene yourself** — switch to the simulation tab and interact with a live video stream in real-time
5. **Generate the final cut** — all three visions merge into one polished video with AI voiceover narration and background music

## Tech Stack

- **Next.js 15** + **React 19** + **TypeScript**
- **Claude API** (Anthropic) — generates prompt variations, streams the 3-agent creative debate, writes voiceover scripts
- **Odyssey ML** — AI video generation (batch) + interactive WebRTC streaming
- **Google Veo** — final video generation via Gemini API
- **ElevenLabs** — text-to-speech voiceover + AI music generation

## Setup

```bash
npm install
```

Create a `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-...
ODYSSEY_API_KEY=ody_...
GOOGLE_API_KEY=AIza...
ELEVENLABS_API_KEY=sk_...
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **No database** — all state is in-memory (survives Next.js HMR via `globalThis`)
- **Sequential video generation** — agents process one at a time to avoid overwhelming Odyssey
- **Progressive loading** — videos and audio appear as each completes, not waiting for all
- **Parallel pipelines** — agent chat streams alongside video generation; TTS and music generate concurrently
- **Two themes** — light cream (`#f8f6f3`) for input phases, dark cinematic (`#050507`) for generation

## Project Structure

```
app/
  page.tsx                     # Main 4-phase flow: prompt > campaign > generate > final
  CampaignSelector.tsx         # Prompt input + campaign style picker
  AgentChat.tsx                # Streaming 3-agent creative debate
  FinalVideo.tsx               # Final cut video playback
  DirectorSimulation.tsx       # Interactive WebRTC video stream
  api/
    generate/route.ts          # Start video generation pipeline
    chat/route.ts              # SSE stream of agent debate
    combine/route.ts           # Merge 3 agent prompts into one
    veo/generate/route.ts      # Start Veo final video generation
    veo/[jobId]/route.ts       # Poll Veo job status
    audio/generate/route.ts    # Start audio pipeline (TTS + music)
lib/
  runs.ts                      # In-memory video generation state
  audioSessions.ts             # In-memory audio session state
  veoJobs.ts                   # In-memory Veo job state
```
