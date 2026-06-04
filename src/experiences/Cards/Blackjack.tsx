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

const STAGE_W = 480;
const STAGE_H = 300;
const DEAL_Y  = 72;   // dealer hand y center
const PLAY_Y  = 178;  // player hand y center
const HAND_X  = 44;   // first card center x for both hands
const FAN_X   = 24;   // per-card horizontal fan offset
const SHOE_X  = 452;  // shoe pile center x (right of dealer row)
const SHOE_Y  = 72;   // shoe pile center y (same level as dealer)
const DISC_X  = -80;  // discard pile off-screen left
const DISC_Y  = 125;

// In-stage action button anchors
const HIT_L   = 390;              // HIT card button left edge
const HIT_T   = PLAY_Y - 36;     // 142 — aligns top of HIT card with player cards
const STAY_T  = PLAY_Y + 54;     // 232 — below player card bottoms (PLAY_Y+36=214)
const DBL_L   = 152;
const DBL_T   = STAY_T;

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "shuffling" | "betting" | "player-turn" | "dealer-turn" | "resolved";
type Outcome = "blackjack" | "win" | "push" | "dealer-blackjack" | "bust" | "lose";

// ── Constants ─────────────────────────────────────────────────────────────────

const STARTING_CHIPS        = 500;
const DEALER_HIT_DELAY_MS   = 700;
const DEALER_STAND_DELAY_MS = 400;
const SHUFFLE_CYCLES        = 2;

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

// ── Chip visual ───────────────────────────────────────────────────────────────

