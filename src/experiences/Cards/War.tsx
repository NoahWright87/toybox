import { useState, useCallback, useEffect } from "react";
import "./Cards.css";
import "./War.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, DeckSettings } from "./types";
import { buildDeck, shuffle } from "./deckUtils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const RANK_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;

function warValue(card: Card): number {
  if (card.rank === "Joker") return -1;
  return RANK_ORDER.indexOf(card.rank as typeof RANK_ORDER[number]);
}

const WAR_SPEED_MS: Record<string, number> = {
  slow: 2000,
  normal: 900,
  fast: 250,
};
const GAME_OVER_DELAY_MS = 2500;

// ── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "ready"       // waiting to flip
  | "revealed"    // cards flipped, showing result
  | "war-ready"   // tie — waiting to place war cards
  | "war-revealed"// war cards flipped
  | "game-over";

interface WarState {
  playerPile: Card[];
  dealerPile: Card[];
  playerCard: Card | null;
  dealerCard: Card | null;
  warPlayerCards: Card[];  // face-down war cards
  warDealerCards: Card[];
  warPlayerFinal: Card | null;
  warDealerFinal: Card | null;
  phase: Phase;
  roundResult: "player" | "dealer" | "war" | null;
  gameResult: "player" | "dealer" | null;
  roundCount: number;
}

