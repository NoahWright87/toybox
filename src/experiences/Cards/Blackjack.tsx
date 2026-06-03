import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Blackjack.css";
import { PermCard } from "./PermCard";
import { CardStack } from "./cardStack";
import type { CardVisualState } from "./cardStack";
import type { Card, CardAppearance, DeckSettings } from "./types";
import { buildDeck, shuffle } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Stage layout ──────────────────────────────────────────────────────────────

const STAGE_W  = 480;
const STAGE_H  = 280;
const DEAL_Y   = 80;   // dealer hand center y
const PLAY_Y   = 204;  // player hand center y
const HAND_X   = 48;   // first card center x for both hands
const FAN_X    = 24;   // horizontal offset per card in hand
const SHOE_X   = 446;  // shoe pile center x
const SHOE_Y   = 140;  // shoe pile center y
const DISC_X   = -80;  // discard pile (off-screen left)
const DISC_Y   = 140;

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "betting" | "player-turn" | "dealer-turn" | "resolved";
type Outcome = "blackjack" | "win" | "push" | "dealer-blackjack" | "bust" | "lose";

// ── Constants ─────────────────────────────────────────────────────────────────

const STARTING_CHIPS      = 500;
const DEALER_HIT_DELAY_MS = 700;
const DEALER_STAND_DELAY_MS = 400;

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardPoints(rank: Card["rank"]): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  if (rank === "Joker") return 0;
  return parseInt(rank as string, 10);
}

