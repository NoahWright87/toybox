import "./Cards.css";
import type { Card, CardAppearance, SuitColorMode } from "./types";
import { DEFAULT_APPEARANCE } from "./types";

const SUIT_SYMBOL: Record<string, string> = {
  spades:   "♠",
  hearts:   "♥",
  diamonds: "♦",
  clubs:    "♣",
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function suitColorClass(suit: string, mode: SuitColorMode): string {
  if (mode === "high-contrast") {
    if (suit === "hearts")   return "playing-card--pink";
    if (suit === "diamonds") return "playing-card--orange";
    if (suit === "spades")   return "playing-card--blue";
    if (suit === "clubs")    return "playing-card--green";
  }
  if (mode === "four-color") {
    if (suit === "hearts")   return "playing-card--pink";
    if (suit === "diamonds") return "playing-card--red";
    if (suit === "spades")   return "playing-card--blue";
    if (suit === "clubs")    return "playing-card--green";
  }
  // standard: red for ♥♦, black for ♠♣
  if (suit === "hearts" || suit === "diamonds") return "playing-card--red";
  return "playing-card--black";
}

export interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  appearance?: CardAppearance;
  size?: "sm";
  dealIndex?: number;
}

export function PlayingCard({
  card,
  faceDown = false,
  appearance = DEFAULT_APPEARANCE,
  size,
  dealIndex,
}: PlayingCardProps) {
  const sizeClass = size === "sm" ? " playing-card--sm" : "";
  const dealClass = dealIndex !== undefined ? " playing-card--deal" : "";
  const dealStyle = dealIndex !== undefined
    ? { "--deal-index": dealIndex } as React.CSSProperties
    : {};

  if (faceDown) {
    const backCss: React.CSSProperties = {
      "--cbp": appearance.backPrimaryColor,
      "--cbs": hexToRgba(appearance.backSecondaryColor, 0.35),
      ...(appearance.backImageUrl
        ? { backgroundImage: `url(${appearance.backImageUrl})`, backgroundSize: "cover" }
        : {}),
      ...dealStyle,
    } as React.CSSProperties;

    return (
      <div
        className={`playing-card playing-card--back${sizeClass}${dealClass}`}
        data-pattern={appearance.backImageUrl ? undefined : appearance.backPattern}
        style={backCss}
      >
        {!appearance.backImageUrl && (
          <div className="playing-card__back-inner">
            {appearance.backPattern === "noahsoft" && (
              <span className="playing-card__back-ns">NS</span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (card.suit === "joker") {
    return (
      <div
        className={`playing-card playing-card--front playing-card--joker${sizeClass}${dealClass}`}
        style={dealStyle}
      >
        <div className="playing-card__corner playing-card__corner--tl">
          <span className="playing-card__rank">★</span>
        </div>
        <div
          className="playing-card__center"
          style={{ fontSize: size === "sm" ? 13 : 18, textAlign: "center", lineHeight: 1.4 }}
        >
          ★<br />JOKER
        </div>
        <div className="playing-card__corner playing-card__corner--br">
          <span className="playing-card__rank">★</span>
        </div>
      </div>
    );
  }

  const symbol = SUIT_SYMBOL[card.suit] ?? "?";
  const colorClass = suitColorClass(card.suit, appearance.suitColorMode ?? "standard");
  const faceStyle = appearance.cardFaceStyle ?? "classic";

  if (faceStyle === "minimal") {
    return (
      <div
        className={`playing-card playing-card--front ${colorClass}${sizeClass}${dealClass}`}
        style={dealStyle}
      >
        <div className="playing-card__corner playing-card__corner--tl">
          <span className="playing-card__rank">{card.rank}</span>
          <span className="playing-card__suit-pip">{symbol}</span>
        </div>
        <div className="playing-card__corner playing-card__corner--br">
          <span className="playing-card__rank">{card.rank}</span>
          <span className="playing-card__suit-pip">{symbol}</span>
        </div>
      </div>
    );
  }

  if (faceStyle === "large-index") {
    return (
      <div
        className={`playing-card playing-card--front playing-card--large-idx ${colorClass}${sizeClass}${dealClass}`}
        style={dealStyle}
      >
        <div className="playing-card__large-rank">{card.rank}</div>
        <div className="playing-card__corner playing-card__corner--br">
          <span className="playing-card__suit-pip">{symbol}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`playing-card playing-card--front ${colorClass}${sizeClass}${dealClass}`}
      style={dealStyle}
    >
      <div className="playing-card__corner playing-card__corner--tl">
        <span className="playing-card__rank">{card.rank}</span>
        <span className="playing-card__suit-pip">{symbol}</span>
      </div>
      <div className="playing-card__center">{symbol}</div>
      <div className="playing-card__corner playing-card__corner--br">
        <span className="playing-card__rank">{card.rank}</span>
        <span className="playing-card__suit-pip">{symbol}</span>
      </div>
    </div>
  );
}
