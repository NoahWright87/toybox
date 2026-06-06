import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Hearts.css";
import "./Cards.css";
import { PermCard } from "./PermCard";
import { CardStack } from "./cardStack";
import type { CardVisualState } from "./cardStack";
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

// ── Stage layout ──────────────────────────────────────────────────────────────

const STAGE_W = 480;
const STAGE_H = 500;

// Hand fan centers (card center x/y)
const HAND_CX = [240, 240,  40, 440] as const;  // [human, north, west, east]
const HAND_CY = [460,  52, 258, 258] as const;

// Where a played card lands in the trick area
const TRICK_X = [240, 152, 240, 328] as const;  // indexed by playerIndex
const TRICK_Y = [352, 258, 168, 258] as const;

// Off-screen pile per player (won tricks fly here)
const PILE_X = [240,  -80, 240, 560] as const;
const PILE_Y = [620,  258,  -80, 258] as const;

// ── Deck helpers ──────────────────────────────────────────────────────────────

const RANKS_ORD = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;
const ALL_SUITS: Suit[] = ["spades","hearts","diamonds","clubs"];

// Stable 52-card array — IDs are always "suit-rank", same every hand.
const FIXED_DECK: Card[] = ALL_SUITS.flatMap(suit =>
  RANKS_ORD.map(rank => ({ suit, rank, id: `${suit}-${rank}` }))
);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] { return shuffle(FIXED_DECK); }

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

const PLAYER_NAMES = ["You", "West", "North", "East"];

function passDirection(handNumber: number): PassDir {
  const dirs: PassDir[] = ["left","right","across","none"];
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
    const pool = valid.filter(c => c.suit !== "hearts");
    const src  = pool.length > 0 ? pool : valid;
    return src.reduce((b, c) => rankValue(c.rank as string) < rankValue(b.rank as string) ? c : b);
  }
  const canFollow = valid.some(c => c.suit === ledSuit);
  if (canFollow) {
    const suit  = valid.filter(c => c.suit === ledSuit);
    let winV    = -1;
    for (const p of trick) if (p.card.suit === ledSuit) winV = Math.max(winV, rankValue(p.card.rank as string));
    const losers = suit.filter(c => rankValue(c.rank as string) < winV);
    const pool   = losers.length > 0 ? losers : suit;
    const op     = losers.length > 0
      ? (a: Card, b: Card) => rankValue(b.rank as string) - rankValue(a.rank as string)
      : (a: Card, b: Card) => rankValue(a.rank as string) - rankValue(b.rank as string);
    return pool.reduce((best, c) => op(c, best) < 0 ? c : best);
  }
  const qs = valid.find(c => c.suit === "spades" && c.rank === "Q");
  if (qs) return qs;
  const hearts = valid.filter(c => c.suit === "hearts");
  if (hearts.length > 0)
    return hearts.reduce((b, c) => rankValue(c.rank as string) > rankValue(b.rank as string) ? c : b);
  return valid.reduce((b, c) => rankValue(c.rank as string) > rankValue(b.rank as string) ? c : b);
}

function applyHandScores(handScores: number[], cumulative: number[]): number[] {
  const moon = handScores.findIndex(s => s === 26);
  if (moon !== -1) return cumulative.map((s, i) => i === moon ? s : s + 26);
  return cumulative.map((s, i) => s + handScores[i]);
}

// ── State factory ─────────────────────────────────────────────────────────────

