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

type HeartsPhase =
  | "passing"
  | "playing"
  | "trick-end"
  | "hand-end"
  | "game-over";

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
  const dirs: PassDir[] = ["left", "right", "across", "none"];
  return dirs[handNumber % 4];
}

function passTarget(from: number, dir: PassDir): number {
  if (dir === "left")   return (from + 1) % 4;
  if (dir === "right")  return (from + 3) % 4;
  if (dir === "across") return (from + 2) % 4;
  return from;
}

// ── AI Helpers ────────────────────────────────────────────────────────────────

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
  const sorted = [...hand].sort((a, b) => problemScore(b) - problemScore(a));
  return sorted.slice(0, 3);
}

function aiChooseCard(
  valid: Card[],
  trick: TrickPlay[],
  ledSuit: Suit | null,
): Card {
  if (trick.length === 0 || ledSuit === null) {
    const nonHearts = valid.filter((c) => c.suit !== "hearts");
    const pool = nonHearts.length > 0 ? nonHearts : valid;
    return pool.reduce((best, c) =>
      rankValue(c.rank as string) < rankValue(best.rank as string) ? c : best
    );
  }

  const canFollowSuit = valid.some((c) => c.suit === ledSuit);
  if (canFollowSuit) {
    const suitCards = valid.filter((c) => c.suit === ledSuit);
    let winnerVal = -1;
    for (const play of trick) {
      if (play.card.suit === ledSuit) {
        const v = rankValue(play.card.rank as string);
        if (v > winnerVal) winnerVal = v;
      }
    }
    const losers = suitCards.filter((c) => rankValue(c.rank as string) < winnerVal);
    if (losers.length > 0) {
      return losers.reduce((best, c) =>
        rankValue(c.rank as string) > rankValue(best.rank as string) ? c : best
      );
    }
    return suitCards.reduce((best, c) =>
      rankValue(c.rank as string) < rankValue(best.rank as string) ? c : best
    );
  }

  const qs = valid.find((c) => c.suit === "spades" && c.rank === "Q");
  if (qs) return qs;
  const hearts = valid.filter((c) => c.suit === "hearts");
  if (hearts.length > 0) {
    return hearts.reduce((best, c) =>
      rankValue(c.rank as string) > rankValue(best.rank as string) ? c : best
    );
  }
  return valid.reduce((best, c) =>
    rankValue(c.rank as string) > rankValue(best.rank as string) ? c : best
  );
}

// ── Shoot the moon check ──────────────────────────────────────────────────────

function applyHandScores(
  handScores: number[],
  cumulativeScores: number[],
): number[] {
  const moonShooterIdx = handScores.findIndex((s) => s === 26);
  if (moonShooterIdx !== -1) {
    return cumulativeScores.map((s, i) => (i === moonShooterIdx ? s : s + 26));
  }
  return cumulativeScores.map((s, i) => s + handScores[i]);
}

// ── Initial state factory ─────────────────────────────────────────────────────

