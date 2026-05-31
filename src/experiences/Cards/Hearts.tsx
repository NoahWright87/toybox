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

/** Score a card for "how bad is it to keep" — higher = pass first */
function problemScore(card: Card): number {
  if (card.suit === "spades") {
    if (card.rank === "A") return 200;
    if (card.rank === "K") return 180;
    if (card.rank === "Q") return 160;
  }
  if (card.suit === "hearts") return 100 + rankValue(card.rank as string);
  // high spades (J, 10, 9, 8 = bad supports)
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
  // Leading
  if (trick.length === 0 || ledSuit === null) {
    // Lead lowest non-heart if possible
    const nonHearts = valid.filter((c) => c.suit !== "hearts");
    const pool = nonHearts.length > 0 ? nonHearts : valid;
    return pool.reduce((best, c) =>
      rankValue(c.rank as string) < rankValue(best.rank as string) ? c : best
    );
  }

  // Following suit
  const canFollowSuit = valid.some((c) => c.suit === ledSuit);
  if (canFollowSuit) {
    const suitCards = valid.filter((c) => c.suit === ledSuit);
    // Find current winner value
    let winnerVal = -1;
    for (const play of trick) {
      if (play.card.suit === ledSuit) {
        const v = rankValue(play.card.rank as string);
        if (v > winnerVal) winnerVal = v;
      }
    }
    // Try to play highest card that won't win, or lowest if all would win
    const losers = suitCards.filter((c) => rankValue(c.rank as string) < winnerVal);
    if (losers.length > 0) {
      return losers.reduce((best, c) =>
        rankValue(c.rank as string) > rankValue(best.rank as string) ? c : best
      );
    }
    // All cards win or no hearts broken — play lowest
    return suitCards.reduce((best, c) =>
      rankValue(c.rank as string) < rankValue(best.rank as string) ? c : best
    );
  }

  // Can't follow suit — discard
  // Dump Q♠ first
  const qs = valid.find((c) => c.suit === "spades" && c.rank === "Q");
  if (qs) return qs;
  // Highest heart
  const hearts = valid.filter((c) => c.suit === "hearts");
  if (hearts.length > 0) {
    return hearts.reduce((best, c) =>
      rankValue(c.rank as string) > rankValue(best.rank as string) ? c : best
    );
  }
  // Highest remaining
  return valid.reduce((best, c) =>
    rankValue(c.rank as string) > rankValue(best.rank as string) ? c : best
  );
}

// ── Shoot the moon check ──────────────────────────────────────────────────────

