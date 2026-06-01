import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Hearts.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, CardAppearance, DeckSettings, Suit } from "./types";
import {
  dealHands,
  getValidHeartPlays,
  resolveTrick,
  trickPoints,
  rankValue,
  type TrickPlay,
} from "./trickTakingEngine";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Deck helpers ──────────────────────────────────────────────────────────────

const RANKS_ORD = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const ALL_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of RANKS_ORD) {
      cards.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return shuffle(cards);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type HeartsPhase = "passing" | "playing" | "trick-end" | "hand-end" | "game-over";
type PassDir = "left" | "right" | "across" | "none";

interface HeartsState {
  hands: Card[][];
  scores: number[];
  handScores: number[];
  phase: HeartsPhase;
  passDir: PassDir;
  passedCards: Card[];
  receivedCards: Card[];
  currentTrick: TrickPlay[];
  ledSuit: Suit | null;
  trickLeader: number;
  currentPlayer: number;
  heartsAreBroken: boolean;
  isFirstTrick: boolean;
  tricksThisHand: number;
  handNumber: number;
  selectedCard: string | null;
}

interface FlyingCard {
  id: string;
  card: Card;
  fromX: number;     // source center, table-relative px
  fromY: number;
  toX: number;       // dest center, table-relative px
  toY: number;
  landAngle: number; // random ±12° landing rotation
  doFlip: boolean;   // true = AI card, flip back→front mid-flight
  sm: boolean;       // true = use sm card size
}

const PLAYER_NAMES = ["You", "West", "North", "East"];

function passDirection(handNumber: number): PassDir {
  const dirs: PassDir[] = ["left", "right", "across", "none"];
  return dirs[handNumber % 4];
}

function passTarget(from: number, dir: PassDir): number {
  if (dir === "left")   return (from + 1) % 4;
  if (dir === "right")  return (from + 3) % 4;
  if (dir === "across") return (from + 2) % 4;
  return from;
}

// ── AI helpers ────────────────────────────────────────────────────────────────

function problemScore(card: Card): number {
  if (card.suit === "spades") {
    if (card.rank === "A") return 200;
    if (card.rank === "K") return 180;
    if (card.rank === "Q") return 160;
  }
  if (card.suit === "hearts") return 100 + rankValue(card.rank as string);
  if (card.suit === "spades") return rankValue(card.rank as string);
  return 0;
}

function aiSelectCardsToPass(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => problemScore(b) - problemScore(a)).slice(0, 3);
}

function aiChooseCard(valid: Card[], trick: TrickPlay[], ledSuit: Suit | null): Card {
  if (trick.length === 0 || ledSuit === null) {
    const pool = valid.filter((c) => c.suit !== "hearts");
    const src = pool.length > 0 ? pool : valid;
    return src.reduce((b, c) => rankValue(c.rank as string) < rankValue(b.rank as string) ? c : b);
  }
  const canFollow = valid.some((c) => c.suit === ledSuit);
  if (canFollow) {
    const suit = valid.filter((c) => c.suit === ledSuit);
    let winV = -1;
    for (const p of trick) {
      if (p.card.suit === ledSuit) winV = Math.max(winV, rankValue(p.card.rank as string));
    }
    const losers = suit.filter((c) => rankValue(c.rank as string) < winV);
    const pool = losers.length > 0 ? losers : suit;
    const op = losers.length > 0 ? (a: Card, b: Card) => rankValue(b.rank as string) - rankValue(a.rank as string)
                                  : (a: Card, b: Card) => rankValue(a.rank as string) - rankValue(b.rank as string);
    return pool.reduce((best, c) => op(c, best) < 0 ? c : best);
  }
  const qs = valid.find((c) => c.suit === "spades" && c.rank === "Q");
  if (qs) return qs;
  const hearts = valid.filter((c) => c.suit === "hearts");
  if (hearts.length > 0)
    return hearts.reduce((b, c) => rankValue(c.rank as string) > rankValue(b.rank as string) ? c : b);
  return valid.reduce((b, c) => rankValue(c.rank as string) > rankValue(b.rank as string) ? c : b);
}

function applyHandScores(handScores: number[], cumulative: number[]): number[] {
  const moon = handScores.findIndex((s) => s === 26);
  if (moon !== -1) return cumulative.map((s, i) => (i === moon ? s : s + 26));
  return cumulative.map((s, i) => s + handScores[i]);
}