function ChipView({ amount, stack }: { amount: number; stack?: boolean }) {
  const bg = amount >= 500 ? "#5b2d8e"
           : amount >= 100 ? "#111122"
           : amount >= 50  ? "#cc4400"
           : amount >= 25  ? "#1a5a22"
           : amount >= 10  ? "#003388"
           :                 "#992222";
  const hl = amount >= 500 ? "#9966cc"
           : amount >= 100 ? "#5555aa"
           : amount >= 50  ? "#ff8844"
           : amount >= 25  ? "#44aa55"
           : amount >= 10  ? "#4477cc"
           :                 "#ff5555";
  const label = amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : `$${amount}`;
  return (
    <div className={`bj-chip${stack ? " bj-chip--stack" : ""}`} style={{ background: bg, borderColor: hl }}>
      {label}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BlackjackProps {
  onNewGame?: () => void;
  onQuit?:    () => void;
  settings:   DeckSettings;
}

export default function Blackjack({ settings, onNewGame, onQuit }: BlackjackProps) {
  const allCards  = useRef<Card[]>([]);
  const holeIdRef = useRef<string | null>(null);

  const shoe     = useRef(new CardStack({ zTier: 5, baseX: SHOE_X, baseY: SHOE_Y, offsetX: 0.08, offsetY: -0.3 }));
  const disc     = useRef(new CardStack({ zTier: 1, baseX: DISC_X, baseY: DISC_Y }));
  const dealerSt = useRef(new CardStack({ zTier: 9, baseX: HAND_X, baseY: DEAL_Y, offsetX: FAN_X }));
  const playerSt = useRef(new CardStack({ zTier: 10, baseX: HAND_X, baseY: PLAY_Y, offsetX: FAN_X }));

  const [cardStates,    setCardStates]    = useState<Record<string, CardVisualState>>({});
  const [appearance,    setAppearance]    = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [scale,         setScale]         = useState(1);
  const [phase,         setPhase]         = useState<Phase>("shuffling");
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
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const after = useCallback((ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); }, []);

  // ── Scale observer ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const s = Math.min(width / STAGE_W, height / STAGE_H);
      setScale(Math.max(0.4, s));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // ── Layout helper ─────────────────────────────────────────────────────────

  const allLayouts = useCallback((ms = 350): Record<string, CardVisualState> => ({
    ...shoe.current.layout(ms),
    ...disc.current.layout(ms),
    ...dealerSt.current.layout(ms),
    ...playerSt.current.layout(ms),
  }), []);

  // ── Shuffle animation ─────────────────────────────────────────────────────

  const performShuffle = useCallback((onComplete: () => void) => {
    setPhase("shuffling");
    let t = 0;

    for (let cycle = 0; cycle < SHUFFLE_CYCLES; cycle++) {
      after(t, () => {
        const cards = shoe.current.cards;
        const mid   = Math.floor(cards.length / 2);
        const split: Record<string, CardVisualState> = {};
        for (let i = 0; i < mid; i++) {
          split[cards[i].id] = {
            x: SHOE_X - 30, y: SHOE_Y - i * 0.3,
            z: 500 + i, rotation: 0, faceDown: true, transitionMs: 180,
          };
        }
        for (let i = mid; i < cards.length; i++) {
          split[cards[i].id] = {
            x: SHOE_X + 30, y: SHOE_Y - (i - mid) * 0.3,
            z: 500 + i, rotation: 0, faceDown: true, transitionMs: 180,
          };
        }
        setCardStates(prev => ({ ...prev, ...split }));
      });
      t += 240;

      after(t, () => {
        const cards    = shoe.current.cards;
        const combined: Record<string, CardVisualState> = {};
        for (let i = 0; i < cards.length; i++) {
          combined[cards[i].id] = {
            x: SHOE_X, y: SHOE_Y - i * 0.3,
            z: 500 + i, rotation: 0, faceDown: true,
            transitionMs: 280, transitionDelay: (i % 2 === 0 ? 0 : 40),
          };
        }
        setCardStates(prev => ({ ...prev, ...combined }));
      });
      t += 400;
    }

    after(t, () => {
      setCardStates(allLayouts(0));
      onComplete();
    });
  }, [after, allLayouts]);

  // ── Initialization ────────────────────────────────────────────────────────

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
    performShuffle(() => setPhase("betting"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Deal ─────────────────────────────────────────────────────────────────

  const dealCards = useCallback(() => {
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
      after(800, () => {
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
      });
    } else {
      setPhase("player-turn");
    }
  }, [bet, allLayouts, after]);

  const deal = useCallback(() => {
    const threshold = Math.max(15, Math.floor(allCards.current.length * 0.25));
    if (shoe.current.size < threshold) {
      // Gather disc cards into shoe then animate shuffle
      const discCards = disc.current.cards;
      disc.current.clear();
      const reshuffled = shuffle([...discCards]);
      for (const c of reshuffled) shoe.current.addCard(c, { toTop: false, faceDown: true });
      setShoeCount(shoe.current.size);
      setCardStates(allLayouts(300));
      after(350, () => performShuffle(dealCards));
    } else {
      dealCards();
    }
  }, [dealCards, allLayouts, after, performShuffle]);

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

  // ── New hand ──────────────────────────────────────────────────────────────

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
    clearTimers();
    const all = [
      ...disc.current.cards, ...shoe.current.cards,
      ...dealerSt.current.cards, ...playerSt.current.cards,
    ];
    const reshuffled = shuffle(all.length > 0 ? all : [...allCards.current]);
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
    setShoeCount(shoe.current.size);
    setCardStates(shoe.current.layout(0));
    performShuffle(() => setPhase("betting"));
  }, [clearTimers, performShuffle]);

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

  // ── Derived ───────────────────────────────────────────────────────────────

  const dealerScore        = scoreLabel(dealerHand, holeRevealed, true);
  const playerScore        = scoreLabel(playerHand, true, false);
  const playerTotal        = handTotal(playerHand);
  const dealerTotalForClass = holeRevealed ? handTotal(dealerHand) : 0;
  const gameOver           = chips < 5 && phase === "betting";
  const canDouble          = phase === "player-turn" && playerHand.length === 2 && chips >= bet * 2;

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
        <DeckModal appearance={appearance} onUpdate={setAppearance} onClose={() => setShowDeckModal(false)} />
      )}

      {/* Green felt area — fills all available space */}
      <div className="bj__stage-container" ref={containerRef}>
        <div
          className="bj__stage"
          style={{
            width:  STAGE_W,
            height: STAGE_H,
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {/* All cards: permanent DOM, positions driven by cardStates */}
          {allCards.current.map(card => {
            const cs = cardStates[card.id];
            if (!cs) return null;
            return <PermCard key={card.id} card={card} cs={cs} appearance={appearance} size="sm" />;
          })}

          {/* DEALER label */}
          <div className="bj__stage-label" style={{ top: 8, left: 8 }}>
            DEALER
            {dealerHand.length > 0 && (
              <span className={`bj__stage-score${dealerTotalForClass > 21 ? " bj__stage-score--bust" : dealerTotalForClass === 21 && dealerHand.length === 2 ? " bj__stage-score--bj" : ""}`}>
                {dealerScore}
              </span>
            )}
          </div>

          {/* YOU label */}
          <div className="bj__stage-label" style={{ top: HIT_T - 12, left: 8 }}>
            YOU
            {playerHand.length > 0 && (
              <span className={`bj__stage-score${playerTotal > 21 ? " bj__stage-score--bust" : playerTotal === 21 && playerHand.length === 2 ? " bj__stage-score--bj" : ""}`}>
                {playerScore}
              </span>
            )}
          </div>

          {/* Shoe count */}
          <div className="bj__shoe-label" style={{ top: 8, right: 8 }}>{shoeCount} left</div>

          {/* Shuffling indicator */}
          {phase === "shuffling" && (
            <div className="bj__shuffling">Shuffling...</div>
          )}

          {/* HIT — card-shaped tap zone right of player cards */}
          {phase === "player-turn" && (
            <button className="bj__hit-btn" style={{ left: HIT_L, top: HIT_T }} onClick={hit}>
              <span className="bj__action-icon">👇</span>
              <span className="bj__action-lbl">HIT</span>
            </button>
          )}

          {/* STAY — wave gesture below player cards */}
          {phase === "player-turn" && (
            <button className="bj__stay-btn" style={{ left: 50, top: STAY_T }} onClick={stand}>
              <span className="bj__action-icon">✋</span>
              <span className="bj__action-lbl">STAY</span>
            </button>
          )}

          {/* DOUBLE */}
          {canDouble && (
            <button className="bj__dbl-btn" style={{ left: DBL_L, top: DBL_T }} onClick={doubleDown}>
              <span className="bj__action-icon">×2</span>
              <span className="bj__action-lbl">DBL</span>
            </button>
          )}

          {/* Outcome overlay */}
          {phase === "resolved" && outcome && (
            <div className={`bj__outcome ${outcomeClass()}`}>{outcomeText()}</div>
          )}
        </div>
      </div>

      {/* Win95 controls bar */}
      <div className="bj__controls">
        <div className="bj__info-row">
          <div className="bj__chip-group">
            <ChipView amount={chips} stack />
            <span className="bj__chip-lbl">Chips</span>
          </div>

          {phase === "betting" && !gameOver && (
            <div className="bj__bet-adjust">
              <button className="bj__btn bj__btn--sm" disabled={bet <= 5}           onClick={() => setBet(p => Math.max(5,     p - 5))}>-$5</button>
              <button className="bj__btn bj__btn--sm" disabled={bet + 5  > chips}   onClick={() => setBet(p => Math.min(chips, p + 5))}>+$5</button>
              <button className="bj__btn bj__btn--sm" disabled={bet + 25 > chips}   onClick={() => setBet(p => Math.min(chips, p + 25))}>+$25</button>
              <button className="bj__btn bj__btn--sm" disabled={bet === 5}          onClick={() => setBet(5)}>Min</button>
              <button className="bj__btn bj__btn--sm" disabled={bet === chips}      onClick={() => setBet(chips)}>All In</button>
            </div>
          )}

          <div className="bj__chip-group">
            <ChipView amount={bet} />
            <span className="bj__chip-lbl">Bet</span>
          </div>
        </div>

        <div className="bj__action-row">
          {phase === "shuffling" && <span className="bj__waiting">Shuffling deck...</span>}
          {phase === "betting" && !gameOver && (
            <button className="bj__btn bj__btn--deal" onClick={deal} disabled={allCards.current.length === 0}>
              ▶ DEAL
            </button>
          )}
          {phase === "dealer-turn" && <span className="bj__waiting">Dealer playing...</span>}
          {phase === "resolved" && (
            chips >= 5
              ? <button className="bj__btn bj__btn--deal" onClick={newHand}>New Hand</button>
              : <button className="bj__btn bj__btn--deal" onClick={resetGame}>New Game</button>
          )}
          {gameOver && <button className="bj__btn bj__btn--deal" onClick={resetGame}>New Game</button>}
        </div>
      </div>
    </div>
  );
}