function applyHandScores(
  handScores: number[],
  cumulativeScores: number[],
): number[] {
  // Check shoot the moon: did any player score all 26?
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
  // Sort hands for display: by suit then rank
  const suitOrder: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  const sortHand = (hand: Card[]) =>
    [...hand].sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return rankValue(a.rank as string) - rankValue(b.rank as string);
    });

  const dir = passDirection(handNumber);

  // Find who has 2♣
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
  // Ref to track if an AI step is currently scheduled (prevents double-firing)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // AI passes
      const aiPasses: Card[][] = [[], [], [], []];
      aiPasses[0] = s.passedCards;
      for (let i = 1; i < 4; i++) {
        aiPasses[i] = aiSelectCardsToPass(s.hands[i]);
      }

      // Exchange cards
      const newHands = s.hands.map((hand) => [...hand]);
      for (let from = 0; from < 4; from++) {
        const to = passTarget(from, s.passDir);
        if (to === from) continue;
        const passing = aiPasses[from];
        // Remove from sender
        newHands[from] = newHands[from].filter(
          (c) => !passing.some((p) => p.id === c.id)
        );
        // Add to receiver
        newHands[to] = [...newHands[to], ...passing];
      }

      // Re-sort hands
      const suitOrder: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
      const sortHand = (hand: Card[]) =>
        [...hand].sort((a, b) => {
          const sd = suitOrder[a.suit] - suitOrder[b.suit];
          if (sd !== 0) return sd;
          return rankValue(a.rank as string) - rankValue(b.rank as string);
        });

      const sortedHands = newHands.map(sortHand);

      // Find who has 2♣ after passing
      let trickLeader = 0;
      for (let i = 0; i < 4; i++) {
        if (sortedHands[i].some((c) => c.suit === "clubs" && c.rank === "2")) {
          trickLeader = i;
          break;
        }
      }

      // Determine what human received: find who passes TO player 0
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

      // Validate
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

      // Not all 4 played yet
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

      // Trick complete — resolve
      const winner = resolveTrick(newTrick, newLedSuit!);
      const pts = trickPoints(newTrick.map((p) => p.card));
      const newHandScores = s.handScores.map((hs, i) => (i === winner ? hs + pts : hs));
      const newTricksThisHand = s.tricksThisHand + 1;
      const newIsFirstTrick = false;

      if (newTricksThisHand === 13) {
        // Hand over
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

      // Brief pause to show trick before clearing
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
      // Second click = confirm play
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
        return {
          ...s,
          phase: "playing",
          currentTrick: [],
          ledSuit: null,
        };
      });
    }, 900);
    return () => clearTimeout(t);
  }, [phase, tricksThisHand]);

  // ── AI turns ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing" && phase !== "trick-end") return;
    if (currentPlayer === 0) return;
    if (phase === "trick-end") return;

    // Cancel any stale timer
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

        // Trick complete
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
    setState((s) => {
      const nextHandNum = s.handNumber + 1;
      const next = makeInitialState(nextHandNum, s.scores);
      return next;
    });
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

  const passTargetName = passDir !== "none"
    ? PLAYER_NAMES[passTarget(0, passDir)]
    : "";

  /** Card played by a given player in current trick */
  function trickCardFor(playerIdx: number): Card | null {
    return currentTrick.find((p) => p.playerIndex === playerIdx)?.card ?? null;
  }

  function passLabel(): string {
    if (passDir === "left")   return "→ Pass Left";
    if (passDir === "right")  return "← Pass Right";
    if (passDir === "across") return "↑ Pass Across";
    return "";
  }

  const gameOverWinnerIdx = state.scores.indexOf(Math.min(...state.scores));

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

      {/* Hand-end / Game-over scorecard modal */}
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

      {/* Table */}
      <div className="hearts__table">

        {/* North AI (top) */}
        <div className="hearts__north">
          <div className="hearts__player-label hearts__player-label--ai">
            {PLAYER_NAMES[2]}
            {currentPlayer === 2 && phase === "playing" && (
              <span className="hearts__turn-dot" />
            )}
          </div>
          <div className="hearts__ai-hand hearts__ai-hand--horiz">
            {hands[2].map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                faceDown
                appearance={appearance}
                size="sm"
              />
            ))}
          </div>
          <div className="hearts__hand-score">
            {handScores[2] > 0 && `${handScores[2]}pt`}
          </div>
        </div>

        {/* Middle row: West, Center, East */}
        <div className="hearts__middle">
          {/* West AI */}
          <div className="hearts__west">
            <div className="hearts__player-label hearts__player-label--ai">
              {PLAYER_NAMES[1]}
              {currentPlayer === 1 && phase === "playing" && (
                <span className="hearts__turn-dot" />
              )}
            </div>
            <div className="hearts__ai-hand hearts__ai-hand--vert">
              {hands[1].map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  faceDown
                  appearance={appearance}
                  size="sm"
                />
              ))}
            </div>
            <div className="hearts__hand-score">
              {handScores[1] > 0 && `${handScores[1]}pt`}
            </div>
          </div>

          {/* Center trick area */}
          <div className="hearts__center">
            {/* North slot */}
            <div className="hearts__trick-slot hearts__trick-slot--north">
              {trickCardFor(2) && (
                <PlayingCard card={trickCardFor(2)!} appearance={appearance} />
              )}
            </div>
            {/* West slot */}
            <div className="hearts__trick-slot hearts__trick-slot--west">
              {trickCardFor(1) && (
                <PlayingCard card={trickCardFor(1)!} appearance={appearance} />
              )}
            </div>
            {/* Center indicator */}
            <div className="hearts__trick-center">
              {phase === "playing" || phase === "trick-end" ? (
                <span className="hearts__trick-count">{tricksThisHand}/13</span>
              ) : null}
              {heartsAreBroken && <span className="hearts__broken">♥</span>}
            </div>
            {/* East slot */}
            <div className="hearts__trick-slot hearts__trick-slot--east">
              {trickCardFor(3) && (
                <PlayingCard card={trickCardFor(3)!} appearance={appearance} />
              )}
            </div>
            {/* South (human) slot */}
            <div className="hearts__trick-slot hearts__trick-slot--south">
              {trickCardFor(0) && (
                <PlayingCard card={trickCardFor(0)!} appearance={appearance} />
              )}
            </div>
          </div>

          {/* East AI */}
          <div className="hearts__east">
            <div className="hearts__player-label hearts__player-label--ai">
              {PLAYER_NAMES[3]}
              {currentPlayer === 3 && phase === "playing" && (
                <span className="hearts__turn-dot" />
              )}
            </div>
            <div className="hearts__ai-hand hearts__ai-hand--vert">
              {hands[3].map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  faceDown
                  appearance={appearance}
                  size="sm"
                />
              ))}
            </div>
            <div className="hearts__hand-score">
              {handScores[3] > 0 && `${handScores[3]}pt`}
            </div>
          </div>
        </div>

        {/* Human (South) */}
        <div className="hearts__south">
          <div className="hearts__player-label">
            {PLAYER_NAMES[0]}
            {isHumanTurn && phase === "playing" && (
              <span className="hearts__turn-dot hearts__turn-dot--human" />
            )}
            <span className="hearts__score-inline">{scores[0]}pts total</span>
          </div>

          {/* Passing phase instruction */}
          {phase === "passing" && (
            <div className="hearts__pass-hint">
              Select 3 cards to pass to {passTargetName}
              {passedCards.length > 0 && ` (${passedCards.length}/3 selected)`}
            </div>
          )}

          <div className={`hearts__human-hand${phase === "passing" ? " hearts__human-hand--passing" : ""}`}>
            {humanHand.map((card) => {
              const isSelected = phase === "passing"
                ? passedCards.some((c) => c.id === card.id)
                : selectedCard === card.id;
              const isValid = phase === "playing" && isHumanTurn && validIds.has(card.id);
              const isPlayable = phase === "passing" || isValid;
              const hasReceived = receivedCards.some((c) => c.id === card.id);

              return (
                <div
                  key={card.id}
                  className={[
                    "hearts__card-wrap",
                    isSelected ? "hearts__card-wrap--selected" : "",
                    isValid && !isSelected ? "hearts__card-wrap--valid" : "",
                    isPlayable ? "hearts__card-wrap--clickable" : "",
                    hasReceived ? "hearts__card-wrap--received" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => handleCardClick(card)}
                >
                  <PlayingCard card={card} appearance={appearance} />
                </div>
              );
            })}
          </div>

          {phase === "passing" && passedCards.length === 3 && (
            <div className="hearts__pass-actions">
              <button
                className="hearts-btn hearts-btn--primary"
                onClick={confirmPass}
              >
                {passLabel()} →
              </button>
            </div>
          )}

          {phase === "playing" && isHumanTurn && selectedCard && (
            <div className="hearts__play-hint">
              Click again to play
            </div>
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
        <button
          className="hearts-btn hearts-btn--sm"
          onClick={() => setShowScores(true)}
        >
          Scores
        </button>
      </div>
    </div>
  );
}
