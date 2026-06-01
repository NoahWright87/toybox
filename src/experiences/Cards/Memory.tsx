import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import "./Cards.css";
import "./Memory.css";
import { FlippableCard } from "./FlippableCard";
import type { CardAppearance, DeckSettings } from "./types";
import type { Card, Rank, Suit } from "./types";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "one-up" | "checking" | "won";

interface MemoryCard {
  card: Card;
  pairId: string;
  faceUp: boolean;
  matched: boolean;
  flashMatch: boolean;  // brief green highlight after match
}

interface MemoryState {
  grid: MemoryCard[];
  phase: Phase;
  firstIdx: number | null;
  attempts: number;
  pairsLeft: number;
}

// ── Board builders ────────────────────────────────────────────────────────────

const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

/**
 * Build the shuffled memory grid for a given difficulty.
 *
 * Easy   4×4 = 16 cards = 8 pairs:  ranks A–8, ♠+♥
 * Medium 4×6 = 24 cards = 12 pairs: ranks A–Q, ♠+♥
 * Hard   6×6 = 36 cards = 18 pairs: ranks A–K (13 pairs ♠+♥) + ranks A–5 (5 pairs ♦+♣)
 */
function buildGrid(difficulty: "easy" | "medium" | "hard"): MemoryCard[] {
  const pairs: { pairId: string; a: Card; b: Card }[] = [];

  if (difficulty === "easy") {
    // 8 pairs: A–8, ♠+♥
    for (let i = 0; i < 8; i++) {
      const rank = RANKS[i];
      const pairId = `p-easy-${rank}`;
      pairs.push({
        pairId,
        a: { suit: "spades" as Suit, rank, id: `mem-s-${rank}-a` },
        b: { suit: "hearts" as Suit, rank, id: `mem-h-${rank}-b` },
      });
    }
  } else if (difficulty === "medium") {
    // 12 pairs: A–Q, ♠+♥
    for (let i = 0; i < 12; i++) {
      const rank = RANKS[i];
      const pairId = `p-med-${rank}`;
      pairs.push({
        pairId,
        a: { suit: "spades" as Suit, rank, id: `mem-s-${rank}-a` },
        b: { suit: "hearts" as Suit, rank, id: `mem-h-${rank}-b` },
      });
    }
  } else {
    // Hard: 13 pairs A–K ♠+♥, then 5 more pairs A–5 ♦+♣
    for (let i = 0; i < 13; i++) {
      const rank = RANKS[i];
      const pairId = `p-h-sh-${rank}`;
      pairs.push({
        pairId,
        a: { suit: "spades" as Suit, rank, id: `mem-s-${rank}-a` },
        b: { suit: "hearts" as Suit, rank, id: `mem-h-${rank}-b` },
      });
    }
    for (let i = 0; i < 5; i++) {
      const rank = RANKS[i];
      const pairId = `p-h-dc-${rank}`;
      pairs.push({
        pairId,
        a: { suit: "diamonds" as Suit, rank, id: `mem-d-${rank}-a` },
        b: { suit: "clubs"    as Suit, rank, id: `mem-c-${rank}-b` },
      });
    }
  }

  // Flatten pairs into cards
  const cards: MemoryCard[] = [];
  for (const pair of pairs) {
    cards.push({ card: pair.a, pairId: pair.pairId, faceUp: false, matched: false, flashMatch: false });
    cards.push({ card: pair.b, pairId: pair.pairId, faceUp: false, matched: false, flashMatch: false });
  }

  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }

  return cards;
}

function makeInitialState(difficulty: "easy" | "medium" | "hard"): MemoryState {
  const grid = buildGrid(difficulty);
  const pairsLeft = grid.length / 2;
  return { grid, phase: "idle", firstIdx: null, attempts: 0, pairsLeft };
}

// ── Grid columns by difficulty ────────────────────────────────────────────────

function gridCols(difficulty: "easy" | "medium" | "hard"): number {
  return difficulty === "hard" ? 6 : 4;
}

// ── Component ────────────────────────────────────────────────────────────────

interface MemoryProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function Memory({ settings, onNewGame, onQuit }: MemoryProps) {
  const difficulty = settings.memoryDifficulty;

