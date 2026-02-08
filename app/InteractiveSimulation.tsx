"use client";

import { useState, useRef, useEffect } from "react";
import { useOdyssey } from "@odysseyml/odyssey/react";

interface InteractiveSimulationProps {
  apiKey: string;
  prompt: string;
}

export default function InteractiveSimulation({
  apiKey,
  prompt,
}: InteractiveSimulationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [interactText, setInteractText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

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
        // Official pattern: clear srcObject on disconnect
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setIsStreaming(false);
      },
      onStreamStarted: (streamId) => {
        console.log("Interactive stream started:", streamId);
        setIsStreaming(true);
        setTimeout(() => inputRef.current?.focus(), 200);
      },
      onStreamEnded: () => {
        setIsStreaming(false);
      },
      onError: (error, fatal) => {
        console.error("Simulation error:", error.message, "Fatal:", fatal);
      },
      onInteractAcknowledged: (p) => {
        console.log("Interaction acknowledged:", p);
      },
      onStreamError: (reason, message) => {
        console.error("Stream error:", reason, message);
      },
    },
  });

  // Connect on mount — matches official docs pattern
  useEffect(() => {
    odyssey
      .connect()
      .then(() => console.log("Odyssey connected"))
      .catch((err) => console.error("Connection failed:", err.message));
    return () => odyssey.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start stream ONLY after connected — separate step per official docs
  useEffect(() => {
    if (odyssey.isConnected && !isStreaming) {
      odyssey
        .startStream({ prompt, portrait: false })
        .catch((err) => console.error("Start stream failed:", err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odyssey.isConnected]);

  const handleInteract = async () => {
    const text = interactText.trim();
    // Guard: only interact when stream is actually live
    if (!text || !odyssey.isConnected || !isStreaming) return;
    setInteractText("");
    try {
      await odyssey.interact({ prompt: text });
    } catch (err) {
      console.error("Interact failed:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleInteract();
    }
  };

  // Use the hook's built-in status — single source of truth
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
    <>
      <video ref={videoRef} autoPlay playsInline muted />
      <div className="simulation-overlay">
        <div className="simulation-header">
          <span className="simulation-label">interactive world</span>
          <div className="simulation-status-wrap">
            <div className={`simulation-dot ${dotClass}`} />
            <span className="simulation-status-text">{displayStatus}</span>
          </div>
        </div>
        <div className="simulation-interact">
          <input
            ref={inputRef}
            type="text"
            className="simulation-input"
            placeholder={
              isStreaming
                ? "describe what should happen..."
                : "waiting for stream to start..."
            }
            value={interactText}
            onChange={(e) => setInteractText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isStreaming}
          />
          <span className="simulation-hint">
            {isStreaming ? "press enter to interact" : displayStatus}
          </span>
        </div>
        {odyssey.error && (
          <div className="simulation-error-text">{odyssey.error}</div>
        )}
      </div>
    </>
  );
}
