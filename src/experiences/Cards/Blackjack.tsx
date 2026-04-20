import { useState, useCallback, useEffect } from "react";
import "./Blackjack.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, DeckSettings } from "./types";
import { buildDeck } from "./deckUtils";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "betting" | "player-turn" | "dealer-turn" | "resolved";
type Outcome = "blackjack" | "win" | "push" | "dealer-blackjack" | "bust" | "lose";

// ── Constants ────────────────────────────────────────────────────────────────

const STARTING_CHIPS = 500;
const RESHUFFLE_AT = 15;
const DEALER_HIT_DELAY_MS = 700;
const DEALER_STAND_DELAY_MS = 400;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cardPoints(rank: Card["rank"]): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  if (rank === "Joker") return 0;
  return parseInt(rank as string, 10);
}

function handTotal(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === "A") aces++;
    total += cardPoints(c.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isNaturalBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

function scoreLabel(cards: Card[], holeRevealed: boolean, isDealer: boolean): string {
  if (cards.length === 0) return "";
  if (isDealer && !holeRevealed) {
    return `${cardPoints(cards[0].rank)} + ?`;
  }
  const total = handTotal(cards);
  if (total > 21) return `BUST (${total})`;
  return String(total);
}

// ── Component ────────────────────────────────────────────────────────────────

interface BlackjackProps {
  settings: DeckSettings;
}

export default function Blackjack({ settings }: BlackjackProps) {
  const [deck, setDeck] = useState<Card[]>(() => buildDeck(settings));
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [holeRevealed, setHoleRevealed] = useState(false);
  const [phase, setPhase] = useState<Phase>("betting");
  const [chips, setChips] = useState(STARTING_CHIPS);
  const [bet, setBet] = useState(10);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [chipDelta, setChipDelta] = useState(0);
  const [dealerDone, setDealerDone] = useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────

  const deal = useCallback(() => {
    const workDeck = deck.length < RESHUFFLE_AT ? buildDeck(settings) : deck;
    const [c1, c2, c3, c4, ...rest] = workDeck;
    const pHand = [c1, c3];
    const dHand = [c2, c4];

    setDeck(rest);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setHoleRevealed(false);
    setOutcome(null);
    setChipDelta(0);
    setDealerDone(false);

    if (isNaturalBlackjack(pHand)) {
      setHoleRevealed(true);
      if (isNaturalBlackjack(dHand)) {
        setOutcome("push");
        setChipDelta(0);
      } else {
        const win = Math.floor(bet * 1.5);
        setChips((c) => c + win);
        setOutcome("blackjack");
        setChipDelta(win);
      }
      setPhase("resolved");
    } else {
      setPhase("player-turn");
    }
  }, [deck, bet, settings]);

  const hit = useCallback(() => {
    if (phase !== "player-turn") return;
    const [nextCard, ...rest] = deck;
    const newHand = [...playerHand, nextCard];
    const total = handTotal(newHand);

    setDeck(rest);
    setPlayerHand(newHand);

    if (total > 21) {
      setChips((c) => c - bet);
      setOutcome("bust");
      setChipDelta(-bet);
      setHoleRevealed(true);
      setPhase("resolved");
    } else if (total === 21) {
      // Auto-stand at 21
      setHoleRevealed(true);
      setDealerDone(false);
      setPhase("dealer-turn");
    }
  }, [phase, deck, playerHand, bet]);

  const stand = useCallback(() => {
    if (phase !== "player-turn") return;
    setHoleRevealed(true);
    setDealerDone(false);
    setPhase("dealer-turn");
  }, [phase]);

  const doubleDown = useCallback(() => {
    if (phase !== "player-turn" || playerHand.length !== 2 || chips < bet * 2) return;
    const newBet = bet * 2;
    const [nextCard, ...rest] = deck;
    const newHand = [...playerHand, nextCard];
    const total = handTotal(newHand);

    setDeck(rest);
    setPlayerHand(newHand);
    setBet(newBet);

    if (total > 21) {
      setChips((c) => c - newBet);
      setOutcome("bust");
      setChipDelta(-newBet);
      setHoleRevealed(true);
      setPhase("resolved");
    } else {
      setHoleRevealed(true);
      setDealerDone(false);
      setPhase("dealer-turn");
    }
  }, [phase, playerHand, deck, bet, chips]);

  // ── Dealer auto-play ───────────────────────────────────────────────────────

  // Each time dealerHand changes during dealer-turn, check whether to hit or stand.
  useEffect(() => {
    if (phase !== "dealer-turn" || dealerDone) return;

    const total = handTotal(dealerHand);
    const timer = setTimeout(() => {
      if (total < 17) {
        setDeck((prevDeck) => {
          const [nextCard, ...rest] = prevDeck;
          setDealerHand((prev) => [...prev, nextCard]);
          return rest;
        });
      } else {
        setDealerDone(true);
      }
    }, total < 17 ? DEALER_HIT_DELAY_MS : DEALER_STAND_DELAY_MS);

    return () => clearTimeout(timer);
  }, [phase, dealerHand, dealerDone]);

  // Resolve outcome once dealer is done
  useEffect(() => {
    if (!dealerDone) return;

    const pTotal = handTotal(playerHand);
    const dTotal = handTotal(dealerHand);

    let o: Outcome;
    let delta: number;

    if (isNaturalBlackjack(dealerHand)) {
      o = "dealer-blackjack";
      delta = -bet;
    } else if (dTotal > 21 || pTotal > dTotal) {
      o = "win";
      delta = bet;
    } else if (pTotal === dTotal) {
      o = "push";
      delta = 0;
    } else {
      o = "lose";
      delta = -bet;
    }

    setChips((c) => c + delta);
    setOutcome(o);
    setChipDelta(delta);
    setPhase("resolved");
  }, [dealerDone, bet, playerHand, dealerHand]);

  // ── New round / reset ──────────────────────────────────────────────────────

  const newHand = useCallback(() => {
    setBet((prev) => Math.min(prev, Math.max(5, chips)));
    setPlayerHand([]);
    setDealerHand([]);
    setHoleRevealed(false);
    setOutcome(null);
    setDealerDone(false);
    setChipDelta(0);
    setPhase("betting");
  }, [chips]);

  const resetGame = useCallback(() => {
    setChips(STARTING_CHIPS);
    setBet(10);
    setDeck(buildDeck(settings));
    setPlayerHand([]);
    setDealerHand([]);
    setHoleRevealed(false);
    setOutcome(null);
    setDealerDone(false);
    setChipDelta(0);
    setPhase("betting");
  }, [settings]);

  // ── Derived display values ─────────────────────────────────────────────────

  const dealerScore = scoreLabel(dealerHand, holeRevealed, true);
  const playerScore = scoreLabel(playerHand, true, false);
  const playerTotal = handTotal(playerHand);
  const gameOver = chips < 5 && phase === "betting";

  function outcomeText(): string {
    if (!outcome) return "";
    switch (outcome) {
      case "blackjack":        return `BLACKJACK!  +$${chipDelta}`;
      case "win":              return `YOU WIN!  +$${chipDelta}`;
      case "push":             return "PUSH — bet returned";
      case "dealer-blackjack": return `DEALER BLACKJACK  -$${Math.abs(chipDelta)}`;
      case "bust":             return `BUST!  -$${Math.abs(chipDelta)}`;
      case "lose":             return `DEALER WINS  -$${Math.abs(chipDelta)}`;
    }
  }

  function outcomeClass(): string {
    if (!outcome) return "";
    if (outcome === "blackjack" || outcome === "win") return "bj__outcome--win";
    if (outcome === "push") return "bj__outcome--push";
    return "bj__outcome--lose";
  }

  const dealerTotalForClass = holeRevealed ? handTotal(dealerHand) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bj">
      {/* Felt table */}
      <div className="bj__table">

        {/* Dealer hand */}
        <div>
          <div className="bj__section-label">
            DEALER
            {dealerHand.length > 0 && (
              <span className={`bj__score${dealerTotalForClass > 21 ? " bj__score--bust" : dealerTotalForClass === 21 && dealerHand.length === 2 ? " bj__score--bj" : ""}`}>
                {dealerScore}
              </span>
            )}
          </div>
          <div className="bj__hand">
            {dealerHand.map((card, i) => (
              <div key={card.id} className="bj__card">
                <PlayingCard
                  card={card}
                  faceDown={i === 1 && !holeRevealed}
                  backColor={settings.cardBack}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Player hand */}
        <div>
          <div className="bj__section-label">
            YOU
            {playerHand.length > 0 && (
              <span className={`bj__score${playerTotal > 21 ? " bj__score--bust" : playerTotal === 21 && playerHand.length === 2 ? " bj__score--bj" : ""}`}>
                {playerScore}
              </span>
            )}
          </div>
          <div className="bj__hand">
            {playerHand.map((card) => (
              <div key={card.id} className="bj__card">
                <PlayingCard card={card} backColor={settings.cardBack} />
              </div>
            ))}
          </div>
        </div>

        {/* Outcome overlay */}
        {phase === "resolved" && outcome && (
          <div className={`bj__outcome ${outcomeClass()}`}>
            {outcomeText()}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bj__controls">
        <div className="bj__info-row">
          <span className="bj__chips-label">Chips: ${chips}</span>
          <span className="bj__chips-label">Bet: ${bet}</span>
        </div>

        <div className="bj__divider" />

        {/* Bet row — only during betting phase */}
        {phase === "betting" && !gameOver && (
          <div className="bj__bet-row">
            <span className="bj__chips-label">Adjust:</span>
            <button className="bj__btn bj__btn--sm" disabled={bet <= 5}      onClick={() => setBet((p) => Math.max(5, p - 5))}>−$5</button>
            <button className="bj__btn bj__btn--sm" disabled={bet + 5 > chips} onClick={() => setBet((p) => Math.min(chips, p + 5))}>+$5</button>
            <button className="bj__btn bj__btn--sm" disabled={bet + 25 > chips} onClick={() => setBet((p) => Math.min(chips, p + 25))}>+$25</button>
            <button className="bj__btn bj__btn--sm" disabled={bet === 5}       onClick={() => setBet(5)}>Min</button>
            <button className="bj__btn bj__btn--sm" disabled={bet === chips}   onClick={() => setBet(chips)}>All In</button>
          </div>
        )}

        {/* Action row */}
        <div className="bj__action-row">
          {phase === "betting" && !gameOver && (
            <button className="bj__btn bj__btn--deal" onClick={deal} disabled={bet < 5}>
              ▶ DEAL
            </button>
          )}

          {phase === "player-turn" && (
            <>
              <button className="bj__btn bj__btn--hit"    onClick={hit}>Hit</button>
              <button className="bj__btn bj__btn--stand"  onClick={stand}>Stand</button>
              {playerHand.length === 2 && chips >= bet * 2 && (
                <button className="bj__btn bj__btn--double" onClick={doubleDown}>Double</button>
              )}
            </>
          )}

          {phase === "dealer-turn" && (
            <span className="bj__waiting">Dealer playing...</span>
          )}

          {phase === "resolved" && (
            chips >= 5
              ? <button className="bj__btn bj__btn--deal" onClick={newHand}>New Hand</button>
              : <button className="bj__btn bj__btn--deal" onClick={resetGame}>New Game</button>
          )}

          {gameOver && (
            <button className="bj__btn bj__btn--deal" onClick={resetGame}>New Game</button>
          )}
        </div>

        {deck.length < RESHUFFLE_AT && phase === "betting" && (
          <div className="bj__notice">Shuffling next hand</div>
        )}
      </div>
    </div>
  );
}