function makeInitialState(settings: DeckSettings): WarState {
  const deck = buildDeck(settings);
  const mid = Math.floor(deck.length / 2);
  return {
    playerPile: deck.slice(0, mid),
    dealerPile: deck.slice(mid),
    playerCard: null,
    dealerCard: null,
    warPlayerCards: [],
    warDealerCards: [],
    warPlayerFinal: null,
    warDealerFinal: null,
    phase: "ready",
    roundResult: null,
    gameResult: null,
    roundCount: 0,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

interface WarProps {
  settings: DeckSettings;
}

export default function War({ settings }: WarProps) {
  const [state, setState] = useState<WarState>(() => makeInitialState(settings));

  const autoPlay = settings.warAutoPlay;
  const speedMs = WAR_SPEED_MS[settings.warSpeed] ?? 900;

  // ── Core actions ──────────────────────────────────────────────────────────

  const flip = useCallback(() => {
    setState((s) => {
      if (s.phase !== "ready") return s;
      if (s.playerPile.length === 0 || s.dealerPile.length === 0) return s;

      const [pc, ...pRest] = s.playerPile;
      const [dc, ...dRest] = s.dealerPile;
      const pv = warValue(pc);
      const dv = warValue(dc);

      const roundResult: "player" | "dealer" | "war" =
        pv > dv ? "player" : pv < dv ? "dealer" : "war";

      let playerPile = pRest;
      let dealerPile = dRest;

      if (roundResult === "player") {
        playerPile = [...pRest, ...shuffle([pc, dc])];
      } else if (roundResult === "dealer") {
        dealerPile = [...dRest, ...shuffle([pc, dc])];
      }
      // war: cards go to warCards, resolved after war

      return {
        ...s,
        playerPile,
        dealerPile,
        playerCard: pc,
        dealerCard: dc,
        roundResult,
        phase: "revealed",
        roundCount: s.roundCount + 1,
      };
    });
  }, []);

  const resolveRevealed = useCallback(() => {
    setState((s) => {
      if (s.phase !== "revealed") return s;

      if (s.roundResult === "war") {
        // Check if both players have cards for war (need at least 1 for face-up)
        if (s.playerPile.length === 0) {
          return { ...s, phase: "game-over", gameResult: "dealer" };
        }
        if (s.dealerPile.length === 0) {
          return { ...s, phase: "game-over", gameResult: "player" };
        }
        return { ...s, phase: "war-ready" };
      }

      // Check game over
      if (s.playerPile.length === 0) {
        return { ...s, phase: "game-over", gameResult: "dealer" };
      }
      if (s.dealerPile.length === 0) {
        return { ...s, phase: "game-over", gameResult: "player" };
      }

      return { ...s, phase: "ready", playerCard: null, dealerCard: null };
    });
  }, []);

  const flipWar = useCallback(() => {
    setState((s) => {
      if (s.phase !== "war-ready") return s;

      // Each player puts up to 3 face-down + 1 face-up
      const pSlice = s.playerPile.length;
      const dSlice = s.dealerPile.length;

      const pFaceDownCount = Math.min(3, pSlice - 1);
      const dFaceDownCount = Math.min(3, dSlice - 1);

      const pFaceDown = s.playerPile.slice(0, pFaceDownCount);
      const pFaceUp   = s.playerPile[pFaceDownCount] ?? null;
      const pRemain   = s.playerPile.slice(pFaceDownCount + 1);

      const dFaceDown = s.dealerPile.slice(0, dFaceDownCount);
      const dFaceUp   = s.dealerPile[dFaceDownCount] ?? null;
      const dRemain   = s.dealerPile.slice(dFaceDownCount + 1);

      // All battle cards: original face-up + war face-down + war face-up
      const allBattleCards = [
        s.playerCard!, s.dealerCard!,
        ...pFaceDown, ...dFaceDown,
      ];

      let playerPile = pRemain;
      let dealerPile = dRemain;
      let roundResult: "player" | "dealer" | "war" = "war";

      if (!pFaceUp) {
        roundResult = "dealer";
        dealerPile = [...dRemain, ...shuffle([...allBattleCards, ...dFaceDown])];
      } else if (!dFaceUp) {
        roundResult = "player";
        playerPile = [...pRemain, ...shuffle([...allBattleCards, ...pFaceDown])];
      } else {
        const pv = warValue(pFaceUp);
        const dv = warValue(dFaceUp);
        roundResult = pv > dv ? "player" : pv < dv ? "dealer" : "war";
        const spoils = shuffle([...allBattleCards, pFaceUp, dFaceUp]);
        if (roundResult === "player") playerPile = [...pRemain, ...spoils];
        else if (roundResult === "dealer") dealerPile = [...dRemain, ...spoils];
        // war again: cards stay off table until next war resolution
      }

      return {
        ...s,
        playerPile,
        dealerPile,
        warPlayerCards: pFaceDown,
        warDealerCards: dFaceDown,
        warPlayerFinal: pFaceUp,
        warDealerFinal: dFaceUp,
        roundResult,
        phase: "war-revealed",
        roundCount: s.roundCount + 1,
      };
    });
  }, []);

  const resolveWarRevealed = useCallback(() => {
    setState((s) => {
      if (s.phase !== "war-revealed") return s;

      if (s.roundResult === "war") {
        if (s.playerPile.length === 0) return { ...s, phase: "game-over", gameResult: "dealer" };
        if (s.dealerPile.length === 0) return { ...s, phase: "game-over", gameResult: "player" };
        return { ...s, phase: "war-ready" };
      }
      if (s.playerPile.length === 0) return { ...s, phase: "game-over", gameResult: "dealer" };
      if (s.dealerPile.length === 0) return { ...s, phase: "game-over", gameResult: "player" };

      return {
        ...s,
        phase: "ready",
        playerCard: null,
        dealerCard: null,
        warPlayerCards: [],
        warDealerCards: [],
        warPlayerFinal: null,
        warDealerFinal: null,
        roundResult: null,
      };
    });
  }, []);

  const newGame = useCallback(() => {
    setState(makeInitialState(settings));
  }, [settings]);

  // ── Auto-play ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoPlay) return;

    const advance = () => {
      setState((s) => {
        switch (s.phase) {
          case "ready":       { flip(); return s; }
          case "revealed":    { resolveRevealed(); return s; }
          case "war-ready":   { flipWar(); return s; }
          case "war-revealed":{ resolveWarRevealed(); return s; }
          default: return s;
        }
      });
    };

    // For game-over, use a longer fixed delay then restart
    if (state.phase === "game-over") {
      const t = setTimeout(newGame, GAME_OVER_DELAY_MS);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      if (state.phase === "ready") flip();
      else if (state.phase === "revealed") resolveRevealed();
      else if (state.phase === "war-ready") flipWar();
      else if (state.phase === "war-revealed") resolveWarRevealed();
    }, speedMs);

    return () => { clearTimeout(t); void advance; };
  }, [autoPlay, speedMs, state.phase, flip, resolveRevealed, flipWar, resolveWarRevealed, newGame]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const { phase, playerCard, dealerCard, playerPile, dealerPile,
          warPlayerCards, warDealerCards, warPlayerFinal, warDealerFinal,
          roundResult, gameResult, roundCount } = state;

  const isWar = phase === "war-ready" || phase === "war-revealed";

  function resultBanner(): string {
    if (phase === "revealed" || phase === "war-revealed") {
      if (roundResult === "player") return "You win the round!";
      if (roundResult === "dealer") return "Dealer wins the round.";
      if (roundResult === "war") return "WAR!";
    }
    if (phase === "game-over") {
      if (gameResult === "player") return "🏆 YOU WIN!";
      return "Dealer wins.";
    }
    return "";
  }

  function cardCount(pile: Card[], extra?: (Card | null)[]): number {
    return pile.length + (extra ?? []).filter(Boolean).length;
  }

  return (
    <div className="war">
      {/* Scoreboard */}
      <div className="war__scoreboard">
        <span>Round {roundCount}</span>
        <span>You: {cardCount(playerPile, [playerCard, warPlayerFinal, ...warPlayerCards])} cards</span>
        <span>Dealer: {cardCount(dealerPile, [dealerCard, warDealerFinal, ...warDealerCards])} cards</span>
      </div>

      {/* Battle area */}
      <div className="war__table">
        {/* Player side */}
        <div className="war__side war__side--player">
          <div className="war__side-label">You</div>
          <div className="war__pile-stack">
            {playerPile.length > 0
              ? <PlayingCard card={playerPile[0]} faceDown backColor={settings.cardBack} />
              : <div className="playing-card--empty" />
            }
            <div className="war__pile-count">{playerPile.length} left</div>
          </div>
          {isWar && (
            <div className="war__war-cards">
              {warPlayerCards.map((c) => (
                <PlayingCard key={c.id} card={c} faceDown backColor={settings.cardBack} />
              ))}
              {warPlayerFinal
                ? <PlayingCard card={warPlayerFinal} />
                : phase === "war-ready" ? null : null
              }
            </div>
          )}
          {playerCard && (
            <div className="war__flipped">
              <PlayingCard card={playerCard} />
            </div>
          )}
        </div>

        {/* Center VS */}
        <div className="war__center">
          <span className="war__vs">{isWar ? "WAR" : "VS"}</span>
        </div>

        {/* Dealer side */}
        <div className="war__side war__side--dealer">
          <div className="war__side-label">Dealer</div>
          <div className="war__pile-stack">
            {dealerPile.length > 0
              ? <PlayingCard card={dealerPile[0]} faceDown backColor={settings.cardBack} />
              : <div className="playing-card--empty" />
            }
            <div className="war__pile-count">{dealerPile.length} left</div>
          </div>
          {isWar && (
            <div className="war__war-cards">
              {warDealerCards.map((c) => (
                <PlayingCard key={c.id} card={c} faceDown backColor={settings.cardBack} />
              ))}
              {warDealerFinal && <PlayingCard card={warDealerFinal} />}
            </div>
          )}
          {dealerCard && (
            <div className="war__flipped">
              <PlayingCard card={dealerCard} />
            </div>
          )}
        </div>
      </div>

      {/* Result / controls */}
      <div className="war__controls">
        {resultBanner() && (
          <div className={`war__banner ${gameResult === "player" ? "war__banner--win" : gameResult === "dealer" ? "war__banner--lose" : roundResult === "player" ? "war__banner--win" : roundResult === "dealer" ? "war__banner--lose" : "war__banner--war"}`}>
            {resultBanner()}
          </div>
        )}

        {!autoPlay && (
          <div className="war__btn-row">
            {phase === "ready" && (
              <button className="war__btn war__btn--primary"
                disabled={playerPile.length === 0 || dealerPile.length === 0}
                onClick={flip}>
                ▶ Flip
              </button>
            )}
            {phase === "revealed" && (
              <button className="war__btn war__btn--secondary" onClick={resolveRevealed}>
                {roundResult === "war" ? "Go to War →" : "Next Round →"}
              </button>
            )}
            {phase === "war-ready" && (
              <button className="war__btn war__btn--primary" onClick={flipWar}>
                ⚔ Flip War Cards
              </button>
            )}
            {phase === "war-revealed" && (
              <button className="war__btn war__btn--secondary" onClick={resolveWarRevealed}>
                {roundResult === "war" ? "War Again →" : "Next Round →"}
              </button>
            )}
            {phase === "game-over" && (
              <button className="war__btn war__btn--primary" onClick={newGame}>
                New Game
              </button>
            )}
          </div>
        )}
        {autoPlay && phase === "game-over" && (
          <div className="war__auto-notice">Starting new game…</div>
        )}
      </div>
    </div>
  );
}
