"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { PromptStep, CampaignStep } from "./CampaignSelector";
import AgentChat from "./AgentChat";

const FinalVideo = dynamic(() => import("./FinalVideo"), { ssr: false });
const DirectorSimulation = dynamic(() => import("./DirectorSimulation"), { ssr: false });

interface AgentData {
  role: string;
  status: string;
  prompt: string | null;
  videoPath: string | null;
}

interface RunData {
  id: string;
  status: string;
  error: string | null;
  agents: AgentData[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Home() {
  // Phases: "prompt" → "campaign" → "generate" → "final"
  const [phase, setPhase] = useState<"prompt" | "campaign" | "generate" | "finalLoading" | "final">("prompt");
  const [userPrompt, setUserPrompt] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [phaseExiting, setPhaseExiting] = useState(false);
  const [genTab, setGenTab] = useState<"triptych" | "simulation">("triptych");

  const [triptychActive, setTriptychActive] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [initialBgHidden, setInitialBgHidden] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingText, setLoadingText] = useState("agents interpreting your world");
  const [agents, setAgents] = useState<
    Record<string, { state: string; text: string }>
  >({
    kinetic: { state: "", text: "waiting" },
    contemplative: { state: "", text: "waiting" },
    classical: { state: "", text: "waiting" },
  });
  const [triptychAgents, setTriptychAgents] = useState<AgentData[]>([]);

  const [allVideosReady, setAllVideosReady] = useState(false);
  const [odysseyApiKey, setOdysseyApiKey] = useState<string | null>(null);
  const [combinedPrompt, setCombinedPrompt] = useState("");
  const [audioSessionId, setAudioSessionId] = useState<string | null>(null);
  const [audioPaths, setAudioPaths] = useState<{
    narration?: string;
    music?: string;
  }>({});
  const [voiceoverScript, setVoiceoverScript] = useState<string>("");
  const [audioMuted, setAudioMuted] = useState(false);

  const [veoJobId, setVeoJobId] = useState<string | null>(null);
  const [veoVideoPath, setVeoVideoPath] = useState<string | null>("/api/videos/veo_e309bce0.mp4");
  const [veoStatus, setVeoStatus] = useState<string>("complete");
  const [veoError, setVeoError] = useState<string | null>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const shownRolesRef = useRef<Set<string>>(new Set());
  const narrationRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const narrationStartedRef = useRef(false);
  const musicStartedRef = useRef(false);
  const audioTriggeredRef = useRef(false);

  useEffect(() => {
    fetch("/api/odyssey-key")
      .then((r) => r.json())
      .then(({ apiKey }) => setOdysseyApiKey(apiKey))
      .catch(() => {});
  }, []);

  const resetAgentIndicators = useCallback(() => {
    setAgents({
      kinetic: { state: "", text: "waiting" },
      contemplative: { state: "", text: "waiting" },
      classical: { state: "", text: "waiting" },
    });
  }, []);

  const resetTriptych = useCallback(() => {
    setTriptychActive(false);
    setGenerating(false);
    setAllVideosReady(false);
    setTriptychAgents([]);
    shownRolesRef.current = new Set();

    for (const role of ["kinetic", "contemplative", "classical"]) {
      const video = videoRefs.current[role];
      if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
    }
  }, []);

  const resetAudio = useCallback(() => {
    if (narrationRef.current) { narrationRef.current.pause(); narrationRef.current.removeAttribute("src"); }
    if (musicRef.current) { musicRef.current.pause(); musicRef.current.removeAttribute("src"); }
    narrationStartedRef.current = false;
    musicStartedRef.current = false;
    audioTriggeredRef.current = false;
    setAudioSessionId(null);
    setAudioPaths({});
    setVoiceoverScript("");
    setCombinedPrompt("");
  }, []);

  const pollRun = useCallback(async (runId: string) => {
    while (true) {
      await sleep(2000);
      const res = await fetch(`/api/run/${runId}`);
      if (!res.ok) throw new Error("Failed to fetch run status");
      const run: RunData = await res.json();

      const newAgents: Record<string, { state: string; text: string }> = {};
      for (const agent of run.agents) {
        if (agent.status === "waiting") newAgents[agent.role] = { state: "", text: "waiting" };
        else if (agent.status === "submitting") newAgents[agent.role] = { state: "active", text: "submitting" };
        else if (agent.status === "processing") newAgents[agent.role] = { state: "active", text: "rendering" };
        else if (agent.status === "downloading") newAgents[agent.role] = { state: "active", text: "downloading" };
        else if (agent.status === "done") newAgents[agent.role] = { state: "done", text: "complete" };
        else if (agent.status === "failed") newAgents[agent.role] = { state: "error", text: "failed" };
      }
      setAgents(newAgents);

      for (const agent of run.agents) {
        if (agent.status === "done" && agent.videoPath && !shownRolesRef.current.has(agent.role)) {
          shownRolesRef.current.add(agent.role);
          if (shownRolesRef.current.size === 1) {
            setLoadingVisible(false);
            setInitialBgHidden(true);
            setTriptychActive(true);
          }
          setTriptychAgents((prev) => [...prev.filter((a) => a.role !== agent.role), agent]);
          const videoPath = agent.videoPath;
          const role = agent.role;
          setTimeout(() => {
            const video = videoRefs.current[role];
            if (video && videoPath) { video.src = videoPath; video.play().catch(() => {}); }
          }, 100);
        }
      }

      if (run.status === "generating_prompts") setLoadingText("agents interpreting your world");
      else if (run.status.startsWith("processing_")) setLoadingText("rendering video worlds");

      const doneCount = run.agents.filter((a) => a.status === "done").length;
      const failedCount = run.agents.filter((a) => a.status === "failed").length;

      if (doneCount + failedCount === 3 || run.status === "complete") {
        setLoadingVisible(false);
        setGenerating(false);
        if (doneCount > 0) setAllVideosReady(true);
        return;
      }

      if (run.status === "failed") throw new Error(run.error || "Generation pipeline failed");
    }
  }, []);

  const pollAudio = useCallback(async (sessionId: string) => {
    while (true) {
      await sleep(2000);
      try {
        const res = await fetch(`/api/audio/${sessionId}`);
        if (!res.ok) break;
        const data = await res.json();

        if (data.voiceoverScript) {
          setVoiceoverScript(data.voiceoverScript);
        }
        if (data.narrationPath) {
          setAudioPaths((prev) => ({ ...prev, narration: data.narrationPath }));
        }
        if (data.musicPath) {
          setAudioPaths((prev) => ({ ...prev, music: data.musicPath }));
        }
        if (data.status === "complete" || data.status === "failed") break;
      } catch {
        break;
      }
    }
  }, []);

  const pollVeo = useCallback(async (jobId: string) => {
    while (true) {
      await sleep(5000);
      try {
        const res = await fetch(`/api/veo/${jobId}`);
        if (!res.ok) {
          setVeoStatus("failed");
          setVeoError(`Poll error: ${res.status}`);
          break;
        }
        const data = await res.json();
        setVeoStatus(data.status);
        if (data.status === "complete" && data.videoPath) {
          setVeoVideoPath(data.videoPath);
          break;
        }
        if (data.status === "failed") {
          setVeoError(data.error || "Veo generation failed");
          break;
        }
      } catch (err) {
        setVeoStatus("failed");
        setVeoError(err instanceof Error ? err.message : "Poll failed");
        break;
      }
    }
  }, []);

  // Auto-trigger combine + audio when all videos are ready
  useEffect(() => {
    if (!allVideosReady || audioTriggeredRef.current) return;
    audioTriggeredRef.current = true;

    async function triggerAudio() {
      const agentPrompts: Record<string, string> = {};
      for (const agent of triptychAgents) {
        agentPrompts[agent.role] = agent.prompt || "";
      }

      try {
        const res = await fetch("/api/combine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt, agentPrompts, campaignType }),
        });
        if (!res.ok) return;
        const { combinedPrompt: cp } = await res.json();
        setCombinedPrompt(cp);

        const audioRes = await fetch("/api/audio/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ combinedPrompt: cp, userPrompt, campaignType }),
        });
        if (audioRes.ok) {
          const { sessionId } = await audioRes.json();
          setAudioSessionId(sessionId);
          pollAudio(sessionId);
        }
      } catch (err) {
        console.error("Auto audio trigger error:", err);
      }
    }

    triggerAudio();
  }, [allVideosReady, triptychAgents, userPrompt, campaignType, pollAudio]);

  // Play narration when path arrives
  useEffect(() => {
    if (audioPaths.narration && narrationRef.current && !narrationStartedRef.current) {
      narrationStartedRef.current = true;
      narrationRef.current.src = audioPaths.narration;
      narrationRef.current.volume = 1.0;
      narrationRef.current.muted = audioMuted;
      narrationRef.current.play().catch(() => {});
    }
  }, [audioPaths.narration, audioMuted]);

  // Play music when path arrives
  useEffect(() => {
    if (audioPaths.music && musicRef.current && !musicStartedRef.current) {
      musicStartedRef.current = true;
      musicRef.current.src = audioPaths.music;
      musicRef.current.volume = 0.25;
      musicRef.current.loop = true;
      musicRef.current.muted = audioMuted;
      musicRef.current.play().catch(() => {});
    }
  }, [audioPaths.music, audioMuted]);

  // Sync mute state
  useEffect(() => {
    if (narrationRef.current) narrationRef.current.muted = audioMuted;
    if (musicRef.current) musicRef.current.muted = audioMuted;
  }, [audioMuted]);

  const generate = useCallback(
    async (prompt: string, cType: string) => {
      setAllVideosReady(false);
      setTriptychAgents([]);
      shownRolesRef.current = new Set();

      setGenerating(true);
      setLoadingVisible(true);
      resetAgentIndicators();

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, campaignType: cType }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Generation failed");
        }
        const { runId } = await res.json();
        await pollRun(runId);
      } catch (err) {
        console.error("Generate error:", err);
        setLoadingVisible(false);
        setGenerating(false);
      }
    },
    [pollRun, resetAgentIndicators]
  );

  /* ---- Phase transitions ---- */

  const startVeoGeneration = useCallback((prompt: string) => {
    setVeoStatus("pending");
    setVeoError(null);
    fetch("/api/veo/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Veo API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.jobId) {
          setVeoJobId(data.jobId);
          setVeoStatus("generating");
          pollVeo(data.jobId);
        } else {
          setVeoStatus("failed");
          setVeoError(data.error || "No jobId returned");
        }
      })
      .catch((err) => {
        console.error("[veo] Failed to start:", err);
        setVeoStatus("failed");
        setVeoError(err instanceof Error ? err.message : "Failed to start Veo");
      });
  }, [pollVeo]);

  const handlePromptSubmit = useCallback((prompt: string) => {
    setPhaseExiting(true);
    setTimeout(() => {
      setUserPrompt(prompt);
      setPhase("campaign");
      setPhaseExiting(false);
      // Fire Veo in background after phase transition completes
      startVeoGeneration(prompt);
    }, 400);
  }, [startVeoGeneration]);

  const handleBackToPrompt = useCallback(() => {
    setPhaseExiting(true);
    setTimeout(() => {
      setPhase("prompt");
      setPhaseExiting(false);
    }, 400);
  }, []);

  const handleCampaignSelect = useCallback(
    (cType: string) => {
      const titles: Record<string, string> = {
        "product-launch": "Product Launch",
        "brand-story": "Brand Story",
        "testimonial": "Testimonial",
      };
      setCampaignType(cType);
      setCampaignTitle(titles[cType] || cType);
      setPhaseExiting(true);

      setTimeout(() => {
        setPhase("generate");
        setPhaseExiting(false);
        generate(userPrompt, cType);
      }, 400);
    },
    [generate, userPrompt]
  );

  const handleBackToCampaign = useCallback(() => {
    resetTriptych();
    resetAudio();
    setCampaignType("");
    setGenTab("triptych");
    setPhase("campaign");
    setInitialBgHidden(false);
  }, [resetTriptych, resetAudio]);

  const handleGenerateFinal = useCallback(() => {
    // Pause audio from generation screen
    if (narrationRef.current) narrationRef.current.pause();
    if (musicRef.current) musicRef.current.pause();
    setPhase("finalLoading");
    // 8-10s cinematic loading, then reveal
    const delay = 8000 + Math.random() * 2000;
    setTimeout(() => setPhase("final"), delay);
  }, []);

  const handleBackToGenerate = useCallback(() => {
    setPhase("generate");
    // Resume audio if it was playing
    if (narrationRef.current && narrationStartedRef.current) {
      narrationRef.current.play().catch(() => {});
    }
    if (musicRef.current && musicStartedRef.current) {
      musicRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <>
      {/* Light-themed phases (prompt + campaign) */}
      {phase !== "generate" && phase !== "finalLoading" && phase !== "final" && (
        <div className={`light-phase-container ${phaseExiting ? "exiting" : ""}`}>
          {phase === "prompt" && <PromptStep onSubmit={handlePromptSubmit} />}
          {phase === "campaign" && (
            <CampaignStep
              userPrompt={userPrompt}
              onSelect={handleCampaignSelect}
              onBack={handleBackToPrompt}
            />
          )}
        </div>
      )}

      {/* Dark-themed generation / final / finalLoading phases */}
      {(phase === "generate" || phase === "finalLoading" || phase === "final") && (
        <div className="gen-root" id="app-root">
          <div className={`initial-bg ${initialBgHidden ? "hidden" : ""}`} />
          <div className="ambient-overlay" />
          <div className="grain-overlay" />
          <div className="vignette-overlay" />

          {/* Top bar */}
          <div className={`gen-topbar ${phase === "finalLoading" ? "hidden-tab" : ""}`}>
            <button
              className="back-button"
              onClick={phase === "final" ? handleBackToGenerate : handleBackToCampaign}
            >
              <span className="back-arrow">&larr;</span>
              <span className="back-text">
                {phase === "final" ? "triptych" : "campaigns"}
              </span>
            </button>
            <div className="gen-topbar-info">
              <span className="gen-topbar-campaign">{campaignTitle}</span>
              <span className="gen-topbar-sep">&middot;</span>
              <span className="gen-topbar-prompt">{userPrompt}</span>
            </div>
            {phase === "generate" && (
              <div className="gen-topbar-tabs">
                <button
                  className={`gen-tab ${genTab === "triptych" ? "active" : ""}`}
                  onClick={() => setGenTab("triptych")}
                >
                  triptych
                </button>
                <button
                  className={`gen-tab ${genTab === "simulation" ? "active" : ""}`}
                  onClick={() => setGenTab("simulation")}
                >
                  simulation
                </button>
              </div>
            )}
            <div className="gen-topbar-status">
              {generating && <div className="gen-topbar-spinner" />}
              <span>
                {phase === "final"
                  ? "final cut"
                  : generating
                    ? "generating"
                    : allVideosReady
                      ? "complete"
                      : "ready"}
              </span>
            </div>
          </div>

          {/* Generate phase: split layout (always mounted, hidden via CSS) */}
          {phase === "generate" && (
            <div className={`gen-layout ${genTab !== "triptych" ? "hidden-tab" : ""}`}>
              {/* Left: Videos */}
              <div className="gen-videos">
                {/* Loading overlay (within video area) */}
                <div className={`gen-loading ${loadingVisible ? "visible" : ""}`}>
                  <div className="loading-agents">
                    {(["kinetic", "contemplative", "classical"] as const).map((role) => (
                      <div key={role} className={`agent-indicator ${agents[role]?.state || ""}`}>
                        <div className="agent-spinner" />
                        <div className="agent-check">&#10003;</div>
                        <span className="agent-role">{role}</span>
                        <span className="agent-status-text">{agents[role]?.text || "waiting"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="loading-text">{loadingText}</div>
                </div>

                {/* Triptych */}
                <div className={`gen-triptych ${triptychActive ? "active" : ""}`}>
                  {(["kinetic", "contemplative", "classical"] as const).map((role) => {
                    const agentData = triptychAgents.find((a) => a.role === role);
                    const isReady = agentData?.videoPath != null;
                    return (
                      <div key={role} className={`triptych-panel ${isReady ? "ready" : "pending"}`}>
                        <video ref={(el) => { videoRefs.current[role] = el; }} autoPlay playsInline muted loop />
                        {!isReady && triptychActive && (
                          <div className="panel-loading">
                            <div className="panel-loading-spinner" />
                            <span className="panel-loading-text">{agents[role]?.text || "waiting"}</span>
                          </div>
                        )}
                        <div className="panel-overlay">
                          <span className="panel-role">{role}</span>
                          <p className="panel-prompt">{agentData?.prompt || ""}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Audio bar — shows when audio is generating or ready */}
                {allVideosReady && (
                  <div className="gen-audio-bar">
                    {voiceoverScript ? (
                      <p className="gen-audio-script">&ldquo;{voiceoverScript}&rdquo;</p>
                    ) : (
                      <div className="gen-audio-loading">
                        <div className="gen-topbar-spinner" />
                        <span className="gen-audio-generating">preparing audio...</span>
                      </div>
                    )}
                    {(audioPaths.narration || audioPaths.music) && (
                      <button
                        className="audio-toggle"
                        onClick={() => setAudioMuted((prev) => !prev)}
                      >
                        {audioMuted ? "unmute" : "mute"}
                      </button>
                    )}
                  </div>
                )}

                {/* Hidden audio elements */}
                <audio ref={narrationRef} preload="auto" />
                <audio ref={musicRef} preload="auto" />

                {/* Generate Final Video CTA */}
                {allVideosReady && !generating && (
                  <div className="gen-final-cta">
                    <button
                      className="gen-final-btn"
                      onClick={handleGenerateFinal}
                    >
                      <span>Generate Final Video</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Agent Chat */}
              <div className="gen-chat-panel">
                {campaignType && (
                  <AgentChat prompt={userPrompt} campaignType={campaignType} />
                )}
              </div>
            </div>
          )}

          {/* Generate phase: full-screen simulation tab */}
          {phase === "generate" && (
            <div className={`gen-simulation-fullscreen ${genTab !== "simulation" ? "hidden-tab" : ""}`}>
              {odysseyApiKey && combinedPrompt ? (
                <DirectorSimulation
                  apiKey={odysseyApiKey}
                  combinedPrompt={combinedPrompt}
                />
              ) : (
                <div className="gen-simulation-waiting">
                  <div className="gen-topbar-spinner" />
                  <span>waiting for agents to finish...</span>
                </div>
              )}
            </div>
          )}

          {/* Final loading phase: cinematic transition */}
          {phase === "finalLoading" && (
            <div className="final-loading-screen">
              <div className="final-loading-content">
                <div className="final-loading-ring" />
                <p className="final-loading-title">rendering final cut</p>
                <p className="final-loading-sub">combining all creative visions into one</p>
              </div>
            </div>
          )}

          {/* Final phase: full-screen video */}
          {phase === "final" && <FinalVideo videoPath={veoVideoPath ?? undefined} veoStatus={veoStatus} veoError={veoError} />}
        </div>
      )}
    </>
  );
}
