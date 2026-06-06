import React from "react";
import "./Cards.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, CardAppearance } from "./types";
import type { CardVisualState } from "./cardStack";

interface PermCardProps {
  card: Card;
  cs: CardVisualState;
  appearance: CardAppearance;
  size?: "sm";
  highlightColor?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * A permanently-mounted absolutely-positioned card.
 * All animation is driven by changes to `cs` — CSS transitions fire automatically
 * because the element always has a prior position in the DOM.
 */
export function PermCard({ card, cs, appearance, size, highlightColor, onClick, onDoubleClick, onPointerDown }: PermCardProps) {
  const cw = size === "sm" ? 52 : 72;
  const ch = size === "sm" ? 72 : 100;
  const delay = cs.transitionDelay ?? 0;
  const posTrans = cs.transitionMs > 0
    ? `left ${cs.transitionMs}ms ease-in-out ${delay}ms, top ${cs.transitionMs}ms ease-in-out ${delay}ms`
    : undefined;

  return (
    <div
      style={{
        position:    "absolute",
        left:        cs.x - cw / 2,
        top:         cs.y - ch / 2,
        width:       cw,
        height:      ch,
        zIndex:      cs.z,
        transition:  posTrans,
        cursor:      onPointerDown || onClick ? "pointer" : "default",
        touchAction: onPointerDown ? "none" : undefined,
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
    >
      <div
        style={{
          width:           "100%",
          height:          "100%",
          transform:       `rotate(${cs.rotation}deg)`,
          transformOrigin: "center",
          transition:      "transform 250ms ease-out",
          borderRadius:    "4px",
          boxShadow:       highlightColor ? `0 0 0 2px ${highlightColor}, 0 0 6px 1px ${highlightColor}` : undefined,
        }}
      >
        <div className="flippable" style={{ width: cw, height: ch }}>
          <div className={`flippable__inner${cs.faceDown ? "" : " flippable__inner--face-up"}`}>
            <div className="flippable__face">
              <PlayingCard card={card} faceDown appearance={appearance} size={size} />
            </div>
            <div className="flippable__face flippable__face--front">
              <PlayingCard card={card} appearance={appearance} size={size} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
