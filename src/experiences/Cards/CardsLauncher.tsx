import { useState } from "react";
import "./Cards.css";
import { PlayingCard } from "./PlayingCard";
import {
  DEFAULT_DECK_SETTINGS,
  CARD_BACK_COLORS,
  type CardsGame,
  type DeckSettings,
  type Suit,
} from "./types";
import { totalCards } from "./deckUtils";

const SUITS: { id: Suit; symbol: string; isRed: boolean }[] = [
  { id: "spades",   symbol: "♠", isRed: false },
  { id: "hearts",   symbol: "♥", isRed: true  },
  { id: "diamonds", symbol: "♦", isRed: true  },
  { id: "clubs",    symbol: "♣", isRed: false },
];

// Dummy card used to preview the card back in the launcher
const PREVIEW_CARD = { suit: "spades" as const, rank: "A" as const, id: "preview" };

interface CardsLauncherProps {
  onLaunch: (game: CardsGame, settings: DeckSettings) => void;
}

export default function CardsLauncher({ onLaunch }: CardsLauncherProps) {
  const [game, setGame] = useState<CardsGame>("no-game");
  const [settings, setSettings] = useState<DeckSettings>(DEFAULT_DECK_SETTINGS);

  const toggleSuit = (suit: Suit) => {
    const active = settings.suits.includes(suit);
    // Must keep at least one suit
    if (active && settings.suits.length === 1) return;
    setSettings((prev) => ({
      ...prev,
      suits: active ? prev.suits.filter((s) => s !== suit) : [...prev.suits, suit],
    }));
  };

  const stepDecks = (delta: number) => {
    setSettings((prev) => ({
      ...prev,
      numDecks: Math.max(1, Math.min(6, prev.numDecks + delta)),
    }));
  };

  const count = totalCards(settings);

  return (
    <div className="cards-launcher">
      {/* Game picker */}
      <div>
        <label className="cards-launcher__label">Select Game:</label>
        <select
          className="cards-launcher__select"
          value={game}
          onChange={(e) => setGame(e.target.value as CardsGame)}
        >
          <option value="no-game">No Game</option>
          <option disabled>── Coming Soon ──</option>
        </select>
      </div>

      <div className="cards-launcher__divider" />

      {/* Options */}
      <div>
        <div className="cards-launcher__section-title">Options:</div>

        {/* Deck count */}
        <div className="cards-launcher__row">
          <span className="cards-launcher__option-label">Number of Decks:</span>
          <div className="cards-launcher__stepper">
            <button
              className="cards-launcher__step-btn"
              onClick={() => stepDecks(-1)}
              disabled={settings.numDecks <= 1}
            >−</button>
            <span className="cards-launcher__step-val">{settings.numDecks}</span>
            <button
              className="cards-launcher__step-btn"
              onClick={() => stepDecks(1)}
              disabled={settings.numDecks >= 6}
            >+</button>
          </div>
        </div>

        {/* Suits */}
        <div className="cards-launcher__row">
          <span className="cards-launcher__option-label">Suits:</span>
          <div className="cards-launcher__suits">
            {SUITS.map((s) => (
              <button
                key={s.id}
                className={[
                  "cards-launcher__suit-btn",
                  s.isRed ? "cards-launcher__suit-btn--red" : "cards-launcher__suit-btn--black",
                  settings.suits.includes(s.id) ? "cards-launcher__suit-btn--on" : "",
                ].join(" ")}
                title={s.id}
                onClick={() => toggleSuit(s.id)}
              >
                {s.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Jokers */}
        <div className="cards-launcher__row">
          <span className="cards-launcher__option-label">Include Jokers:</span>
          <label className="cards-launcher__checkbox-wrap">
            <input
              type="checkbox"
              checked={settings.includeJokers}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, includeJokers: e.target.checked }))
              }
            />
            <span className="cards-launcher__checkbox-text">
              {settings.includeJokers ? "Yes" : "No"}
            </span>
          </label>
        </div>

        {/* Card back color */}
        <div className="cards-launcher__row" style={{ alignItems: "flex-start" }}>
          <span className="cards-launcher__option-label" style={{ paddingTop: 4 }}>
            Card Back:
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="cards-launcher__swatches">
              {CARD_BACK_COLORS.map((cb) => (
                <button
                  key={cb.color}
                  className={[
                    "cards-launcher__swatch",
                    settings.cardBack === cb.color ? "cards-launcher__swatch--selected" : "",
                  ].join(" ")}
                  style={{ background: cb.color }}
                  title={cb.label}
                  onClick={() => setSettings((prev) => ({ ...prev, cardBack: cb.color }))}
                />
              ))}
            </div>
            {/* Live preview */}
            <PlayingCard card={PREVIEW_CARD} faceDown backColor={settings.cardBack} />
          </div>
        </div>

        <div className="cards-launcher__count">{count} card{count !== 1 ? "s" : ""} total</div>
      </div>

      <div className="cards-launcher__divider" />

      <button
        className="cards-launcher__launch-btn"
        onClick={() => onLaunch(game, settings)}
      >
        ▶ Launch
      </button>
    </div>
  );
}
