import "./Cards.css";
import type { Card } from "./types";

const SUIT_SYMBOL: Record<string, string> = {
  spades:   "♠",
  hearts:   "♥",
  diamonds: "♦",
  clubs:    "♣",
};

interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  /** Hex color for the card back. Only used when faceDown is true. */
  backColor?: string;
}

export function PlayingCard({ card, faceDown = false, backColor = "#cc4400" }: PlayingCardProps) {
  if (faceDown) {
    return (
      <div
        className="playing-card playing-card--back"
        style={{ "--card-back": backColor } as React.CSSProperties}
      >
        <div className="playing-card__back-inner" />
      </div>
    );
  }

  if (card.suit === "joker") {
    return (
      <div className="playing-card playing-card--front playing-card--joker">
        <div className="playing-card__corner playing-card__corner--tl">
          <span className="playing-card__rank">★</span>
        </div>
        <div className="playing-card__center" style={{ fontSize: 18, textAlign: "center", lineHeight: 1.4 }}>
          ★<br />JOKER
        </div>
        <div className="playing-card__corner playing-card__corner--br">
          <span className="playing-card__rank">★</span>
        </div>
      </div>
    );
  }

  const symbol = SUIT_SYMBOL[card.suit] ?? "?";
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const colorClass = isRed ? "playing-card--red" : "playing-card--black";

  return (
    <div className={`playing-card playing-card--front ${colorClass}`}>
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
