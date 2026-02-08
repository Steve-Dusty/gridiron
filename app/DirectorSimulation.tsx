"use client";

import { useState, useRef, useEffect } from "react";
import { useOdyssey } from "@odysseyml/odyssey/react";

interface DirectorSimulationProps {
  apiKey: string;
  combinedPrompt: string;
}

interface HistoryEntry {
  text: string;
  timestamp: number;
}

export default function DirectorSimulation({
  apiKey,
  combinedPrompt,
}: DirectorSimulationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const [interactText, setInteractText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const odyssey = useOdyssey({
    apiKey,
    handlers: {
      onConnected: (mediaStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      },
      onDisconnected: () => {
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsStreaming(false);
      },
      onStreamStarted: () => {
        setIsStreaming(true);
        setTimeout(() => inputRef.current?.focus(), 200);
      },
      onStreamEnded: () => setIsStreaming(false),
      onError: (error, fatal) => {
        console.error("Director sim error:", error.message, "Fatal:", fatal);
      },
      onInteractAcknowledged: (p) => {
        console.log("Director interact acknowledged:", p);
      },
      onStreamError: (reason, message) => {
        console.error("Director stream error:", reason, message);
      },
    },
  });

  useEffect(() => {
    odyssey
      .connect()
      .then(() => console.log("Director sim: Odyssey connected"))
      .catch((err) =>
        console.error("Director sim connection failed:", err.message)
      );
    return () => odyssey.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (odyssey.isConnected && !isStreaming) {
      odyssey
        .startStream({ prompt: combinedPrompt, portrait: false })
        .catch((err) =>
          console.error("Director start stream failed:", err.message)
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odyssey.isConnected]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleInteract = async () => {
    const text = interactText.trim();
    if (!text || !odyssey.isConnected || !isStreaming) return;
    setInteractText("");
    setHistory((prev) => [...prev, { text, timestamp: Date.now() }]);
    try {
      await odyssey.interact({ prompt: text });
    } catch (err) {
      console.error("Director interact failed:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleInteract();
    }
  };

  const displayStatus = isStreaming
    ? "live"
    : odyssey.isConnected
      ? "starting"
      : odyssey.status;

  const dotClass = isStreaming
    ? "live"
    : odyssey.status === "connecting" || odyssey.status === "authenticating"
      ? "connecting"
      : "";

  return (
    <div className="director-simulation">
      <div className="gen-simulation">
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="simulation-overlay">
          <div className="simulation-header">
            <span className="simulation-label">interactive world</span>
            <div className="simulation-status-wrap">
              <div className={`simulation-dot ${dotClass}`} />
              <span className="simulation-status-text">{displayStatus}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="director-console">
        <div className="director-console-label">what do you want to change?</div>
        <div className="director-console-history">
          {history.length === 0 && (
            <span className="editor-history-empty">
              interactions will appear here
            </span>
          )}
          {history.map((entry, i) => (
            <div key={i} className="editor-history-item">
              <span className="editor-history-arrow">&rsaquo;</span>
              <span className="editor-history-text">{entry.text}</span>
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>
        <div className="director-console-input">
          <input
            ref={inputRef}
            type="text"
            className="editor-input"
            placeholder={
              isStreaming ? "direct the scene..." : "waiting for stream..."
            }
            value={interactText}
            onChange={(e) => setInteractText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isStreaming}
          />
          <button
            className="editor-send-btn"
            onClick={handleInteract}
            disabled={!isStreaming || !interactText.trim()}
          >
            &rarr;
          </button>
        </div>
        {odyssey.error && (
          <div className="editor-error">{odyssey.error}</div>
        )}
      </div>
    </div>
  );
}
