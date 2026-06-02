import { useState, useMemo } from "react";
import "./Cards.css";
import {
  DEFAULT_DECK_SETTINGS,
  type CardsGame,
  type DeckSettings,
  type MemoryDifficulty,
  type Suit,
  type WarSpeed,
} from "./types";
import { totalCards } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

const SUITS: { id: Suit; symbol: string; isRed: boolean }[] = [
  { id: "spades",   symbol: "♠", isRed: false },
  { id: "hearts",   symbol: "♥", isRed: true  },
  { id: "diamonds", symbol: "♦", isRed: true  },
  { id: "clubs",    symbol: "♣", isRed: false },
];

const WAR_SPEEDS: { value: WarSpeed; label: string }[] = [
  { value: "slow",   label: "Slow (2s)"    },
  { value: "normal", label: "Normal (0.9s)" },
  { value: "fast",   label: "Fast (0.25s)" },
];

const MEMORY_DIFFICULTIES: { value: MemoryDifficulty; label: string }[] = [
  { value: "easy",   label: "Easy (4×4)"  },
  { value: "medium", label: "Medium (4×6)" },
  { value: "hard",   label: "Hard (6×6)"  },
];

interface CardsLauncherProps {
  onLaunch: (game: CardsGame, settings: DeckSettings) => void;
  onQuit?: () => void;
}

export default function CardsLauncher({ onLaunch, onQuit }: CardsLauncherProps) {
  const [game, setGame] = useState<CardsGame>("war");
  const [settings, setSettings] = useState<DeckSettings>(DEFAULT_DECK_SETTINGS);
  const [showDeckModal, setShowDeckModal] = useState(false);

  const toggleSuit = (suit: Suit) => {
    const active = settings.suits.includes(suit);
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

  const launcherMenus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "Game",
      items: [
        ...(onQuit ? [{ label: "Exit", onClick: onQuit }] : [{ label: "(not implemented)", disabled: true as const }]),
      ],
    },
    {
      label: "Options",
      items: [{ label: "Deck…", onClick: () => setShowDeckModal(true) }],
    },
  ], [onQuit]);

  useWindowMenus(launcherMenus);

  const showDeckCount = game === "blackjack";
  const showSuits     = game === "war";
  const showOptions   = showDeckCount || showSuits;
  const showWarOpts   = game === "war";
  const showMemOpts   = game === "memory";
  const showKlonOpts  = game === "klondike";

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
          <option value="war">War</option>
          <option value="blackjack">Blackjack</option>
          <option value="pyramid">Pyramid Solitaire</option>
          <option value="memory">Memory</option>
          <option value="klondike">Klondike Solitaire</option>
          <option value="freecell">FreeCell</option>
          <option value="hearts">Hearts</option>
        </select>
      </div>

      {/* Deck options (War suits, Blackjack deck count) */}
      {showOptions && (
        <>
          <div className="cards-launcher__divider" />
          <div>
            <div className="cards-launcher__section-title">Options:</div>

            {showDeckCount && (
              <div className="cards-launcher__row">
                <span className="cards-launcher__option-label">Number of Decks:</span>
                <div className="cards-launcher__stepper">
                  <button className="cards-launcher__step-btn" onClick={() => stepDecks(-1)} disabled={settings.numDecks <= 1}>−</button>
                  <span className="cards-launcher__step-val">{settings.numDecks}</span>
                  <button className="cards-launcher__step-btn" onClick={() => stepDecks(1)}  disabled={settings.numDecks >= 6}>+</button>
                </div>
              </div>
            )}

            {showSuits && (
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
            )}

            <div className="cards-launcher__count">{count} card{count !== 1 ? "s" : ""} total</div>
          </div>
        </>
      )}

      {/* War settings */}
      {showWarOpts && (
        <>
          <div className="cards-launcher__divider" />
          <div>
            <div className="cards-launcher__section-title">War Settings:</div>

            <div className="cards-launcher__row">
              <span className="cards-launcher__option-label">Auto-play:</span>
              <label className="cards-launcher__checkbox-wrap">
                <input
                  type="checkbox"
                  className="cards-launcher__checkbox"
                  checked={settings.warAutoPlay}
                  onChange={(e) => setSettings((prev) => ({ ...prev, warAutoPlay: e.target.checked }))}
                />
                <span className="cards-launcher__checkbox-text">{settings.warAutoPlay ? "On" : "Off"}</span>
              </label>
            </div>

            {settings.warAutoPlay && (
              <div className="cards-launcher__row">
                <span className="cards-launcher__option-label">Speed:</span>
                <select
                  className="cards-launcher__select"
                  style={{ width: "auto" }}
                  value={settings.warSpeed}
                  onChange={(e) => setSettings((prev) => ({ ...prev, warSpeed: e.target.value as WarSpeed }))}
                >
                  {WAR_SPEEDS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}

      {/* Memory difficulty */}
      {showMemOpts && (
        <>
          <div className="cards-launcher__divider" />
          <div>
            <div className="cards-launcher__section-title">Memory Options:</div>
            <div className="cards-launcher__row">
              <span className="cards-launcher__option-label">Difficulty:</span>
              <select
                className="cards-launcher__select"
                style={{ width: "auto" }}
                value={settings.memoryDifficulty}
                onChange={(e) => setSettings((prev) => ({ ...prev, memoryDifficulty: e.target.value as MemoryDifficulty }))}
              >
                {MEMORY_DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {/* Klondike draw mode */}
      {showKlonOpts && (
        <>
          <div className="cards-launcher__divider" />
          <div>
            <div className="cards-launcher__section-title">Klondike Options:</div>
            <div className="cards-launcher__row">
              <span className="cards-launcher__option-label">Draw:</span>
              <select
                className="cards-launcher__select"
                style={{ width: "auto" }}
                value={settings.klondikeDraw}
                onChange={(e) => setSettings((prev) => ({ ...prev, klondikeDraw: parseInt(e.target.value) as 1 | 3 }))}
              >
                <option value={1}>Draw 1</option>
                <option value={3}>Draw 3</option>
              </select>
            </div>
            <div className="cards-launcher__row">
              <span className="cards-launcher__option-label">Relaxed Rules:</span>
              <label className="cards-launcher__checkbox-wrap">
                <input
                  type="checkbox"
                  className="cards-launcher__checkbox"
                  checked={settings.klondikeRelaxed}
                  onChange={(e) => setSettings((prev) => ({ ...prev, klondikeRelaxed: e.target.checked }))}
                />
                <span className="cards-launcher__checkbox-text">{settings.klondikeRelaxed ? "On" : "Off"}</span>
              </label>
            </div>
            {settings.klondikeRelaxed && (
              <div className="cards-launcher__row">
                <span style={{ fontSize: "6px", color: "#666", lineHeight: 1.4 }}>
                  Any card may be placed on empty columns
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="cards-launcher__divider" />

      <button className="cards-launcher__launch-btn" onClick={() => onLaunch(game, settings)}>
        ▶ Launch
      </button>

      {showDeckModal && (
        <DeckModal
          appearance={settings.appearance}
          onUpdate={(a) => setSettings((prev) => ({ ...prev, appearance: a }))}
          onClose={() => setShowDeckModal(false)}
        />
      )}
    </div>
  );
}