// ── State factory ─────────────────────────────────────────────────────────────

function makeInitialState(handNumber: number, prevScores: number[]): HeartsState {
  const deck = buildDeck();
  const hands = dealHands(deck, 4);
  const suitOrder: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  const sortHand = (hand: Card[]) =>
    [...hand].sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      return sd !== 0 ? sd : rankValue(a.rank as string) - rankValue(b.rank as string);
    });
  const dir = passDirection(handNumber);
  let trickLeader = 0;
  for (let i = 0; i < 4; i++) {
    if (hands[i].some((c) => c.suit === "clubs" && c.rank === "2")) { trickLeader = i; break; }
  }
  return {
    hands: hands.map(sortHand),
    scores: prevScores,
    handScores: [0, 0, 0, 0],
    phase: dir === "none" ? "playing" : "passing",
    passDir: dir,
    passedCards: [],
    receivedCards: [],
    currentTrick: [],
    ledSuit: null,
    trickLeader,
    currentPlayer: trickLeader,
    heartsAreBroken: false,
    isFirstTrick: true,
    tricksThisHand: 0,
    handNumber,
    selectedCard: null,
  };
}

function freshGame(): HeartsState { return makeInitialState(0, [0, 0, 0, 0]); }

// ── Fan helpers ───────────────────────────────────────────────────────────────

function fanAngle(idx: number, total: number): number {
  if (total <= 1) return 0;
  const mid = (total - 1) / 2;
  return ((idx - mid) / mid) * 11;
}

