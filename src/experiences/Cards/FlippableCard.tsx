import "./Cards.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, CardAppearance } from "./types";
import { DEFAULT_APPEARANCE } from "./types";

export interface FlippableCardProps {
  card: Card;
  faceDown: boolean;
  appearance?: CardAppearance;
  size?: "sm";
  dealIndex?: number;
}

/** A card with a CSS 3D flip transition. faceDown=true shows the back; flipping to false animates to the front. */
export function FlippableCard({
  card,
  faceDown,
  appearance = DEFAULT_APPEARANCE,
  size,
  dealIndex,
}: FlippableCardProps) {
  const cw = size === "sm" ? 52 : 72;
  const ch = size === "sm" ? 72 : 100;
  return (
    <div className="flippable" style={{ width: cw, height: ch }}>
      <div className={`flippable__inner${faceDown ? "" : " flippable__inner--face-up"}`}>
        <div className="flippable__face flippable__face--back">
          <PlayingCard card={card} faceDown appearance={appearance} size={size} dealIndex={dealIndex} />
        </div>
        <div className="flippable__face flippable__face--front">
          <PlayingCard card={card} appearance={appearance} size={size} />
        </div>
      </div>
    </div>
  );
}
