"use client";

import { useState, useRef } from "react";

interface Campaign {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  styles: {
    kinetic: string;
    contemplative: string;
    classical: string;
  };
}

const CAMPAIGNS: Campaign[] = [
  {
    id: "product-launch",
    title: "Product Launch",
    subtitle: "unveil something extraordinary",
    icon: "◈",
    styles: {
      kinetic: "Fast cuts, explosive energy, dynamic camera movement, high-contrast lighting",
      contemplative: "Slow reveal, golden-hour warmth, intimate close-ups, soft focus transitions",
      classical: "Symmetrical composition, grand staging, chiaroscuro lighting, stately pacing",
    },
  },
  {
    id: "brand-story",
    title: "Brand Story",
    subtitle: "tell your origin myth",
    icon: "◉",
    styles: {
      kinetic: "Rapid montage, kinetic typography, handheld energy, match cuts between scenes",
      contemplative: "Dawn light, quiet spaces, unhurried panning shots, natural textures",
      classical: "Aerial sweeps, balanced framing, legacy textures, authoritative voiceover tone",
    },
  },
  {
    id: "testimonial",
    title: "Testimonial",
    subtitle: "let the people speak",
    icon: "◎",
    styles: {
      kinetic: "Quick-cut reactions, burst confetti, split-screen energy, rhythmic editing",
      contemplative: "Soft portrait lighting, emotional close-ups, shallow depth of field, silence",
      classical: "Formal framing, muted palette, direct address to camera, cinematic grain",
    },
  },
];

const STYLE_META: Record<string, { label: string; desc: string }> = {
  kinetic: { label: "Kinetic", desc: "fast, dynamic, intense" },
  contemplative: { label: "Contemplative", desc: "slow, atmospheric, calm" },
  classical: { label: "Classical", desc: "elegant, composed, timeless" },
};

/* ---- Step 1: Prompt Input ---- */

interface PromptStepProps {
  onSubmit: (prompt: string) => void;
}

const PREFILLS = [
  {
    label: "Super Bowl",
    prompt: `Cinematic advertising visual for "Opus 4.6" — American football players scoring a touchdown in perfect slow-motion clarity, frozen at the peak of celebration.\n\nBehind the players, a massive glowing banner reads "OPUS 4.6", dominating the stadium sky like a futuristic hologram.\n\nThe background visually represents fast thinking and intelligence: flowing neural-network lines, lightning-fast data streams, glowing vectors, and abstract computation waves radiating outward, symbolizing Opus 4.6 Fast Thinking running in the background.\n\nPlayers are celebrating together, pointing upward toward the OPUS 4.6 banner, confetti and light particles exploding through the air.\n\nHyper-realistic athletes, sharp anatomy, premium uniforms, cinematic lighting, shallow depth of field, ultra-clean composition.\n\nMood: victory, intelligence, dominance, speed.\nStyle: high-end tech product launch meets Super Bowl commercial.`,
  },
  {
    label: "Luxury Fragrance",
    prompt: `A single perfume bottle suspended in mid-air inside a dark, reflective obsidian room. Golden light refracts through the glass, casting prismatic rays across the scene.\n\nSilk fabric unfurls in slow-motion around the bottle, weightless and ethereal. Micro water droplets float frozen in time, catching light like tiny diamonds.\n\nThe brand name "AURA" appears etched in light above the bottle, minimalist and elegant.\n\nMood: seduction, mystery, opulence.\nStyle: Chanel meets sci-fi, ultra-premium fragrance campaign.`,
  },
  {
    label: "Electric Vehicle",
    prompt: `A sleek electric sedan driving through a futuristic cityscape at twilight. Neon reflections shimmer across the wet asphalt. The car leaves trails of blue-white energy in its wake.\n\nDrone shot pulls back to reveal the full skyline — clean architecture, solar panels glinting, wind turbines in the distance. The car is the only vehicle on the road, symbolizing a new era.\n\nText overlay fades in: "THE FUTURE MOVES QUIETLY."\n\nMood: innovation, serenity, power.\nStyle: Tesla commercial meets Blade Runner 2049 cinematography.`,
  },
  {
    label: "Streetwear Drop",
    prompt: `A figure walks through a rain-soaked Tokyo alley at night, wearing an oversized hoodie with abstract geometric patterns that seem to glow and shift in the neon light.\n\nClose-up shots intercut: the fabric texture, a hand adjusting a cap, sneakers splashing through puddles. LED signs in Japanese and English flash the brand name "VCTRY" in the background.\n\nThe camera spins around the model in a dramatic 360, freezing mid-rotation as particle effects burst outward.\n\nMood: underground, bold, cultural.\nStyle: Virgil Abloh meets anime aesthetic, hypebeast campaign.`,
  },
];