function makeInitialState(handNumber: number, prevScores: number[]): HeartsState {
  const deck = buildDeck();
  const hands = dealHands(deck, 4);
  const suitOrder: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  const sortHand = (hand: Card[]) =>
    [...hand].sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return rankValue(a.rank as string) - rankValue(b.rank as string);
    });

  const dir = passDirection(handNumber);

  let trickLeader = 0;
  for (let i = 0; i < 4; i++) {
    if (hands[i].some((c) => c.suit === "clubs" && c.rank === "2")) {
      trickLeader = i;
      break;
    }
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

function freshGame(): HeartsState {
  return makeInitialState(0, [0, 0, 0, 0]);
}

// ── Fan helpers ───────────────────────────────────────────────────────────────

// Returns rotation angle in degrees for a card at position idx in a hand of total
function fanAngle(idx: number, total: number): number {
  if (total <= 1) return 0;
  const mid = (total - 1) / 2;
  return ((idx - mid) / mid) * 11;
}

// Overlap in px to keep a horizontal hand within maxWidth
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
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHandNumRef = useRef(state.handNumber);

  // Increment dealKey on each new hand so cards remount and re-animate
  useEffect(() => {
    if (state.handNumber !== prevHandNumRef.current) {
      prevHandNumRef.current = state.handNumber;
      setDealKey((k) => k + 1);
    }
  }, [state.handNumber]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const { hands, scores, handScores, phase, passDir, passedCards, receivedCards,
    currentTrick, ledSuit, currentPlayer,
    heartsAreBroken, isFirstTrick, tricksThisHand, handNumber, selectedCard } = state;

  const humanHand = hands[0];
  const isHumanTurn = phase === "playing" && currentPlayer === 0;
  const validPlays = isHumanTurn
    ? getValidHeartPlays(humanHand, ledSuit, heartsAreBroken, isFirstTrick)
    : [];
  const validIds = new Set<string>(validPlays.map((c) => c.id));

  // ── Pass phase ─────────────────────────────────────────────────────────────

  const togglePassCard = useCallback((cardId: string) => {
    if (phase !== "passing") return;
    setState((s) => {
      const already = s.passedCards.find((c) => c.id === cardId);
      if (already) {
        return { ...s, passedCards: s.passedCards.filter((c) => c.id !== cardId) };
      }
      if (s.passedCards.length >= 3) return s;
      const card = s.hands[0].find((c) => c.id === cardId);
      if (!card) return s;
      return { ...s, passedCards: [...s.passedCards, card] };
    });
  }, [phase]);

  const confirmPass = useCallback(() => {
    setState((s) => {
      if (s.passedCards.length !== 3) return s;

      const aiPasses: Card[][] = [[], [], [], []];
      aiPasses[0] = s.passedCards;
      for (let i = 1; i < 4; i++) {
        aiPasses[i] = aiSelectCardsToPass(s.hands[i]);
      }

      const newHands = s.hands.map((hand) => [...hand]);
      for (let from = 0; from < 4; from++) {
        const to = passTarget(from, s.passDir);
        if (to === from) continue;
        const passing = aiPasses[from];
        newHands[from] = newHands[from].filter(
          (c) => !passing.some((p) => p.id === c.id)
        );
        newHands[to] = [...newHands[to], ...passing];
      }

      const suitOrder: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
      const sortHand = (hand: Card[]) =>
        [...hand].sort((a, b) => {
          const sd = suitOrder[a.suit] - suitOrder[b.suit];
          if (sd !== 0) return sd;
          return rankValue(a.rank as string) - rankValue(b.rank as string);
        });

      const sortedHands = newHands.map(sortHand);

      let trickLeader = 0;
      for (let i = 0; i < 4; i++) {
        if (sortedHands[i].some((c) => c.suit === "clubs" && c.rank === "2")) {
          trickLeader = i;
          break;
        }
      }

      const humanReceivedFrom: number[] = [];
      for (let from = 0; from < 4; from++) {
        if (passTarget(from, s.passDir) === 0 && from !== 0) {
          humanReceivedFrom.push(from);
        }
      }
      const receivedCards = humanReceivedFrom.flatMap((from) => aiPasses[from]);

      return {
        ...s,
        hands: sortedHands,
        phase: "playing",
        passedCards: [],
        receivedCards,
        trickLeader,
        currentPlayer: trickLeader,
        currentTrick: [],
        ledSuit: null,
      };
    });
  }, []);

  // ── Play a card ────────────────────────────────────────────────────────────

  const playCard = useCallback((playerIndex: number, card: Card) => {
    setState((s) => {
      if (s.phase !== "playing") return s;
      if (s.currentPlayer !== playerIndex) return s;

      const valid = getValidHeartPlays(
        s.hands[playerIndex],
        s.ledSuit,
        s.heartsAreBroken,
        s.isFirstTrick
      );
      if (!valid.some((c) => c.id === card.id)) return s;

      const newTrick: TrickPlay[] = [...s.currentTrick, { playerIndex, card }];
      const newHands = s.hands.map((hand, i) =>
        i === playerIndex ? hand.filter((c) => c.id !== card.id) : hand
      );

      const newLedSuit: Suit | null =
        s.currentTrick.length === 0 ? (card.suit as Suit) : s.ledSuit;

      const newHeartsAreBroken =
        s.heartsAreBroken || card.suit === "hearts";

      if (newTrick.length < 4) {
        const nextPlayer = (playerIndex + 1) % 4;
        return {
          ...s,
          hands: newHands,
          currentTrick: newTrick,
          ledSuit: newLedSuit,
          currentPlayer: nextPlayer,
          heartsAreBroken: newHeartsAreBroken,
          selectedCard: null,
        };
      }

      const winner = resolveTrick(newTrick, newLedSuit!);
      const pts = trickPoints(newTrick.map((p) => p.card));
      const newHandScores = s.handScores.map((hs, i) => (i === winner ? hs + pts : hs));
      const newTricksThisHand = s.tricksThisHand + 1;
      const newIsFirstTrick = false;

      if (newTricksThisHand === 13) {
        const newCumulative = applyHandScores(newHandScores, s.scores);
        const gameOver = newCumulative.some((sc) => sc >= 100);
        return {
          ...s,
          hands: newHands,
          handScores: newHandScores,
          scores: newCumulative,
          currentTrick: newTrick,
          ledSuit: newLedSuit,
          heartsAreBroken: newHeartsAreBroken,
          isFirstTrick: newIsFirstTrick,
          tricksThisHand: newTricksThisHand,
          currentPlayer: winner,
          trickLeader: winner,
          phase: gameOver ? "game-over" : "hand-end",
          selectedCard: null,
        };
      }

      return {
        ...s,
        hands: newHands,
        handScores: newHandScores,
        currentTrick: newTrick,
        ledSuit: newLedSuit,
        heartsAreBroken: newHeartsAreBroken,
        isFirstTrick: newIsFirstTrick,
        tricksThisHand: newTricksThisHand,
        currentPlayer: winner,
        trickLeader: winner,
        phase: "trick-end",
        selectedCard: null,
      };
    });
  }, []);

  // ── Human card click ───────────────────────────────────────────────────────

  const handleCardClick = useCallback((card: Card) => {
    if (phase === "passing") {
      togglePassCard(card.id);
      return;
    }
    if (!isHumanTurn) return;
    if (!validIds.has(card.id)) return;

    if (selectedCard === card.id) {
      playCard(0, card);
    } else {
      setState((s) => ({ ...s, selectedCard: card.id }));
    }
  }, [phase, isHumanTurn, validIds, selectedCard, togglePassCard, playCard]);

  // ── Trick-end pause → clear trick ─────────────────────────────────────────

  useEffect(() => {
    if (phase !== "trick-end") return;
    const t = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "trick-end") return s;
        return { ...s, phase: "playing", currentTrick: [], ledSuit: null };
      });
    }, 900);
    return () => clearTimeout(t);
  }, [phase, tricksThisHand]);

  // ── AI turns ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing" && phase !== "trick-end") return;
    if (currentPlayer === 0) return;
    if (phase === "trick-end") return;

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    aiTimerRef.current = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "playing") return s;
        if (s.currentPlayer === 0) return s;

        const ai = s.currentPlayer;
        const valid = getValidHeartPlays(
          s.hands[ai],
          s.ledSuit,
          s.heartsAreBroken,
          s.isFirstTrick
        );
        if (valid.length === 0) return s;

        const chosen = aiChooseCard(valid, s.currentTrick, s.ledSuit);

        const newTrick: TrickPlay[] = [...s.currentTrick, { playerIndex: ai, card: chosen }];
        const newHands = s.hands.map((hand, i) =>
          i === ai ? hand.filter((c) => c.id !== chosen.id) : hand
        );
        const newLedSuit: Suit | null =
          s.currentTrick.length === 0 ? (chosen.suit as Suit) : s.ledSuit;
        const newHeartsAreBroken =
          s.heartsAreBroken || chosen.suit === "hearts";

        if (newTrick.length < 4) {
          const nextPlayer = (ai + 1) % 4;
          return {
            ...s,
            hands: newHands,
            currentTrick: newTrick,
            ledSuit: newLedSuit,
            currentPlayer: nextPlayer,
            heartsAreBroken: newHeartsAreBroken,
          };
        }

        const winner = resolveTrick(newTrick, newLedSuit!);
        const pts = trickPoints(newTrick.map((p) => p.card));
        const newHandScores = s.handScores.map((hs, i) => (i === winner ? hs + pts : hs));
        const newTricksThisHand = s.tricksThisHand + 1;

        if (newTricksThisHand === 13) {
          const newCumulative = applyHandScores(newHandScores, s.scores);
          const gameOver = newCumulative.some((sc) => sc >= 100);
          return {
            ...s,
            hands: newHands,
            handScores: newHandScores,
            scores: newCumulative,
            currentTrick: newTrick,
            ledSuit: newLedSuit,
            heartsAreBroken: newHeartsAreBroken,
            isFirstTrick: false,
            tricksThisHand: newTricksThisHand,
            currentPlayer: winner,
            trickLeader: winner,
            phase: gameOver ? "game-over" : "hand-end",
          };
        }

        return {
          ...s,
          hands: newHands,
          handScores: newHandScores,
          currentTrick: newTrick,
          ledSuit: newLedSuit,
          heartsAreBroken: newHeartsAreBroken,
          isFirstTrick: false,
          tricksThisHand: newTricksThisHand,
          currentPlayer: winner,
          trickLeader: winner,
          phase: "trick-end",
        };
      });
    }, 600);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [phase, currentPlayer, tricksThisHand]);

  // ── Between-hand: start next hand ─────────────────────────────────────────

  const startNextHand = useCallback(() => {
    setState((s) => makeInitialState(s.handNumber + 1, s.scores));
  }, []);

  const startNewGame = useCallback(() => {
    setState(freshGame());
  }, []);

  // ── Menus ──────────────────────────────────────────────────────────────────

  const heartsMenus = useMemo<MenuBarMenu[]>(() => {
    const gameItems: MenuBarMenu["items"] = [
      { label: "New Hand", onClick: startNextHand },
      { label: "Show Scores", onClick: () => setShowScores(true) },
      { separator: true },
      ...(onNewGame ? [{ label: "New Game", onClick: onNewGame }] : []),
      ...(onQuit ? [{ label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game", items: gameItems },
      { label: "Options", items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }] },
    ];
  }, [startNextHand, onNewGame, onQuit]);

  useWindowMenus(heartsMenus);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function trickCardFor(playerIdx: number): Card | null {
    return currentTrick.find((p) => p.playerIndex === playerIdx)?.card ?? null;
  }

  function passLabel(): string {
    if (passDir === "left")   return "→ Pass Left";
    if (passDir === "right")  return "← Pass Right";
    if (passDir === "across") return "↑ Pass Across";
    return "";
  }

  const passTargetName = passDir !== "none" ? PLAYER_NAMES[passTarget(0, passDir)] : "";
  const gameOverWinnerIdx = state.scores.indexOf(Math.min(...state.scores));

  // Human hand overlap: fit 13 cards into ~300px max
  const hOverlap = handOverlap(humanHand.length, 72, 300);
  // North AI overlap: fit 13 sm cards into ~280px max
  const nOverlap = handOverlap(hands[2].length, 52, 280);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="hearts">
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      {/* Hand-end / Game-over / Scores modal */}
      {(phase === "hand-end" || phase === "game-over" || showScores) && (
        <div
          className="hearts-modal-overlay"
          onClick={showScores ? () => setShowScores(false) : undefined}
        >
          <div className="hearts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hearts-modal__titlebar">
              <span>
                {phase === "game-over" ? "Game Over" : showScores ? "Scores" : "Hand Results"}
              </span>
              {showScores && (
                <button
                  className="hearts-modal__close"
                  onClick={() => setShowScores(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
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
                    <tr
                      key={i}
                      className={
                        phase === "game-over" && i === gameOverWinnerIdx
                          ? "hearts-modal__winner-row"
                          : ""
                      }
                    >
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
                  {onNewGame && (
                    <button className="hearts-btn hearts-btn--primary" onClick={onNewGame}>
                      Choose Game
                    </button>
                  )}
                  <button className="hearts-btn hearts-btn--primary" onClick={startNewGame}>
                    Play Again
                  </button>
                </>
              ) : !showScores ? (
                <button className="hearts-btn hearts-btn--primary" onClick={startNextHand}>
                  Continue →
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Table (felt) ── */}
      <div className="hearts__table">

        {/* North AI */}
        <div className="hearts__zone hearts__zone--north">
          <div className="hearts__player-label hearts__player-label--ai">
            {PLAYER_NAMES[2]}
            {currentPlayer === 2 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[2] > 0 && (
              <span className="hearts__hand-score-badge">{handScores[2]}pt</span>
            )}
          </div>
          <div
            className="hearts__ai-fan hearts__ai-fan--horiz"
            style={{ "--ai-overlap": `${nOverlap}px` } as React.CSSProperties}
          >
            {hands[2].map((card, idx) => (
              <PlayingCard
                key={`n-${dealKey}-${card.id}`}
                card={card}
                faceDown
                appearance={appearance}
                size="sm"
                dealIndex={idx}
              />
            ))}
          </div>
        </div>

        {/* West AI */}
        <div className="hearts__zone hearts__zone--west">
          <div className="hearts__player-label hearts__player-label--ai hearts__player-label--side">
            {PLAYER_NAMES[1]}
            {currentPlayer === 1 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[1] > 0 && (
              <span className="hearts__hand-score-badge">{handScores[1]}pt</span>
            )}
          </div>
          <div className="hearts__ai-fan hearts__ai-fan--vert">
            {hands[1].slice(0, 8).map((card, idx) => (
              <PlayingCard
                key={`w-${dealKey}-${card.id}`}
                card={card}
                faceDown
                appearance={appearance}
                size="sm"
                dealIndex={idx}
              />
            ))}
            {hands[1].length > 8 && (
              <div className="hearts__ai-extra">+{hands[1].length - 8}</div>
            )}
          </div>
        </div>

        {/* Trick area */}
        <div className="hearts__trick-area">
          <div className="hearts__trick-slot hearts__trick-slot--n">
            {trickCardFor(2) && (
              <div key={trickCardFor(2)!.id} className="hearts__trick-card">
                <PlayingCard card={trickCardFor(2)!} appearance={appearance} size="sm" />
              </div>
            )}
          </div>
          <div className="hearts__trick-slot hearts__trick-slot--w">
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
          <div className="hearts__trick-slot hearts__trick-slot--e">
            {trickCardFor(3) && (
              <div key={trickCardFor(3)!.id} className="hearts__trick-card">
                <PlayingCard card={trickCardFor(3)!} appearance={appearance} size="sm" />
              </div>
            )}
          </div>
          <div className="hearts__trick-slot hearts__trick-slot--s">
            {trickCardFor(0) && (
              <div key={trickCardFor(0)!.id} className="hearts__trick-card">
                <PlayingCard card={trickCardFor(0)!} appearance={appearance} size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* East AI */}
        <div className="hearts__zone hearts__zone--east">
          <div className="hearts__player-label hearts__player-label--ai hearts__player-label--side">
            {PLAYER_NAMES[3]}
            {currentPlayer === 3 && phase === "playing" && <span className="hearts__turn-dot" />}
            {handScores[3] > 0 && (
              <span className="hearts__hand-score-badge">{handScores[3]}pt</span>
            )}
          </div>
          <div className="hearts__ai-fan hearts__ai-fan--vert">
            {hands[3].slice(0, 8).map((card, idx) => (
              <PlayingCard
                key={`e-${dealKey}-${card.id}`}
                card={card}
                faceDown
                appearance={appearance}
                size="sm"
                dealIndex={idx}
              />
            ))}
            {hands[3].length > 8 && (
              <div className="hearts__ai-extra">+{hands[3].length - 8}</div>
            )}
          </div>
        </div>

        {/* South — human player */}
        <div className="hearts__zone hearts__zone--south">
          <div className="hearts__player-label">
            {PLAYER_NAMES[0]}
            {isHumanTurn && phase === "playing" && (
              <span className="hearts__turn-dot hearts__turn-dot--human" />
            )}
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
              const isValid = phase === "playing" && isHumanTurn && validIds.has(card.id);
              const isPlayable = phase === "passing" || isValid;
              const hasReceived = receivedCards.some((c) => c.id === card.id);

              return (
                <div
                  key={`h-${dealKey}-${card.id}`}
                  className={[
                    "hearts__fan-item",
                    isSelected ? "hearts__fan-item--selected" : "",
                    isValid && !isSelected ? "hearts__fan-item--valid" : "",
                    isPlayable ? "hearts__fan-item--clickable" : "",
                    hasReceived ? "hearts__fan-item--received" : "",
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
              <button className="hearts-btn hearts-btn--primary" onClick={confirmPass}>
                {passLabel()} →
              </button>
            </div>
          )}

          {phase === "playing" && isHumanTurn && selectedCard && (
            <div className="hearts__play-hint">Click again to play</div>
          )}
          {phase === "playing" && !isHumanTurn && currentPlayer !== 0 && (
            <div className="hearts__play-hint">
              {PLAYER_NAMES[currentPlayer]}{"'s turn..."}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="hearts__status-bar">
        <span>
          Hand {handNumber + 1} &nbsp;·&nbsp; Trick {Math.min(tricksThisHand + 1, 13)}/13
          &nbsp;·&nbsp; Pass: {passDir === "none" ? "None" : passDir}
        </span>
        <span className="hearts__scores-row">
          {PLAYER_NAMES.map((name, i) => (
            <span key={i} className="hearts__score-item">
              {name}: {scores[i]}
            </span>
          ))}
        </span>
        <button className="hearts-btn hearts-btn--sm" onClick={() => setShowScores(true)}>
          Scores
        </button>
      </div>
    </div>
  );
}