  const [state, setState] = useState<MemoryState>(() => makeInitialState(difficulty));
  const [appearance, setAppearance] = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer on first flip
  const ensureTimerRunning = useCallback(() => {
    if (timerRef.current !== null) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop timer on win
  useEffect(() => {
    if (state.phase === "won") {
      stopTimer();
    }
  }, [state.phase, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ── New game ──────────────────────────────────────────────────────────────

  const newGame = useCallback(() => {
    stopTimer();
    setElapsed(0);
    startTimeRef.current = null;
    setState(makeInitialState(difficulty));
  }, [difficulty, stopTimer]);

  // ── Card click ────────────────────────────────────────────────────────────

  const handleCardClick = useCallback((idx: number) => {
    setState((s) => {
      const card = s.grid[idx];

      // Ignore clicks during checking phase, or on already-revealed/matched cards
      if (s.phase === "checking" || s.phase === "won") return s;
      if (card.faceUp || card.matched) return s;

      if (s.phase === "idle") {
        // Flip first card
        const grid = s.grid.map((c, i) =>
          i === idx ? { ...c, faceUp: true } : c
        );
        return { ...s, grid, phase: "one-up", firstIdx: idx };
      }

      if (s.phase === "one-up") {
        if (s.firstIdx === null) return s;
        const firstCard = s.grid[s.firstIdx];
        // Flip second card
        const grid = s.grid.map((c, i) =>
          i === idx ? { ...c, faceUp: true } : c
        );
        const isMatch = firstCard.pairId === card.pairId;
        const attempts = s.attempts + 1;
        const pairsLeft = isMatch ? s.pairsLeft - 1 : s.pairsLeft;
        const phase: Phase = "checking";

        if (isMatch) {
          const gridFlashed = grid.map((c, i) =>
            (i === idx || i === s.firstIdx) ? { ...c, matched: true, flashMatch: true } : c
          );
          const won = pairsLeft === 0;
          return { ...s, grid: gridFlashed, phase: won ? "won" : phase, firstIdx: null, attempts, pairsLeft };
        }

        return { ...s, grid, phase, firstIdx: idx, attempts, pairsLeft };
      }

      return s;
    });

    ensureTimerRunning();
  }, [ensureTimerRunning]);

  // ── Checking delay: flip unmatched pair back, or clear flash ─────────────

  useEffect(() => {
    if (state.phase !== "checking") return;

    // Check if the two face-up, non-matched cards need to flip back
    const faceUpUnmatched = state.grid
      .map((c: MemoryCard, i: number) => ({ c, i }))
      .filter(({ c }: { c: MemoryCard; i: number }) => c.faceUp && !c.matched);

    if (faceUpUnmatched.length === 0) {
      // All face-up cards are matched — clear flashMatch flags and go idle
      const t = setTimeout(() => {
        setState((s) => {
          if (s.phase !== "checking") return s;
          const grid = s.grid.map((c) =>
            c.flashMatch ? { ...c, flashMatch: false } : c
          );
          // Check if all matched (won)
          const allMatched = grid.every((c) => c.matched);
          const phase: Phase = allMatched ? "won" : "idle";
          return { ...s, grid, phase, firstIdx: null };
        });
      }, 900);
      return () => clearTimeout(t);
    }

    // There are unmatched face-up cards — flip them back
    const t = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "checking") return s;
        const grid = s.grid.map((c) =>
          c.faceUp && !c.matched ? { ...c, faceUp: false } : c
        );
        return { ...s, grid, phase: "idle", firstIdx: null };
      });
    }, 900);
    return () => clearTimeout(t);
  }, [state.phase, state.grid]);

  // ── Menus ─────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const gameItems: MenuBarMenu["items"] = [
      { label: "New Game", onClick: newGame },
      ...(onNewGame ? [{ label: "Change Game…", onClick: onNewGame }] : []),
      ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game", items: gameItems },
      { label: "Options", items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }] },
    ];
  }, [newGame, onNewGame, onQuit]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────

  const cols = gridCols(difficulty);

  function difficultyLabel(): string {
    if (difficulty === "easy")   return "Easy (4×4)";
    if (difficulty === "medium") return "Medium (4×6)";
    return "Hard (6×6)";
  }

  return (
    <div className="memory">
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      {/* Info bar */}
      <div className="memory__infobar">
        <span>{difficultyLabel()}</span>
      </div>

      {/* Game table */}
      <div className="memory__table">
        {state.phase === "won" && (
          <div className="memory__win-banner">
            <div className="memory__win-title">You Won!</div>
            <div className="memory__win-stats">
              {state.attempts} attempt{state.attempts !== 1 ? "s" : ""} · {elapsed}s
            </div>
            <button className="memory__btn memory__btn--primary" onClick={newGame}>
              Play Again
            </button>
          </div>
        )}

        <div
          className="memory__grid"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {state.grid.map((mc, idx) => {
            const isSelected = !mc.matched && mc.faceUp;
            const cls = [
              "memory__card-wrap",
              isSelected && !mc.matched ? "memory__card-wrap--selected" : "",
              mc.matched && mc.flashMatch ? "memory__card-wrap--matched-flash" : "",
              mc.matched && !mc.flashMatch ? "memory__card-wrap--matched" : "",
              !mc.faceUp && !mc.matched ? "memory__card-wrap--facedown" : "",
            ].filter(Boolean).join(" ");

            return (
              <div
                key={mc.card.id}
                className={cls}
                onClick={() => handleCardClick(idx)}
              >
                <FlippableCard
                  card={mc.card}
                  faceDown={!mc.faceUp}
                  appearance={appearance}
                  size="sm"
                  dealIndex={idx}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="memory__statusbar">
        <span>Attempts: {state.attempts}</span>
        <span>Time: {elapsed}s</span>
        <span>{state.pairsLeft} pair{state.pairsLeft !== 1 ? "s" : ""} left</span>
      </div>

      {/* Controls */}
      <div className="memory__controls">
        <button className="memory__btn memory__btn--primary" onClick={newGame}>
          New Game
        </button>
        {onNewGame && (
          <button className="memory__btn memory__btn--secondary" onClick={onNewGame}>
            Change Game
          </button>
        )}
      </div>
    </div>
  );
}
