import { useState, useCallback } from "react";
import "./Cards.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, DeckSettings } from "./types";
import { buildDeck, totalCards } from "./deckUtils";

const SUIT_SYMBOL: Record<string, string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};

interface NoGameProps {
  settings: DeckSettings;
}

export default function NoGame({ settings }: NoGameProps) {
  const [drawPile, setDrawPile] = useState<Card[]>(() => buildDeck(settings));
  const [current, setCurrent] = useState<Card | null>(null);
  const [drawCount, setDrawCount] = useState(0);

  const draw = useCallback(() => {
    setDrawPile((prev) => {
      if (prev.length === 0) return prev;
      const [top, ...rest] = prev;
      setCurrent(top);
      setDrawCount((n) => n + 1);
      return rest;
    });
  }, []);

  const reshuffle = useCallback(() => {
    setDrawPile(buildDeck(settings));
    setCurrent(null);
    setDrawCount(0);
  }, [settings]);

  const remaining = drawPile.length;
  const total = totalCards(settings);
  const isEmpty = remaining === 0;
  const isLow = !isEmpty && remaining / total <= 0.15;

  const suitSummary = settings.suits.map((s) => SUIT_SYMBOL[s]).join("");
  const jokerSuffix = settings.includeJokers ? " · Jokers" : "";
  const deckLabel = `${settings.numDecks} deck${settings.numDecks > 1 ? "s" : ""} · ${suitSummary}${jokerSuffix}`;

  return (
    <div className="no-game">
      <div className="no-game__info">{deckLabel}</div>

      <div className="no-game__table">
        {/* Draw pile */}
        <div className="no-game__pile">
          <div className="no-game__pile-label">Draw Pile</div>
          {isEmpty
            ? <div className="playing-card--empty" />
            : <PlayingCard card={drawPile[0]} faceDown backColor={settings.cardBack} />
          }
          <div className={`no-game__pile-count${isLow ? " no-game__pile-count--low" : ""}`}>
            {remaining} left
          </div>
        </div>

        <div className="no-game__arrow">→</div>

        {/* Last drawn card */}
        <div className="no-game__pile">
          <div className="no-game__pile-label">Last Drawn</div>
          {current
            ? <PlayingCard card={current} />
            : <div className="playing-card--empty" />
          }
          <div className="no-game__pile-count">{drawCount} drawn</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {isEmpty && <div className="no-game__empty-msg">Deck is empty!</div>}
        {isEmpty
          ? (
            <button className="no-game__btn no-game__btn--reshuffle" onClick={reshuffle}>
              ↺ Reshuffle
            </button>
          ) : (
            <button className="no-game__btn no-game__btn--draw" onClick={draw}>
              ▶ Draw Card
            </button>
          )
        }
      </div>
    </div>
  );
}