function handTotal(cards: Card[]): number {
  let total = 0;
  let aces  = 0;
  for (const c of cards) {
    if (c.rank === "A") aces++;
    total += cardPoints(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isNaturalBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

function scoreLabel(cards: Card[], holeRevealed: boolean, isDealer: boolean): string {
  if (cards.length === 0) return "";
  if (isDealer && !holeRevealed) return `${cardPoints(cards[0].rank)} + ?`;
  const total = handTotal(cards);
  if (total > 21) return `BUST (${total})`;
  return String(total);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BlackjackProps {
  onNewGame?: () => void;
  onQuit?:    () => void;
  settings:   DeckSettings;
}

export default function Blackjack({ settings, onNewGame, onQuit }: BlackjackProps) {
  // All cards for this shoe (persists until explicit new game)
  const allCards   = useRef<Card[]>([]);
  const holeIdRef  = useRef<string | null>(null);

  // CardStacks (pure logic refs)
  const shoe   = useRef(new CardStack({ zTier: 5, baseX: SHOE_X, baseY: SHOE_Y, offsetX: 0.15, offsetY: -0.35 }));
  const disc   = useRef(new CardStack({ zTier: 1, baseX: DISC_X, baseY: DISC_Y }));
  const dealerSt = useRef(new CardStack({ zTier: 9, baseX: HAND_X, baseY: DEAL_Y, offsetX: FAN_X }));
  const playerSt = useRef(new CardStack({ zTier: 10, baseX: HAND_X, baseY: PLAY_Y, offsetX: FAN_X }));

  // Visual state
  const [cardStates,    setCardStates]    = useState<Record<string, CardVisualState>>({});
  const [appearance,    setAppearance]    = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [scale,         setScale]         = useState(1);

  // Game state
  const [phase,         setPhase]         = useState<Phase>("betting");
  const [playerHand,    setPlayerHand]    = useState<Card[]>([]);
  const [dealerHand,    setDealerHand]    = useState<Card[]>([]);
  const [holeRevealed,  setHoleRevealed]  = useState(false);
  const [chips,         setChips]         = useState(STARTING_CHIPS);
  const [bet,           setBet]           = useState(10);
  const [outcome,       setOutcome]       = useState<Outcome | null>(null);
  const [chipDelta,     setChipDelta]     = useState(0);
  const [dealerDone,    setDealerDone]    = useState(false);
  const [shoeCount,     setShoeCount]     = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── One-time shoe initialization ───────────────────────────────────────────

  useEffect(() => {
    const cards = buildDeck(settings);
    allCards.current = cards;
    shoe.current.clear();
    disc.current.clear();
    dealerSt.current.clear();
    playerSt.current.clear();
    for (const c of cards) shoe.current.addCard(c, { toTop: true, faceDown: true });
    setShoeCount(shoe.current.size);
    setCardStates(shoe.current.layout(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scale stage to fit narrow containers ──────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setScale(Math.min(1, w / STAGE_W));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Layout helpers ────────────────────────────────────────────────────────

  const allLayouts = useCallback((ms = 350): Record<string, CardVisualState> => ({
    ...shoe.current.layout(ms),
    ...disc.current.layout(ms),
    ...dealerSt.current.layout(ms),
    ...playerSt.current.layout(ms),
  }), []);

  // ── Reshuffle helper ──────────────────────────────────────────────────────

  const reshuffleIfNeeded = useCallback(() => {
    const threshold = Math.max(15, Math.floor(allCards.current.length * 0.25));
    if (shoe.current.size >= threshold) return;
    // Collect all disc cards back into shoe
    const discCards = disc.current.cards;
    disc.current.clear();
    const reshuffled = shuffle([...discCards]);
    for (const c of reshuffled) shoe.current.addCard(c, { toTop: false, faceDown: true });
  }, []);

  // ── Deal ─────────────────────────────────────────────────────────────────

  const deal = useCallback(() => {
    reshuffleIfNeeded();

    // Pull 4 cards: p1, d1, p2, d2(hole)
    const p1 = shoe.current.removeTop()!;
    const d1 = shoe.current.removeTop()!;
    const p2 = shoe.current.removeTop()!;
    const d2 = shoe.current.removeTop()!;

    playerSt.current.clear();
    dealerSt.current.clear();

    playerSt.current.addCard(p1, { toTop: true, faceDown: false });
    dealerSt.current.addCard(d1, { toTop: true, faceDown: false });
    playerSt.current.addCard(p2, { toTop: true, faceDown: false });
    dealerSt.current.addCard(d2, { toTop: true, faceDown: true });
    holeIdRef.current = d2.id;

    // Layout with stagger delays flying from shoe
    const layouts = allLayouts(550);
    layouts[p1.id] = { ...layouts[p1.id], transitionDelay: 0 };
    layouts[d1.id] = { ...layouts[d1.id], transitionDelay: 140 };
    layouts[p2.id] = { ...layouts[p2.id], transitionDelay: 280 };
    layouts[d2.id] = { ...layouts[d2.id], transitionDelay: 420 };

    setCardStates(layouts);
    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);
    setHoleRevealed(false);
    setOutcome(null);
    setChipDelta(0);
    setDealerDone(false);
    setShoeCount(shoe.current.size);

    if (isNaturalBlackjack([p1, p2])) {
      // Reveal hole after cards land
      setTimeout(() => {
        dealerSt.current.setFaceDown(d2.id, false);
        setHoleRevealed(true);
        setCardStates(allLayouts(400));
        if (isNaturalBlackjack([d1, d2])) {
          setOutcome("push");
          setChipDelta(0);
        } else {
          const win = Math.floor(bet * 1.5);
          setChips(c => c + win);
          setOutcome("blackjack");
          setChipDelta(win);
        }
        setPhase("resolved");
      }, 800);
    } else {
      setPhase("player-turn");
    }
  }, [bet, reshuffleIfNeeded, allLayouts]);

  // ── Hit ───────────────────────────────────────────────────────────────────

  const hit = useCallback(() => {
    if (phase !== "player-turn") return;
    const card = shoe.current.removeTop();
    if (!card) return;
    playerSt.current.addCard(card, { toTop: true, faceDown: false });
    const newHand = [...playerHand, card];
    const total   = handTotal(newHand);
    setPlayerHand(newHand);
    setShoeCount(shoe.current.size);

    if (total > 21) {
      dealerSt.current.setFaceDown(holeIdRef.current!, false);
      setHoleRevealed(true);
      setCardStates(allLayouts(350));
      setChips(c => c - bet);
      setOutcome("bust");
      setChipDelta(-bet);
      setPhase("resolved");
    } else if (total === 21) {
      dealerSt.current.setFaceDown(holeIdRef.current!, false);
      setHoleRevealed(true);
      setCardStates(allLayouts(350));
      setDealerDone(false);
      setPhase("dealer-turn");
    } else {
      setCardStates(allLayouts(350));
    }
  }, [phase, playerHand, bet, allLayouts]);

  // ── Stand ─────────────────────────────────────────────────────────────────

  const stand = useCallback(() => {
    if (phase !== "player-turn") return;
    dealerSt.current.setFaceDown(holeIdRef.current!, false);
    setHoleRevealed(true);
    setCardStates(allLayouts(350));
    setDealerDone(false);
    setPhase("dealer-turn");
  }, [phase, allLayouts]);

  // ── Double Down ───────────────────────────────────────────────────────────

  const doubleDown = useCallback(() => {
    if (phase !== "player-turn" || playerHand.length !== 2 || chips < bet * 2) return;
    const newBet = bet * 2;
    const card   = shoe.current.removeTop();
    if (!card) return;
    playerSt.current.addCard(card, { toTop: true, faceDown: false });
    const newHand = [...playerHand, card];
    const total   = handTotal(newHand);
    setPlayerHand(newHand);
    setBet(newBet);
    setShoeCount(shoe.current.size);

    dealerSt.current.setFaceDown(holeIdRef.current!, false);
    setHoleRevealed(true);

    if (total > 21) {
      setCardStates(allLayouts(350));
      setChips(c => c - newBet);
      setOutcome("bust");
      setChipDelta(-newBet);
      setPhase("resolved");
    } else {
      setCardStates(allLayouts(350));
      setDealerDone(false);
      setPhase("dealer-turn");
    }
  }, [phase, playerHand, bet, chips, allLayouts]);

  // ── Dealer auto-play ──────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "dealer-turn" || dealerDone) return;
    const total = handTotal(dealerHand);
    const timer = setTimeout(() => {
      if (total < 17) {
        const card = shoe.current.removeTop();
        if (!card) return;
        dealerSt.current.addCard(card, { toTop: true, faceDown: false });
        setDealerHand(prev => [...prev, card]);
        setShoeCount(shoe.current.size);
        setCardStates(allLayouts(400));
      } else {
        setDealerDone(true);
      }
    }, total < 17 ? DEALER_HIT_DELAY_MS : DEALER_STAND_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, dealerHand, dealerDone, allLayouts]);

  // ── Resolve outcome ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!dealerDone) return;
    const pTotal = handTotal(playerHand);
    const dTotal = handTotal(dealerHand);
    let o: Outcome;
    let delta: number;
    if (isNaturalBlackjack(dealerHand)) {
      o = "dealer-blackjack"; delta = -bet;
    } else if (dTotal > 21 || pTotal > dTotal) {
      o = "win";             delta = bet;
    } else if (pTotal === dTotal) {
      o = "push";            delta = 0;
    } else {
      o = "lose";            delta = -bet;
    }
    setChips(c => c + delta);
    setOutcome(o);
    setChipDelta(delta);
    setPhase("resolved");
  }, [dealerDone, bet, playerHand, dealerHand]);

  // ── New hand (clear hands → disc) ────────────────────────────────────────

  const newHand = useCallback(() => {
    const handCards = [...playerSt.current.cards, ...dealerSt.current.cards];
    playerSt.current.clear();
    dealerSt.current.clear();
    for (const c of handCards) disc.current.addCard(c, { toTop: true, faceDown: true });
    setBet(prev => Math.min(prev, Math.max(5, chips)));
    setPlayerHand([]);
    setDealerHand([]);
    setHoleRevealed(false);
    setOutcome(null);
    setDealerDone(false);
    setChipDelta(0);
    setPhase("betting");
    setCardStates(allLayouts(400));
  }, [chips, allLayouts]);

  // ── Reset game ────────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    const allInPlay = [
      ...disc.current.cards,
      ...shoe.current.cards,
      ...dealerSt.current.cards,
      ...playerSt.current.cards,
    ];
    const reshuffled = shuffle(allInPlay.length > 0 ? allInPlay : [...allCards.current]);
    disc.current.clear();
    dealerSt.current.clear();
    playerSt.current.clear();
    shoe.current.clear();
    for (const c of reshuffled) shoe.current.addCard(c, { toTop: true, faceDown: true });
    setChips(STARTING_CHIPS);
    setBet(10);
    setPlayerHand([]);
    setDealerHand([]);
    setHoleRevealed(false);
    setOutcome(null);
    setDealerDone(false);
    setChipDelta(0);
    setPhase("betting");
    setShoeCount(shoe.current.size);
    setCardStates(shoe.current.layout(0));
  }, []);

  // ── Menus ─────────────────────────────────────────────────────────────────

  const bjMenus = useMemo<MenuBarMenu[]>(() => {
    const items: MenuBarMenu["items"] = [
      { label: "Restart", onClick: resetGame },
      ...(onNewGame ? [{ label: "New Game", onClick: onNewGame }] : []),
      ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game",    items },
      { label: "Options", items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }] },
    ];
  }, [resetGame, onNewGame, onQuit]);

  useWindowMenus(bjMenus);

  // ── Derived display ───────────────────────────────────────────────────────

  const dealerScore = scoreLabel(dealerHand, holeRevealed, true);
  const playerScore = scoreLabel(playerHand, true, false);
  const playerTotal = handTotal(playerHand);
  const dealerTotalForClass = holeRevealed ? handTotal(dealerHand) : 0;
  const gameOver    = chips < 5 && phase === "betting";

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
    return "";
  }

  function outcomeClass(): string {
    if (!outcome) return "";
    if (outcome === "blackjack" || outcome === "win") return "bj__outcome--win";
    if (outcome === "push") return "bj__outcome--push";
    return "bj__outcome--lose";
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bj">
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      {/* Stage container — measures width for scaling */}
      <div className="bj__stage-container" ref={containerRef}>
        <div
          className="bj__stage"
          style={{
            width:           STAGE_W,
            height:          STAGE_H,
            transform:       scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {/* Render all cards as permanent DOM elements */}
          {allCards.current.map(card => {
            const cs = cardStates[card.id];
            if (!cs) return null;
            return (
              <PermCard
                key={card.id}
                card={card}
                cs={cs}
                appearance={appearance}
                size="sm"
              />
            );
          })}

          {/* Dealer label + score */}
          <div className="bj__stage-label" style={{ top: 10, left: 10 }}>
            DEALER
            {dealerHand.length > 0 && (
              <span className={`bj__stage-score${dealerTotalForClass > 21 ? " bj__stage-score--bust" : dealerTotalForClass === 21 && dealerHand.length === 2 ? " bj__stage-score--bj" : ""}`}>
                {dealerScore}
              </span>
            )}
          </div>

          {/* Player label + score */}
          <div className="bj__stage-label" style={{ top: 148, left: 10 }}>
            YOU
            {playerHand.length > 0 && (
              <span className={`bj__stage-score${playerTotal > 21 ? " bj__stage-score--bust" : playerTotal === 21 && playerHand.length === 2 ? " bj__stage-score--bj" : ""}`}>
                {playerScore}
              </span>
            )}
          </div>

          {/* Shoe count */}
          <div className="bj__shoe-label" style={{ right: 10, top: 10 }}>
            {shoeCount} left
          </div>

          {/* Outcome overlay */}
          {phase === "resolved" && outcome && (
            <div className={`bj__outcome ${outcomeClass()}`}>{outcomeText()}</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bj__controls">
        <div className="bj__info-row">
          <span className="bj__chips-label">Chips: ${chips}</span>
          <span className="bj__chips-label">Bet: ${bet}</span>
        </div>

        <div className="bj__divider" />

        {phase === "betting" && !gameOver && (
          <div className="bj__bet-row">
            <span className="bj__chips-label">Adjust:</span>
            <button className="bj__btn bj__btn--sm" disabled={bet <= 5}           onClick={() => setBet(p => Math.max(5, p - 5))}>−$5</button>
            <button className="bj__btn bj__btn--sm" disabled={bet + 5 > chips}    onClick={() => setBet(p => Math.min(chips, p + 5))}>+$5</button>
            <button className="bj__btn bj__btn--sm" disabled={bet + 25 > chips}   onClick={() => setBet(p => Math.min(chips, p + 25))}>+$25</button>
            <button className="bj__btn bj__btn--sm" disabled={bet === 5}          onClick={() => setBet(5)}>Min</button>
            <button className="bj__btn bj__btn--sm" disabled={bet === chips}      onClick={() => setBet(chips)}>All In</button>
          </div>
        )}

        <div className="bj__action-row">
          {phase === "betting" && !gameOver && (
            <button className="bj__btn bj__btn--deal" onClick={deal} disabled={bet < 5 || allCards.current.length === 0}>
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
      </div>
    </div>
  );
}
