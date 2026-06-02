import { useState, useRef } from "react";
import type { CardAppearance, BackPattern, CardFaceStyle, CardTextSize, SuitColorMode } from "./types";
import { PlayingCard } from "./PlayingCard";
import "./DeckModal.css";

const PREVIEW_CARD_SPADE = { suit: "spades" as const, rank: "A" as const, id: "deck-preview-s" };
const PREVIEW_CARD_HEART = { suit: "hearts" as const, rank: "K" as const, id: "deck-preview-h" };
const PREVIEW_CARD_DIAMOND = { suit: "diamonds" as const, rank: "Q" as const, id: "deck-preview-d" };
const PREVIEW_CARD_CLUB = { suit: "clubs" as const, rank: "J" as const, id: "deck-preview-c" };

const PRIMARY_PRESETS = [
  { label: "Orange", color: "#cc4400" },
  { label: "Red",    color: "#8a1a1a" },
  { label: "Navy",   color: "#1a4a8a" },
  { label: "Forest", color: "#1a5c2a" },
  { label: "Purple", color: "#5b2d8e" },
  { label: "Black",  color: "#1a1a1a" },
];

const SECONDARY_PRESETS = [
  { label: "White",      color: "#ffffff" },
  { label: "Cream",      color: "#f0e8d0" },
  { label: "Yellow",     color: "#ffcc00" },
  { label: "Gold",       color: "#ff8833" },
  { label: "Light gray", color: "#d4d0c8" },
  { label: "Black",      color: "#000000" },
];

const PATTERNS: { value: BackPattern; label: string }[] = [
  { value: "crosshatch", label: "Crosshatch" },
  { value: "diagonal",   label: "Diagonal" },
  { value: "diamonds",   label: "Diamonds" },
  { value: "noahsoft",   label: "Noahsoft" },
];

const FACE_STYLES: { value: CardFaceStyle; label: string }[] = [
  { value: "classic",     label: "Classic" },
  { value: "minimal",     label: "Minimal" },
  { value: "large-index", label: "Large Idx" },
];

interface DeckModalProps {
  appearance: CardAppearance;
  onUpdate: (appearance: CardAppearance) => void;
  onClose: () => void;
}