function handOverlap(count: number, cardW: number, maxW: number): number {
  if (count <= 1) return 0;
  return Math.max(0, Math.round((count * cardW - maxW) / (count - 1)));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface HeartsProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function Hearts({ settings, onNewGame, onQuit }: HeartsProps) {
  const [state, setState] = useState<HeartsState>(freshGame);
  const [appearance, setAppearance] = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [dealKey, setDealKey] = useState(0);
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);

  // Refs for flying card coordinate math
  const tableRef       = useRef<HTMLDivElement>(null);
  const northZoneRef   = useRef<HTMLDivElement>(null);
  const westZoneRef    = useRef<HTMLDivElement>(null);
  const eastZoneRef    = useRef<HTMLDivElement>(null);
  const humanCardRefs  = useRef<Map<string, HTMLDivElement>>(new Map());
  const trickSlotRefs  = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevTrickLen   = useRef(0);
  const aiTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHandNumRef = useRef(state.handNumber);

  // Increment dealKey when hand changes (triggers deal animation)
  useEffect(() => {
    if (state.handNumber !== prevHandNumRef.current) {
      prevHandNumRef.current = state.handNumber;
      setDealKey((k) => k + 1);
    }
  }, [state.handNumber]);

  // Clear flying cards on new deal
  useEffect(() => {
    setFlyingCards([]);
    prevTrickLen.current = 0;
  }, [dealKey]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const { hands, scores, handScores, phase, passDir, passedCards, receivedCards,
    currentTrick, ledSuit, currentPlayer,
    heartsAreBroken, isFirstTrick, tricksThisHand, handNumber, selectedCard } = state;

  const humanHand   = hands[0];
  const isHumanTurn = phase === "playing" && currentPlayer === 0;
  const validPlays  = isHumanTurn
    ? getValidHeartPlays(humanHand, ledSuit, heartsAreBroken, isFirstTrick)
    : [];
  const validIds = new Set<string>(validPlays.map((c) => c.id));

  // ── Flying card launcher ───────────────────────────────────────────────────

  const launchCard = useCallback((
    card: Card,
    fromEl: HTMLElement | null,
    toSlotPlayer: number,
    doFlip: boolean,
    sm: boolean,
  ) => {
    const toEl = trickSlotRefs.current.get(toSlotPlayer) ?? null;
    if (!tableRef.current || !fromEl || !toEl) return;
    const tr  = tableRef.current.getBoundingClientRect();
    const fr  = fromEl.getBoundingClientRect();
    const tor = toEl.getBoundingClientRect();
    setFlyingCards((prev) => [...prev, {
      id: `fly-${card.id}-${Date.now()}`,
      card,
      fromX: fr.left  - tr.left + fr.width  / 2,
      fromY: fr.top   - tr.top  + fr.height / 2,
      toX:  tor.left  - tr.left + tor.width  / 2,
      toY:  tor.top   - tr.top  + tor.height / 2,
      landAngle: (Math.random() - 0.5) * 24,
      doFlip,
      sm,
    }]);
  }, []);

  // Detect AI card plays and launch flying card
  useEffect(() => {
    if (currentTrick.length === 0) { prevTrickLen.current = 0; return; }
    if (currentTrick.length <= prevTrickLen.current) return;
    const latest = currentTrick[currentTrick.length - 1];
    if (latest.playerIndex !== 0) {
      const pi = latest.playerIndex;
      const fromEl = pi === 1 ? westZoneRef.current
                   : pi === 2 ? northZoneRef.current
                   : eastZoneRef.current;
      launchCard(latest.card, fromEl, pi, true, true);
    }
    prevTrickLen.current = currentTrick.length;
  }, [currentTrick, launchCard]);

  // ── Pass phase ─────────────────────────────────────────────────────────────

  const togglePassCard = useCallback((cardId: string) => {
    if (phase !== "passing") return;
    setState((s) => {
      const already = s.passedCards.find((c) => c.id === cardId);
      if (already) return { ...s, passedCards: s.passedCards.filter((c) => c.id !== cardId) };
      if (s.passedCards.length >= 3) return s;
      const card = s.hands[0].find((c) => c.id === cardId);
      if (!card) return s;
      return { ...s, passedCards: [...s.passedCards, card] };
    });
  }, [phase]);

  const confirmPass = useCallback(() => {
    setState((s) => {
      if (s.passedCards.length !== 3) return s;
      const aiPasses: Card[][] = [s.passedCards, [], [], []];
      for (let i = 1; i < 4; i++) aiPasses[i] = aiSelectCardsToPass(s.hands[i]);
      const newHands = s.hands.map((h) => [...h]);
      for (let from = 0; from < 4; from++) {
        const to = passTarget(from, s.passDir);
        if (to === from) continue;
        newHands[from] = newHands[from].filter((c) => !aiPasses[from].some((p) => p.id === c.id));
        newHands[to] = [...newHands[to], ...aiPasses[from]];
      }
      const suitOrder: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
      const sort = (h: Card[]) => [...h].sort((a, b) => {
        const sd = suitOrder[a.suit] - suitOrder[b.suit];
        return sd !== 0 ? sd : rankValue(a.rank as string) - rankValue(b.rank as string);
      });
      const sorted = newHands.map(sort);
      let trickLeader = 0;
      for (let i = 0; i < 4; i++) {
        if (sorted[i].some((c) => c.suit === "clubs" && c.rank === "2")) { trickLeader = i; break; }
      }
      const received = Array.from({ length: 4 }, (_, from) =>
        passTarget(from, s.passDir) === 0 && from !== 0 ? aiPasses[from] : []
      ).flat();
      return {
        ...s, hands: sorted, phase: "playing", passedCards: [], receivedCards: received,
        trickLeader, currentPlayer: trickLeader, currentTrick: [], ledSuit: null,
      };
    });
  }, []);

  // ── Play a card ────────────────────────────────────────────────────────────

  const playCard = useCallback((playerIndex: number, card: Card) => {
    setState((s) => {
      if (s.phase !== "playing" || s.currentPlayer !== playerIndex) return s;
      const valid = getValidHeartPlays(s.hands[playerIndex], s.ledSuit, s.heartsAreBroken, s.isFirstTrick);
      if (!valid.some((c) => c.id === card.id)) return s;

      const newTrick: TrickPlay[] = [...s.currentTrick, { playerIndex, card }];
      const newHands = s.hands.map((h, i) => i === playerIndex ? h.filter((c) => c.id !== card.id) : h);
      const newLed: Suit | null = s.currentTrick.length === 0 ? (card.suit as Suit) : s.ledSuit;
      const newBroken = s.heartsAreBroken || card.suit === "hearts";

      if (newTrick.length < 4) {
        return { ...s, hands: newHands, currentTrick: newTrick, ledSuit: newLed,
          currentPlayer: (playerIndex + 1) % 4, heartsAreBroken: newBroken, selectedCard: null };
      }

      const winner = resolveTrick(newTrick, newLed!);
      const pts = trickPoints(newTrick.map((p) => p.card));
      const newHandScores = s.handScores.map((hs, i) => i === winner ? hs + pts : hs);
      const newTricks = s.tricksThisHand + 1;

      if (newTricks === 13) {
        const newCum = applyHandScores(newHandScores, s.scores);
        return {
          ...s, hands: newHands, handScores: newHandScores, scores: newCum,
          currentTrick: newTrick, ledSuit: newLed, heartsAreBroken: newBroken,
          isFirstTrick: false, tricksThisHand: newTricks, currentPlayer: winner,
          trickLeader: winner, phase: newCum.some((sc) => sc >= 100) ? "game-over" : "hand-end",
          selectedCard: null,
        };
      }
      return {
        ...s, hands: newHands, handScores: newHandScores, currentTrick: newTrick,
        ledSuit: newLed, heartsAreBroken: newBroken, isFirstTrick: false,
        tricksThisHand: newTricks, currentPlayer: winner, trickLeader: winner,
        phase: "trick-end", selectedCard: null,
      };
    });
  }, []);

  // ── Human card click ───────────────────────────────────────────────────────

  const handleCardClick = useCallback((card: Card) => {
    if (phase === "passing") { togglePassCard(card.id); return; }
    if (!isHumanTurn || !validIds.has(card.id)) return;
    if (selectedCard === card.id) {
      // Launch flying card before state update so ref is still in DOM
      launchCard(card, humanCardRefs.current.get(card.id) ?? null, 0, false, false);
      playCard(0, card);
    } else {
      setState((s) => ({ ...s, selectedCard: card.id }));
    }
  }, [phase, isHumanTurn, validIds, selectedCard, togglePassCard, playCard, launchCard]);

  // ── Trick-end pause ────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "trick-end") return;
    const t = setTimeout(() => {
      setState((s) => s.phase !== "trick-end" ? s
        : { ...s, phase: "playing", currentTrick: [], ledSuit: null });
    }, 900);
    return () => clearTimeout(t);
  }, [phase, tricksThisHand]);

  // ── AI turns ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing" || currentPlayer === 0) return;
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "playing" || s.currentPlayer === 0) return s;
        const ai = s.currentPlayer;
        const valid = getValidHeartPlays(s.hands[ai], s.ledSuit, s.heartsAreBroken, s.isFirstTrick);
        if (valid.length === 0) return s;
        const chosen = aiChooseCard(valid, s.currentTrick, s.ledSuit);
        const newTrick: TrickPlay[] = [...s.currentTrick, { playerIndex: ai, card: chosen }];
        const newHands = s.hands.map((h, i) => i === ai ? h.filter((c) => c.id !== chosen.id) : h);
        const newLed: Suit | null = s.currentTrick.length === 0 ? (chosen.suit as Suit) : s.ledSuit;
        const newBroken = s.heartsAreBroken || chosen.suit === "hearts";
        if (newTrick.length < 4)
          return { ...s, hands: newHands, currentTrick: newTrick, ledSuit: newLed,
            currentPlayer: (ai + 1) % 4, heartsAreBroken: newBroken };
        const winner = resolveTrick(newTrick, newLed!);
        const pts = trickPoints(newTrick.map((p) => p.card));
        const newHS = s.handScores.map((hs, i) => i === winner ? hs + pts : hs);
        const newT = s.tricksThisHand + 1;
        if (newT === 13) {
          const newCum = applyHandScores(newHS, s.scores);
          return { ...s, hands: newHands, handScores: newHS, scores: newCum,
            currentTrick: newTrick, ledSuit: newLed, heartsAreBroken: newBroken,
            isFirstTrick: false, tricksThisHand: newT, currentPlayer: winner, trickLeader: winner,
            phase: newCum.some((sc) => sc >= 100) ? "game-over" : "hand-end" };
        }
        return { ...s, hands: newHands, handScores: newHS, currentTrick: newTrick,
          ledSuit: newLed, heartsAreBroken: newBroken, isFirstTrick: false,
          tricksThisHand: newT, currentPlayer: winner, trickLeader: winner, phase: "trick-end" };
      });
    }, 600);
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  }, [phase, currentPlayer, tricksThisHand]);

  // ── Between-hand ───────────────────────────────────────────────────────────

  const startNextHand = useCallback(() => {
    setState((s) => makeInitialState(s.handNumber + 1, s.scores));
  }, []);

  const startNewGame = useCallback(() => { setState(freshGame()); }, []);

  // ── Menus ──────────────────────────────────────────────────────────────────

  const heartsMenus = useMemo<MenuBarMenu[]>(() => ([
    { label: "Game", items: [
      { label: "New Hand", onClick: startNextHand },
      { label: "Show Scores", onClick: () => setShowScores(true) },
      { separator: true },
      ...(onNewGame ? [{ label: "New Game", onClick: onNewGame }] : []),
      ...(onQuit    ? [{ label: "Exit",     onClick: onQuit    }] : []),
    ]},
    { label: "Options", items: [
      { label: "Card Appearance…", onClick: () => setShowDeckModal(true) },
    ]},
  ]), [startNextHand, onNewGame, onQuit]);

  useWindowMenus(heartsMenus);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function trickCardFor(pi: number): Card | null {
    return currentTrick.find((p) => p.playerIndex === pi)?.card ?? null;
  }
  function passLabel(): string {
    if (passDir === "left")   return "→ Pass Left";
    if (passDir === "right")  return "← Pass Right";
    if (passDir === "across") return "↑ Pass Across";
    return "";
  }

  const passTargetName     = passDir !== "none" ? PLAYER_NAMES[passTarget(0, passDir)] : "";
  const gameOverWinnerIdx  = state.scores.indexOf(Math.min(...state.scores));
  const hOverlap           = handOverlap(humanHand.length, 72, 300);
  const nOverlap           = handOverlap(hands[2].length, 52, 280);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="hearts">
      {showDeckModal && (
        <DeckModal appearance={appearance} onUpdate={setAppearance} onClose={() => setShowDeckModal(false)} />
      )}

      {/* Score / hand-end modal */}
      {(phase === "hand-end" || phase === "game-over" || showScores) && (
        <div className="hearts-modal-overlay" onClick={showScores ? () => setShowScores(false) : undefined}>
          <div className="hearts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hearts-modal__titlebar">
              <span>{phase === "game-over" ? "Game Over" : showScores ? "Scores" : "Hand Results"}</span>
              {showScores && (
                <button className="hearts-modal__close" onClick={() => setShowScores(false)} aria-label="Close">✕</button>
              )}
            </div>
            <div className="hearts-modal__body">
              <table className="hearts-modal__table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {(phase === "hand-end" || phase === "game-over") && <th>This Hand</th>}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAYER_NAMES.map((name, i) => (
                    <tr key={i} className={phase === "game-over" && i === gameOverWinnerIdx ? "hearts-modal__winner-row" : ""}>
                      <td>{name}</td>
                      {(phase === "hand-end" || phase === "game-over") && (
                        <td className={handScores[i] === 26 ? "hearts-modal__moon" : ""}>
                          {handScores[i] === 26 ? "🌙" : `+${handScores[i]}`}
                        </td>
                      )}
                      <td>{scores[i]}</td>
                      {phase === "game-over" && i === gameOverWinnerIdx && (
                        <td className="hearts-modal__winner-label">WINNER</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hearts-modal__footer">
              {phase === "game-over" ? (
                <>
                  {onNewGame && <button className="hearts-btn hearts-btn--primary" onClick={onNewGame}>Choose Game</button>}
                  <button className="hearts-btn hearts-btn--primary" onClick={startNewGame}>Play Again</button>
                </>
              ) : !showScores ? (
                <button className="hearts-btn hearts-btn--primary" onClick={startNextHand}>Continue →</button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="hearts__table" ref={tableRef}>

        {/* Flying card overlays */}
        {flyingCards.map((fc) => {
          const cw = fc.sm ? 52 : 72;
          const ch = fc.sm ? 72 : 100;
          return (
            <div
              key={fc.id}
              className="hearts__flying-card"
              style={{
                width: cw,
                height: ch,
                "--from-tx": `${fc.fromX - cw / 2}px`,
                "--from-ty": `${fc.fromY - ch / 2}px`,
                "--to-tx":   `${fc.toX   - cw / 2}px`,
                "--to-ty":   `${fc.toY   - ch / 2}px`,
                "--land-angle": `${fc.landAngle}deg`,
              } as React.CSSProperties}
              onAnimationEnd={(e: React.AnimationEvent<HTMLDivElement>) => {
                if (e.animationName === "hearts-fly-card")
                  setFlyingCards((prev) => prev.filter((f) => f.id !== fc.id));
              }}
            >
              {fc.doFlip ? (
                <div className="hearts__fcard-flipper">
                  <div className="hearts__fcard-back">
                    <PlayingCard card={fc.card} faceDown appearance={appearance} size={fc.sm ? "sm" : undefined} />
                  </div>
                  <div className="hearts__fcard-front">
                    <PlayingCard card={fc.card} appearance={appearance} size={fc.sm ? "sm" : undefined} />
                  </div>
                </div>
              ) : (
                <PlayingCard card={fc.card} appearance={appearance} size={fc.sm ? "sm" : undefined} />
              )}
            </div>
          );
        })}

        {/* North AI */}
        <div className="hearts__zone hearts__zone--north" ref={northZoneRef}>
          <div className="hearts__player-label hearts__player-label--ai">
            {PLAYER_NAMES[2]}
            {currentPlayer === 2 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[2] > 0 && <span className="hearts__hand-score-badge">{handScores[2]}pt</span>}
          </div>
          <div className="hearts__ai-fan hearts__ai-fan--horiz"
            style={{ "--ai-overlap": `${nOverlap}px` } as React.CSSProperties}>
            {hands[2].map((card, idx) => (
              <PlayingCard key={`n-${dealKey}-${card.id}`} card={card} faceDown
                appearance={appearance} size="sm" dealIndex={idx} />
            ))}
          </div>
        </div>

        {/* West AI */}
        <div className="hearts__zone hearts__zone--west" ref={westZoneRef}>
          <div className="hearts__player-label hearts__player-label--ai hearts__player-label--side">
            {PLAYER_NAMES[1]}
            {currentPlayer === 1 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[1] > 0 && <span className="hearts__hand-score-badge">{handScores[1]}pt</span>}
          </div>
          <div className="hearts__ai-fan hearts__ai-fan--vert">
            {hands[1].slice(0, 8).map((card, idx) => (
              <PlayingCard key={`w-${dealKey}-${card.id}`} card={card} faceDown
                appearance={appearance} size="sm" dealIndex={idx} />
            ))}
            {hands[1].length > 8 && <div className="hearts__ai-extra">+{hands[1].length - 8}</div>}
          </div>
        </div>

        {/* Trick area */}
        <div className="hearts__trick-area">
          <div className="hearts__trick-slot hearts__trick-slot--n"
            ref={(el) => { if (el) trickSlotRefs.current.set(2, el); }}>
            {trickCardFor(2) && (
              <div key={trickCardFor(2)!.id} className="hearts__trick-card">
                <PlayingCard card={trickCardFor(2)!} appearance={appearance} size="sm" />
              </div>
            )}
          </div>
          <div className="hearts__trick-slot hearts__trick-slot--w"
            ref={(el) => { if (el) trickSlotRefs.current.set(1, el); }}>
            {trickCardFor(1) && (
              <div key={trickCardFor(1)!.id} className="hearts__trick-card">
                <PlayingCard card={trickCardFor(1)!} appearance={appearance} size="sm" />
              </div>
            )}
          </div>
          <div className="hearts__trick-center-info">
            {(phase === "playing" || phase === "trick-end") && (
              <span className="hearts__trick-count">{tricksThisHand}/13</span>
            )}
            {heartsAreBroken && <span className="hearts__broken">♥</span>}
          </div>
          <div className="hearts__trick-slot hearts__trick-slot--e"
            ref={(el) => { if (el) trickSlotRefs.current.set(3, el); }}>
            {trickCardFor(3) && (
              <div key={trickCardFor(3)!.id} className="hearts__trick-card">
                <PlayingCard card={trickCardFor(3)!} appearance={appearance} size="sm" />
              </div>
            )}
          </div>
          <div className="hearts__trick-slot hearts__trick-slot--s"
            ref={(el) => { if (el) trickSlotRefs.current.set(0, el); }}>
            {trickCardFor(0) && (
              <div key={trickCardFor(0)!.id} className="hearts__trick-card">
                <PlayingCard card={trickCardFor(0)!} appearance={appearance} size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* East AI */}
        <div className="hearts__zone hearts__zone--east" ref={eastZoneRef}>
          <div className="hearts__player-label hearts__player-label--ai hearts__player-label--side">
            {PLAYER_NAMES[3]}
            {currentPlayer === 3 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[3] > 0 && <span className="hearts__hand-score-badge">{handScores[3]}pt</span>}
          </div>
          <div className="hearts__ai-fan hearts__ai-fan--vert">
            {hands[3].slice(0, 8).map((card, idx) => (
              <PlayingCard key={`e-${dealKey}-${card.id}`} card={card} faceDown
                appearance={appearance} size="sm" dealIndex={idx} />
            ))}
            {hands[3].length > 8 && <div className="hearts__ai-extra">+{hands[3].length - 8}</div>}
          </div>
        </div>

        {/* South — human */}
        <div className="hearts__zone hearts__zone--south">
          <div className="hearts__player-label">
            {PLAYER_NAMES[0]}
            {isHumanTurn && phase === "playing" && <span className="hearts__turn-dot hearts__turn-dot--human" />}
            <span className="hearts__score-inline">{scores[0]}pts</span>
          </div>

          {phase === "passing" && (
            <div className="hearts__pass-hint">
              Select 3 to pass to {passTargetName}
              {passedCards.length > 0 && ` (${passedCards.length}/3)`}
            </div>
          )}

          <div
            className={`hearts__human-hand${phase === "passing" ? " hearts__human-hand--passing" : ""}`}
            style={{ "--hand-overlap": `${hOverlap}px` } as React.CSSProperties}
          >
            {humanHand.map((card, idx) => {
              const angle = fanAngle(idx, humanHand.length);
              const isSelected = phase === "passing"
                ? passedCards.some((c) => c.id === card.id)
                : selectedCard === card.id;
              const isValid    = phase === "playing" && isHumanTurn && validIds.has(card.id);
              const isPlayable = phase === "passing" || isValid;
              const hasReceived = receivedCards.some((c) => c.id === card.id);
              return (
                <div
                  key={`h-${dealKey}-${card.id}`}
                  ref={(el) => { if (el) humanCardRefs.current.set(card.id, el); else humanCardRefs.current.delete(card.id); }}
                  className={[
                    "hearts__fan-item",
                    isSelected  ? "hearts__fan-item--selected"  : "",
                    isValid && !isSelected ? "hearts__fan-item--valid" : "",
                    isPlayable  ? "hearts__fan-item--clickable" : "",
                    hasReceived ? "hearts__fan-item--received"  : "",
                  ].filter(Boolean).join(" ")}
                  style={{
                    "--fan-angle": `${angle}deg`,
                    "--fan-i": idx,
                    zIndex: isSelected ? 20 : idx + 1,
                  } as React.CSSProperties}
                  onClick={() => handleCardClick(card)}
                >
                  <PlayingCard card={card} appearance={appearance} />
                </div>
              );
            })}
          </div>

          {phase === "passing" && passedCards.length === 3 && (
            <div className="hearts__pass-actions">
              <button className="hearts-btn hearts-btn--primary" onClick={confirmPass}>{passLabel()} →</button>
            </div>
          )}
          {phase === "playing" && isHumanTurn && selectedCard && (
            <div className="hearts__play-hint">Click again to play</div>
          )}
          {phase === "playing" && !isHumanTurn && currentPlayer !== 0 && (
            <div className="hearts__play-hint">{PLAYER_NAMES[currentPlayer]}{"'s turn..."}</div>
          )}
        </div>

      </div>

      {/* Status bar */}
      <div className="hearts__status-bar">
        <span>Hand {handNumber + 1} · Trick {Math.min(tricksThisHand + 1, 13)}/13 · Pass: {passDir === "none" ? "None" : passDir}</span>
        <span className="hearts__scores-row">
          {PLAYER_NAMES.map((name, i) => (
            <span key={i} className="hearts__score-item">{name}: {scores[i]}</span>
          ))}
        </span>
        <button className="hearts-btn hearts-btn--sm" onClick={() => setShowScores(true)}>Scores</button>
      </div>
    </div>
  );
}