export function PromptStep({ onSubmit }: PromptStepProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit(value.trim());
    }
  };

  const handleInput = () => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 140) + "px";
    }
  };

  const handlePrefill = (prompt: string) => {
    setValue(prompt);
    const el = inputRef.current;
    if (el) {
      setTimeout(() => {
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 140) + "px";
        el.focus();
      }, 0);
    }
  };

  return (
    <div className="light-page">
      <div className="light-center">
        <h1 className="light-title">gridiron.mp4</h1>
        <p className="light-subtitle">describe your product, brand, or idea</p>

        <div className="light-input-wrap">
          <textarea
            ref={inputRef}
            className="light-input"
            rows={1}
            placeholder="a cinematic ad for..."
            spellCheck={false}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
          />
          <div className="light-input-footer">
            <span className="light-hint">press enter to continue</span>
            {value.trim() && (
              <button
                className="light-continue-btn"
                onClick={() => onSubmit(value.trim())}
              >
                Continue
                <span className="light-continue-arrow">→</span>
              </button>
            )}
          </div>
        </div>

        <div className="light-prefills">
          {PREFILLS.map((p) => (
            <button
              key={p.label}
              className="light-prefill-chip"
              onClick={() => handlePrefill(p.prompt)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="light-brand">
        <span className="light-brand-name">gridiron</span>
        <span className="light-brand-sep">/</span>
        <span className="light-brand-tag">odyssey</span>
      </div>
    </div>
  );
}

/* ---- Step 2: Campaign Picker ---- */

interface CampaignStepProps {
  userPrompt: string;
  onSelect: (campaignType: string) => void;
  onBack: () => void;
}

export function CampaignStep({ userPrompt, onSelect, onBack }: CampaignStepProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCategoryClick = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="light-page">
      <div className="light-campaign-wrap">
        <button className="light-back" onClick={onBack}>
          <span>←</span> back
        </button>

        <div className="light-campaign-header">
          <h1 className="light-title">choose your campaign style</h1>
          <p className="light-prompt-preview">
            <span className="light-prompt-preview-label">your prompt:</span>{" "}
            {userPrompt}
          </p>
        </div>

        <div className="light-campaign-grid">
          {CAMPAIGNS.map((campaign, i) => {
            const isExpanded = expandedId === campaign.id;
            return (
              <div
                key={campaign.id}
                className={`light-card ${isExpanded ? "expanded" : ""}`}
                style={{ animationDelay: `${0.08 + i * 0.06}s` }}
              >
                <button
                  className="light-card-header"
                  onClick={() => handleCategoryClick(campaign.id)}
                >
                  <span className="light-card-icon">{campaign.icon}</span>
                  <div className="light-card-text">
                    <span className="light-card-title">{campaign.title}</span>
                    <span className="light-card-subtitle">{campaign.subtitle}</span>
                  </div>
                  <span className={`light-card-chevron ${isExpanded ? "open" : ""}`}>
                    ›
                  </span>
                </button>

                <div className={`light-card-body ${isExpanded ? "visible" : ""}`}>
                  <div className="light-card-body-inner">
                    {(["kinetic", "contemplative", "classical"] as const).map(
                      (style) => (
                        <div key={style} className="light-style-row">
                          <span className="light-style-label">{STYLE_META[style].label}</span>
                          <span className="light-style-desc">{STYLE_META[style].desc}</span>
                          <p className="light-style-prompt">{campaign.styles[style]}</p>
                        </div>
                      )
                    )}
                    <button
                      className="light-generate-btn"
                      onClick={() => onSelect(campaign.id)}
                    >
                      Generate Triptych <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="light-brand">
        <span className="light-brand-name">gridiron</span>
        <span className="light-brand-sep">/</span>
        <span className="light-brand-tag">odyssey</span>
      </div>
    </div>
  );
}