export function DeckModal({ appearance, onUpdate, onClose }: DeckModalProps) {
  const [tab, setTab] = useState<"back" | "face">("back");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const primaryColorRef = useRef<HTMLInputElement>(null);
  const secondaryColorRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<CardAppearance>) => onUpdate({ ...appearance, ...patch });

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      set({ backImageUrl: (ev.target?.result as string) ?? null });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="deck-modal-overlay" onClick={onClose}>
      <div className="deck-modal" onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div className="deck-modal__titlebar">
          <span>Card Appearance</span>
          <button className="deck-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className="deck-modal__tabs">
          <button
            className={`deck-modal__tab${tab === "back" ? " deck-modal__tab--active" : ""}`}
            onClick={() => setTab("back")}
          >Back</button>
          <button
            className={`deck-modal__tab${tab === "face" ? " deck-modal__tab--active" : ""}`}
            onClick={() => setTab("face")}
          >Face</button>
        </div>

        <div className="deck-modal__body">
          {tab === "back" && (
            <>
              {/* Pattern picker */}
              <div className="deck-modal__section-label">Pattern:</div>
              <div className="deck-modal__patterns">
                {PATTERNS.map((p) => (
                  <button
                    key={p.value}
                    className={`deck-modal__pattern-btn${appearance.backPattern === p.value ? " deck-modal__pattern-btn--active" : ""}`}
                    onClick={() => set({ backPattern: p.value })}
                    title={p.label}
                  >
                    <div
                      className="deck-modal__pattern-thumb"
                      data-pattern={p.value}
                      style={{
                        "--cbp": appearance.backPrimaryColor,
                        "--cbs": appearance.backSecondaryColor + "55",
                      } as React.CSSProperties}
                    >
                      <div className="deck-modal__pattern-thumb-inner" />
                      {p.value === "noahsoft" && <span className="deck-modal__pattern-ns">NS</span>}
                    </div>
                    <span className="deck-modal__pattern-label">{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Primary color */}
              <div className="deck-modal__section-label">Back Color:</div>
              <div className="deck-modal__color-row">
                {PRIMARY_PRESETS.map((c) => (
                  <button
                    key={c.color}
                    className={`deck-modal__swatch${appearance.backPrimaryColor === c.color ? " deck-modal__swatch--selected" : ""}`}
                    style={{ background: c.color }}
                    title={c.label}
                    onClick={() => set({ backPrimaryColor: c.color })}
                  />
                ))}
                <button
                  className="deck-modal__custom-btn"
                  onClick={() => primaryColorRef.current?.click()}
                >⋯</button>
                <input
                  ref={primaryColorRef}
                  type="color"
                  value={appearance.backPrimaryColor}
                  onChange={(e) => set({ backPrimaryColor: e.target.value })}
                  className="deck-modal__hidden-color"
                />
              </div>

              {/* Secondary color */}
              <div className="deck-modal__section-label">Pattern Color:</div>
              <div className="deck-modal__color-row">
                {SECONDARY_PRESETS.map((c) => (
                  <button
                    key={c.color}
                    className={`deck-modal__swatch${appearance.backSecondaryColor === c.color ? " deck-modal__swatch--selected" : ""}`}
                    style={{ background: c.color, border: c.color === "#ffffff" ? "2px solid #808080" : undefined }}
                    title={c.label}
                    onClick={() => set({ backSecondaryColor: c.color })}
                  />
                ))}
                <button
                  className="deck-modal__custom-btn"
                  onClick={() => secondaryColorRef.current?.click()}
                >⋯</button>
                <input
                  ref={secondaryColorRef}
                  type="color"
                  value={appearance.backSecondaryColor}
                  onChange={(e) => set({ backSecondaryColor: e.target.value })}
                  className="deck-modal__hidden-color"
                />
              </div>

              {/* Custom image */}
              <div className="deck-modal__section-label">Custom Back:</div>
              <div className="deck-modal__image-row">
                <button
                  className="deck-modal__img-btn"
                  onClick={() => fileInputRef.current?.click()}
                >Browse…</button>
                {appearance.backImageUrl && (
                  <button
                    className="deck-modal__img-btn deck-modal__img-btn--clear"
                    onClick={() => set({ backImageUrl: null })}
                  >Clear</button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="deck-modal__hidden-color"
                />
                {appearance.backImageUrl && (
                  <span className="deck-modal__img-name">image set ✓</span>
                )}
              </div>
            </>
          )}

          {tab === "face" && (
            <>
              {/* Face style */}
              <div className="deck-modal__section-label">Card Face:</div>
              <div className="deck-modal__face-styles">
                {FACE_STYLES.map((fs) => (
                  <button
                    key={fs.value}
                    className={`deck-modal__face-btn${appearance.cardFaceStyle === fs.value ? " deck-modal__face-btn--active" : ""}`}
                    onClick={() => set({ cardFaceStyle: fs.value })}
                  >
                    <div className="deck-modal__face-preview">
                      <PlayingCard
                        card={PREVIEW_CARD_SPADE}
                        size="sm"
                        appearance={{ ...appearance, cardFaceStyle: fs.value }}
                      />
                    </div>
                    <span className="deck-modal__pattern-label">{fs.label}</span>
                  </button>
                ))}
              </div>

              {/* Card text size */}
              <div className="deck-modal__section-label">Text Size:</div>
              <div className="deck-modal__text-sizes">
                {(["normal", "large", "xl"] as CardTextSize[]).map((sz) => (
                  <button
                    key={sz}
                    className={`deck-modal__size-btn${(appearance.cardTextSize ?? "normal") === sz ? " deck-modal__size-btn--active" : ""}`}
                    onClick={() => set({ cardTextSize: sz })}
                  >
                    <span style={{ fontSize: sz === "normal" ? 7 : sz === "large" ? 9 : 11 }}>
                      {sz === "normal" ? "Aa" : sz === "large" ? "Aa" : "Aa"}
                    </span>
                    <span className="deck-modal__size-label">
                      {sz === "normal" ? "Normal" : sz === "large" ? "Large" : "XL"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Suit color mode */}
              <div className="deck-modal__section-label">Suit Colors:</div>
              <div className="deck-modal__suit-modes">
                {(["standard", "four-color", "high-contrast"] as SuitColorMode[]).map((mode) => (
                  <label key={mode} className="deck-modal__suit-mode-option">
                    <input
                      type="radio"
                      name="suitColorMode"
                      value={mode}
                      checked={(appearance.suitColorMode ?? "standard") === mode}
                      onChange={() => set({ suitColorMode: mode })}
                      className="deck-modal__radio"
                    />
                    <span className="deck-modal__check-label">
                      {mode === "standard" ? "Standard" : mode === "four-color" ? "Four-Color" : "High Contrast"}
                    </span>
                  </label>
                ))}
              </div>
              {(appearance.suitColorMode ?? "standard") !== "standard" && (
                <div className="deck-modal__four-color-preview">
                  <PlayingCard card={PREVIEW_CARD_SPADE}   size="sm" appearance={appearance} />
                  <PlayingCard card={PREVIEW_CARD_HEART}   size="sm" appearance={appearance} />
                  <PlayingCard card={PREVIEW_CARD_DIAMOND} size="sm" appearance={appearance} />
                  <PlayingCard card={PREVIEW_CARD_CLUB}    size="sm" appearance={appearance} />
                </div>
              )}
            </>
          )}

          {/* Back preview */}
          <div className="deck-modal__preview-row">
            <PlayingCard card={PREVIEW_CARD_SPADE} faceDown appearance={appearance} />
            <PlayingCard card={PREVIEW_CARD_SPADE} appearance={appearance} />
          </div>
        </div>

        <div className="deck-modal__footer">
          <button className="deck-modal__ok" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
