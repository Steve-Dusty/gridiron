"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  agent: "kinetic" | "contemplative" | "classical";
  text: string;
}

const AGENT_COLORS: Record<string, string> = {
  kinetic: "#e07a4a",
  contemplative: "#6aaa7a",
  classical: "#b8946a",
};

const AGENT_INITIALS: Record<string, string> = {
  kinetic: "K",
  contemplative: "C",
  classical: "CL",
};

interface AgentChatProps {
  prompt: string;
  campaignType: string;
}

export default function AgentChat({ prompt, campaignType }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prompt || !campaignType) return;

    let cancelled = false;

    async function startChat() {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, campaignType }),
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          if (cancelled) { reader.cancel(); break; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);

            if (data === "[DONE]") {
              if (!cancelled) setDone(true);
              return;
            }

            try {
              const msg: ChatMessage = JSON.parse(data);
              if (msg.agent && msg.text && !cancelled) {
                // Stagger message appearance
                await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
                if (cancelled) return;
                setMessages((prev) => [...prev, msg]);
              }
            } catch {
              // skip
            }
          }
        }

        if (!cancelled) setDone(true);
      } catch (err) {
        console.error("Agent chat error:", err);
        if (!cancelled) setDone(true);
      }
    }

    startChat();
    return () => { cancelled = true; };
  }, [prompt, campaignType]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="agent-chat">
      <div className="agent-chat-header">
        <span className="agent-chat-title">creative directors</span>
        <span className="agent-chat-status">
          {done ? "consensus reached" : "debating..."}
        </span>
      </div>

      <div className="agent-chat-messages" ref={scrollRef}>
        {messages.map((msg, i) => {
          const prevAgent = i > 0 ? messages[i - 1].agent : null;
          const showAvatar = msg.agent !== prevAgent;
          return (
            <div
              key={i}
              className={`chat-msg chat-msg-${msg.agent} ${showAvatar ? "chat-msg-first" : "chat-msg-cont"}`}
            >
              {showAvatar && (
                <div className="chat-msg-avatar-row">
                  <div
                    className="chat-msg-avatar"
                    style={{ background: AGENT_COLORS[msg.agent] }}
                  >
                    {AGENT_INITIALS[msg.agent]}
                  </div>
                  <span
                    className="chat-msg-name"
                    style={{ color: AGENT_COLORS[msg.agent] }}
                  >
                    {msg.agent}
                  </span>
                </div>
              )}
              <div
                className="chat-msg-bubble"
                style={{
                  borderColor: `${AGENT_COLORS[msg.agent]}18`,
                  background: `${AGENT_COLORS[msg.agent]}08`,
                }}
              >
                <p className="chat-msg-text">{msg.text}</p>
              </div>
            </div>
          );
        })}

        {!done && messages.length > 0 && (
          <div className="chat-typing">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </div>
        )}

        {messages.length === 0 && !done && (
          <div className="chat-waiting">agents joining the room...</div>
        )}
      </div>
    </div>
  );
}