function makeInitialState(handNumber: number, prevScores: number[]): HeartsState {
  const deck  = buildDeck();
  const hands = dealHands(deck, 4);
  const suitOrder: Record<string,number> = { spades:0, hearts:1, diamonds:2, clubs:3 };
  const sortHand = (hand: Card[]) =>
    [...hand].sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      return sd !== 0 ? sd : rankValue(a.rank as string) - rankValue(b.rank as string);
    });
  const dir = passDirection(handNumber);
  let trickLeader = 0;
  for (let i = 0; i < 4; i++) {
    if (hands[i].some(c => c.suit === "clubs" && c.rank === "2")) { trickLeader = i; break; }
  }
  return {
    hands: hands.map(sortHand),
    scores: prevScores,
    handScores: [0,0,0,0],
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

function freshGame(): HeartsState { return makeInitialState(0, [0,0,0,0]); }

// ── Component ─────────────────────────────────────────────────────────────────

interface HeartsProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function Hearts({ settings, onNewGame, onQuit }: HeartsProps) {
  const [state,         setState]        = useState<HeartsState>(freshGame);
  const [cardStates,    setCardStates]   = useState<Record<string, CardVisualState>>({});
  const [appearance,    setAppearance]   = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showScores,    setShowScores]   = useState(false);
  const [scale,         setScale]        = useState(1);

  const containerRef  = useRef<HTMLDivElement>(null);
  const aiTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHandNum   = useRef(-1);
  const wonByRef      = useRef<Record<string, number>>({});  // cardId → winning playerIndex

  // ── CardStack refs for the 4 hands ────────────────────────────────────────
  // Player 0 (human): horizontal fan, centered, with arc
  // Player 1 (west):  vertical fan, all cards rotated 90°
  // Player 2 (north): horizontal fan, centered, flat
  // Player 3 (east):  vertical fan, all cards rotated -90°
  const handSt = useRef([
    new CardStack({ zTier:15, baseX:HAND_CX[0], baseY:HAND_CY[0], offsetX:28,  centered:true, startRotation:-9,  endRotation:9   }),
    new CardStack({ zTier:12, baseX:HAND_CX[2], baseY:HAND_CY[2], offsetY:16,  centered:true, startRotation:90,  endRotation:90  }),
    new CardStack({ zTier:11, baseX:HAND_CX[1], baseY:HAND_CY[1], offsetX:20,  centered:true, startRotation:0,   endRotation:0   }),
    new CardStack({ zTier:13, baseX:HAND_CX[3], baseY:HAND_CY[3], offsetY:16,  centered:true, startRotation:-90, endRotation:-90 }),
  ]);

  // ── Scale observer ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      setScale(Math.min(1, width / STAGE_W, height / STAGE_H));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Position computation ──────────────────────────────────────────────────

  function computePositions(s: HeartsState, ms: number): Record<string, CardVisualState> {
    // Rebuild hand stacks from current game state.
    // handSt index order: [0=human, 1=west, 2=north, 3=east]
    // Maps to player index: human=0, west=1, north=2, east=3
    const playerToStack = [0, 1, 2, 3]; // player i → handSt[playerToStack[i]]
    for (const pi of playerToStack) {
      handSt.current[pi].clear();
      for (const c of s.hands[pi]) {
        handSt.current[pi].addCard(c, { toTop: true, faceDown: pi !== 0 });
      }
    }

    const result: Record<string, CardVisualState> = {};

    // Hand positions
    for (const st of handSt.current) Object.assign(result, st.layout(ms));

    // Trick slot positions
    for (const play of s.currentTrick) {
      const pi = play.playerIndex;
      result[play.card.id] = {
        x: TRICK_X[pi], y: TRICK_Y[pi],
        z: 5000 + pi, rotation: 0, faceDown: false, transitionMs: ms,
      };
    }

    // Won cards → off-screen pile (skip if still in current trick during pause)
    for (const [cardId, winnerIdxRaw] of Object.entries(wonByRef.current)) {
      const winnerIdx = winnerIdxRaw as number;
      if (!s.currentTrick.some(p => p.card.id === cardId)) {
        result[cardId] = {
          x: PILE_X[winnerIdx], y: PILE_Y[winnerIdx],
          z: 50 + winnerIdx, rotation: 0, faceDown: false, transitionMs: ms,
        };
      }
    }

    // Selected card lift (playing phase)
    if (s.selectedCard && result[s.selectedCard]) {
      result[s.selectedCard] = { ...result[s.selectedCard], y: result[s.selectedCard].y - 22 };
    }

    // Pass-selected cards lift
    if (s.phase === "passing") {
      for (const c of s.passedCards) {
        if (result[c.id]) result[c.id] = { ...result[c.id], y: result[c.id].y - 22 };
      }
    }

    return result;
  }

  // ── Track trick winners (for off-screen pile positioning) ─────────────────

  useEffect(() => {
    if (state.currentTrick.length !== 4) return;
    // trickLeader is updated to the winner in the same state update as the 4th play
    const winner = state.trickLeader;
    for (const play of state.currentTrick) wonByRef.current[play.card.id] = winner;
  }, [state.currentTrick, state.trickLeader]);

  // ── Main position sync: fires on every state change ───────────────────────

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (prevHandNum.current !== state.handNumber) {
      // New hand: reset won pile, deal animation
      prevHandNum.current = state.handNumber;
      wonByRef.current = {};

      // Phase 1: all cards to deck position (no transition)
      const init: Record<string, CardVisualState> = {};
      for (const c of FIXED_DECK) {
        init[c.id] = { x: STAGE_W / 2, y: -80, z: 500, rotation: 0, faceDown: true, transitionMs: 0 };
      }
      setCardStates(init);

      // Phase 2: deal to hands with stagger
      const t = setTimeout(() => {
        const positions = computePositions(state, 320);
        for (let p = 0; p < 4; p++) {
          state.hands[p].forEach((c, idx) => {
            const pos = positions[c.id];
            if (pos) positions[c.id] = { ...pos, transitionDelay: (p * 13 + idx) * 18 };
          });
        }
        setCardStates(positions);
      }, 80);

      cleanup = () => clearTimeout(t);
    } else {
      setCardStates(computePositions(state, 200));
    }

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ── Pass phase ─────────────────────────────────────────────────────────────

  const togglePassCard = useCallback((cardId: string) => {
    if (state.phase !== "passing") return;
    setState(s => {
      const already = s.passedCards.find(c => c.id === cardId);
      if (already) return { ...s, passedCards: s.passedCards.filter(c => c.id !== cardId) };
      if (s.passedCards.length >= 3) return s;
      const card = s.hands[0].find(c => c.id === cardId);
      if (!card) return s;
      return { ...s, passedCards: [...s.passedCards, card] };
    });
  }, [state.phase]);

  const confirmPass = useCallback(() => {
    setState(s => {
      if (s.passedCards.length !== 3) return s;
      const aiPasses: Card[][] = [s.passedCards, [], [], []];
      for (let i = 1; i < 4; i++) aiPasses[i] = aiSelectCardsToPass(s.hands[i]);
      const newHands = s.hands.map(h => [...h]);
      for (let from = 0; from < 4; from++) {
        const to = passTarget(from, s.passDir);
        if (to === from) continue;
        newHands[from] = newHands[from].filter(c => !aiPasses[from].some(p => p.id === c.id));
        newHands[to]   = [...newHands[to], ...aiPasses[from]];
      }
      const suitOrder: Record<string,number> = { spades:0, hearts:1, diamonds:2, clubs:3 };
      const sort = (h: Card[]) => [...h].sort((a, b) => {
        const sd = suitOrder[a.suit] - suitOrder[b.suit];
        return sd !== 0 ? sd : rankValue(a.rank as string) - rankValue(b.rank as string);
      });
      const sorted = newHands.map(sort);
      let trickLeader = 0;
      for (let i = 0; i < 4; i++) {
        if (sorted[i].some(c => c.suit === "clubs" && c.rank === "2")) { trickLeader = i; break; }
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
    setState(s => {
      if (s.phase !== "playing" || s.currentPlayer !== playerIndex) return s;
      const valid = getValidHeartPlays(s.hands[playerIndex], s.ledSuit, s.heartsAreBroken, s.isFirstTrick);
      if (!valid.some(c => c.id === card.id)) return s;

      const newTrick: TrickPlay[] = [...s.currentTrick, { playerIndex, card }];
      const newHands  = s.hands.map((h, i) => i === playerIndex ? h.filter(c => c.id !== card.id) : h);
      const newLed: Suit | null = s.currentTrick.length === 0 ? (card.suit as Suit) : s.ledSuit;
      const newBroken = s.heartsAreBroken || card.suit === "hearts";

      if (newTrick.length < 4) {
        return { ...s, hands: newHands, currentTrick: newTrick, ledSuit: newLed,
          currentPlayer: (playerIndex + 1) % 4, heartsAreBroken: newBroken, selectedCard: null };
      }

      const winner    = resolveTrick(newTrick, newLed!);
      const pts       = trickPoints(newTrick.map(p => p.card));
      const newHS     = s.handScores.map((hs, i) => i === winner ? hs + pts : hs);
      const newTricks = s.tricksThisHand + 1;

      if (newTricks === 13) {
        const newCum = applyHandScores(newHS, s.scores);
        return {
          ...s, hands: newHands, handScores: newHS, scores: newCum,
          currentTrick: newTrick, ledSuit: newLed, heartsAreBroken: newBroken,
          isFirstTrick: false, tricksThisHand: newTricks, currentPlayer: winner,
          trickLeader: winner, phase: newCum.some(sc => sc >= 100) ? "game-over" : "hand-end",
          selectedCard: null,
        };
      }
      return {
        ...s, hands: newHands, handScores: newHS, currentTrick: newTrick,
        ledSuit: newLed, heartsAreBroken: newBroken, isFirstTrick: false,
        tricksThisHand: newTricks, currentPlayer: winner, trickLeader: winner,
        phase: "trick-end", selectedCard: null,
      };
    });
  }, []);

  // ── Human card click ───────────────────────────────────────────────────────

  const { phase, currentPlayer, hands, scores, handScores, passDir, passedCards,
    receivedCards, ledSuit, heartsAreBroken, isFirstTrick,
    tricksThisHand, handNumber, selectedCard } = state;

  const isHumanTurn = phase === "playing" && currentPlayer === 0;
  const validPlays  = isHumanTurn
    ? getValidHeartPlays(hands[0], ledSuit, heartsAreBroken, isFirstTrick)
    : [];
  const validIds    = useMemo(() => new Set(validPlays.map(c => c.id)), [validPlays]);
  const receivedIds = useMemo(() => new Set(receivedCards.map(c => c.id)), [receivedCards]);

  const handleCardClick = useCallback((card: Card) => {
    if (phase === "passing") { togglePassCard(card.id); return; }
    if (!isHumanTurn || !validIds.has(card.id)) return;
    if (selectedCard === card.id) {
      playCard(0, card);
    } else {
      setState(s => ({ ...s, selectedCard: card.id }));
    }
  }, [phase, isHumanTurn, validIds, selectedCard, togglePassCard, playCard]);

  // ── Trick-end pause ────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "trick-end") return;
    const t = setTimeout(() => {
      setState(s => s.phase !== "trick-end" ? s
        : { ...s, phase: "playing", currentTrick: [], ledSuit: null });
    }, 900);
    return () => clearTimeout(t);
  }, [phase, tricksThisHand]);

  // ── AI turns ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing" || currentPlayer === 0) return;
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      setState(s => {
        if (s.phase !== "playing" || s.currentPlayer === 0) return s;
        const ai    = s.currentPlayer;
        const valid = getValidHeartPlays(s.hands[ai], s.ledSuit, s.heartsAreBroken, s.isFirstTrick);
        if (valid.length === 0) return s;
        const chosen  = aiChooseCard(valid, s.currentTrick, s.ledSuit);
        const newTrick: TrickPlay[] = [...s.currentTrick, { playerIndex: ai, card: chosen }];
        const newHands = s.hands.map((h, i) => i === ai ? h.filter(c => c.id !== chosen.id) : h);
        const newLed: Suit | null = s.currentTrick.length === 0 ? (chosen.suit as Suit) : s.ledSuit;
        const newBroken = s.heartsAreBroken || chosen.suit === "hearts";
        if (newTrick.length < 4)
          return { ...s, hands: newHands, currentTrick: newTrick, ledSuit: newLed,
            currentPlayer: (ai + 1) % 4, heartsAreBroken: newBroken };
        const winner = resolveTrick(newTrick, newLed!);
        const pts    = trickPoints(newTrick.map(p => p.card));
        const newHS  = s.handScores.map((hs, i) => i === winner ? hs + pts : hs);
        const newT   = s.tricksThisHand + 1;
        if (newT === 13) {
          const newCum = applyHandScores(newHS, s.scores);
          return { ...s, hands: newHands, handScores: newHS, scores: newCum,
            currentTrick: newTrick, ledSuit: newLed, heartsAreBroken: newBroken,
            isFirstTrick: false, tricksThisHand: newT, currentPlayer: winner,
            trickLeader: winner, phase: newCum.some(sc => sc >= 100) ? "game-over" : "hand-end" };
        }
        return { ...s, hands: newHands, handScores: newHS, currentTrick: newTrick,
          ledSuit: newLed, heartsAreBroken: newBroken, isFirstTrick: false,
          tricksThisHand: newT, currentPlayer: winner, trickLeader: winner, phase: "trick-end" };
      });
    }, 600);
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  }, [phase, currentPlayer, tricksThisHand]);

  // ── Between hands ──────────────────────────────────────────────────────────

  const startNextHand = useCallback(() => {
    setState(s => makeInitialState(s.handNumber + 1, s.scores));
  }, []);

  const startNewGame = useCallback(() => { setState(freshGame()); }, []);

  // ── Pass label ─────────────────────────────────────────────────────────────

  function passLabel(): string {
    if (passDir === "left")   return "→ Pass Left";
    if (passDir === "right")  return "← Pass Right";
    if (passDir === "across") return "↑ Pass Across";
    return "";
  }

  // ── Menus ──────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => ([
    { label: "Game", items: [
      { label: "New Hand",    onClick: startNextHand },
      { label: "Show Scores", onClick: () => setShowScores(true) },
      { separator: true },
      ...(onNewGame ? [{ label: "New Game", onClick: onNewGame }] : []),
      ...(onQuit    ? [{ label: "Exit",     onClick: onQuit    }] : []),
    ]},
    { label: "Options", items: [
      { label: "Card Appearance…", onClick: () => setShowDeckModal(true) },
    ]},
  ]), [startNextHand, onNewGame, onQuit]);

  useWindowMenus(menus);

  // ── Render ─────────────────────────────────────────────────────────────────

  const gameOverWinnerIdx = scores.indexOf(Math.min(...scores));
  const passTargetName    = passDir !== "none" ? PLAYER_NAMES[passTarget(0, passDir)] : "";

  return (
    <div className="hearts">
      {showDeckModal && (
        <DeckModal appearance={appearance} onUpdate={setAppearance} onClose={() => setShowDeckModal(false)} />
      )}

      {/* Score / hand-end modal */}
      {(phase === "hand-end" || phase === "game-over" || showScores) && (
        <div className="hearts-modal-overlay" onClick={showScores ? () => setShowScores(false) : undefined}>
          <div className="hearts-modal" onClick={e => e.stopPropagation()}>
            <div className="hearts-modal__titlebar">
              <span>{phase === "game-over" ? "Game Over" : showScores ? "Scores" : "Hand Results"}</span>
              {showScores && (
                <button className="hearts-modal__close" onClick={() => setShowScores(false)}>✕</button>
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

      {/* Stage */}
      <div ref={containerRef} className="hearts__stage-container">
        <div
          className="hearts__stage"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {/* Player labels — absolutely positioned within stage */}
          <div className="hearts__label hearts__label--north">
            {PLAYER_NAMES[2]}
            {currentPlayer === 2 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[2] > 0 && <span className="hearts__badge">{handScores[2]}pt</span>}
          </div>
          <div className="hearts__label hearts__label--west">
            {PLAYER_NAMES[1]}
            {currentPlayer === 1 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[1] > 0 && <span className="hearts__badge">{handScores[1]}pt</span>}
          </div>
          <div className="hearts__label hearts__label--east">
            {PLAYER_NAMES[3]}
            {currentPlayer === 3 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[3] > 0 && <span className="hearts__badge">{handScores[3]}pt</span>}
          </div>
          <div className="hearts__label hearts__label--south">
            {PLAYER_NAMES[0]}
            {isHumanTurn && <span className="hearts__turn-dot hearts__turn-dot--human" />}
            <span className="hearts__score-inline">{scores[0]}pts</span>
          </div>

          {/* Center info */}
          <div className="hearts__center-info">
            {(phase === "playing" || phase === "trick-end") && (
              <span className="hearts__trick-count">{tricksThisHand}/13</span>
            )}
            {heartsAreBroken && <span className="hearts__broken">♥</span>}
          </div>

          {/* Passing UI */}
          {phase === "passing" && (
            <div className="hearts__pass-overlay">
              <div className="hearts__pass-hint">
                Select 3 · {passLabel()} · to {passTargetName}
                {passedCards.length > 0 && ` (${passedCards.length}/3)`}
              </div>
              {passedCards.length === 3 && (
                <button className="hearts-btn hearts-btn--primary hearts-btn--sm" onClick={confirmPass}>
                  {passLabel()} →
                </button>
              )}
            </div>
          )}

          {/* Play hint */}
          {phase === "playing" && isHumanTurn && selectedCard && (
            <div className="hearts__play-hint">Tap again to play</div>
          )}
          {phase === "playing" && !isHumanTurn && (
            <div className="hearts__play-hint">{PLAYER_NAMES[currentPlayer]}{"'s turn…"}</div>
          )}

          {/* All 52 cards — permanently mounted */}
          {FIXED_DECK.map(card => {
            const cs = cardStates[card.id];
            if (!cs) return null;
            const inHumanHand = hands[0].some(c => c.id === card.id);
            const isPassSel   = passedCards.some(c => c.id === card.id);
            const isPlaySel   = selectedCard === card.id;
            const isValid     = validIds.has(card.id);
            const isReceived  = receivedIds.has(card.id);
            let highlightColor: string | undefined;
            if (isPassSel || isPlaySel)                          highlightColor = "#cc4400";
            else if (isValid && isHumanTurn)                     highlightColor = "#228833";
            else if (isReceived)                                  highlightColor = "#5b2d8e";
            return (
              <PermCard
                key={card.id}
                card={card}
                cs={cs}
                appearance={appearance}
                size="sm"
                highlightColor={highlightColor}
                onClick={inHumanHand || (phase === "passing" && isPassSel) ? () => handleCardClick(card) : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="hearts__statusbar">
        <span>Hand {handNumber + 1} · Trick {Math.min(tricksThisHand + 1, 13)}/13</span>
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
