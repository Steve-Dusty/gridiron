"use client";

import { useRef, useEffect, useState } from "react";

interface FinalVideoProps {
  videoPath?: string;
  veoStatus?: string;
  veoError?: string | null;
}

export default function FinalVideo({ videoPath, veoStatus, veoError }: FinalVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current && videoPath) {
      videoRef.current.play().catch(() => {});
    }
  }, [videoPath]);

  if (!videoPath) {
    const isFailed = veoStatus === "failed";
    return (
      <div className="final-content">
        <div className="final-video-container">
          <div className="final-video-loading">
            {isFailed ? (
              <>
                <span className="final-video-error-icon">!</span>
                <span>veo generation failed</span>
                {veoError && <span className="final-video-error-detail">{veoError}</span>}
              </>
            ) : (
              <>
                <div className="gen-topbar-spinner" />
                <span>
                  {veoStatus === "generating"
                    ? "veo is rendering your video..."
                    : veoStatus === "pending"
                      ? "starting veo generation..."
                      : "waiting for final video..."}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="final-content">
      <div className="final-video-container">
        <video
          ref={videoRef}
          src={videoPath}
          autoPlay
          playsInline
          muted={muted}
          loop
        />
        <div className="final-video-overlay">
          <p className="final-prompt-display">final cut</p>
        </div>
        <div className="final-video-controls">
          <button
            className="audio-toggle"
            onClick={() => setMuted((prev) => !prev)}
          >
            {muted ? "unmute" : "mute"}
          </button>
        </div>
      </div>
    </div>
  );
}
