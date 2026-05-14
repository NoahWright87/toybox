import { CARD_BACK_COLORS } from "./types";
import { PlayingCard } from "./PlayingCard";
import "./DeckModal.css";

const PREVIEW_CARD = { suit: "spades" as const, rank: "A" as const, id: "deck-preview" };

interface DeckModalProps {
  cardBack: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}

export function DeckModal({ cardBack, onSelect, onClose }: DeckModalProps) {
  return (
    <div className="deck-modal-overlay" onClick={onClose}>
      <div className="deck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deck-modal__titlebar">
          <span>Card Appearance</span>
          <button className="deck-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="deck-modal__body">
          <div className="deck-modal__swatches">
            {CARD_BACK_COLORS.map((cb) => (
              <button
                key={cb.color}
                className={`deck-modal__swatch${cardBack === cb.color ? " deck-modal__swatch--selected" : ""}`}
                style={{ background: cb.color }}
                title={cb.label}
                onClick={() => onSelect(cb.color)}
              />
            ))}
          </div>
          <PlayingCard card={PREVIEW_CARD} faceDown backColor={cardBack} />
        </div>
        <div className="deck-modal__footer">
          <button className="deck-modal__ok" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
