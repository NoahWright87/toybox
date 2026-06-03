import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Cards.css";
import "./Memory.css";
import { PermCard } from "./PermCard";
import { CardStack } from "./cardStack";
import type { CardVisualState } from "./cardStack";
import type { Card, CardAppearance, DeckSettings } from "./types";
import type { Rank, Suit } from "./types";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type MemoryDifficulty = "easy" | "medium" | "hard";
type Phase = "shuffle" | "idle" | "one-up" | "checking" | "game-over";

interface MemCardData {
  card: Card;
  pairId: string;
}

// ── Stage constants ───────────────────────────────────────────────────────────

const STAGE_W = 436;
const CARD_W  = 52;
const CARD_H  = 72;
const GAP     = 8;

// Grid: cols × rows per difficulty
const GRID_COLS: Record<MemoryDifficulty, number> = { easy: 4, medium: 6, hard: 6 };
const GRID_ROWS: Record<MemoryDifficulty, number> = { easy: 4, medium: 4, hard: 6 };

// Stage height: top-padding + grid rows + bottom area for scored pile
const GRID_TOP = 10;
function stageH(difficulty: MemoryDifficulty): number {
  const rows = GRID_ROWS[difficulty];
  return GRID_TOP + rows * CARD_H + (rows - 1) * GAP + 90;
}

// Scored pile center at bottom-center of stage
function pileY(difficulty: MemoryDifficulty): number {
  return stageH(difficulty) - 44;
}
const PILE_X = STAGE_W / 2;

// Grid cell center position for a given index
function gridPos(index: number, difficulty: MemoryDifficulty): { x: number; y: number } {
  const cols = GRID_COLS[difficulty];
  const gridW = cols * CARD_W + (cols - 1) * GAP;
  const startX = (STAGE_W - gridW) / 2 + CARD_W / 2;
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    x: startX + col * (CARD_W + GAP),
    y: GRID_TOP + CARD_H / 2 + row * (CARD_H + GAP),
  };
}

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ── Deck builders ─────────────────────────────────────────────────────────────

const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildMemoryCards(difficulty: MemoryDifficulty): MemCardData[] {
  const pairs: { pairId: string; a: Card; b: Card }[] = [];

  if (difficulty === "easy") {
    for (let i = 0; i < 8; i++) {
      const rank = RANKS[i];
      pairs.push({
        pairId: `p-e-${rank}`,
        a: { suit: "spades"  as Suit, rank, id: `mem-s-${rank}-a` },
        b: { suit: "hearts"  as Suit, rank, id: `mem-h-${rank}-b` },
      });
    }
  } else if (difficulty === "medium") {
    for (let i = 0; i < 12; i++) {
      const rank = RANKS[i];
      pairs.push({
        pairId: `p-m-${rank}`,
        a: { suit: "spades"  as Suit, rank, id: `mem-s-${rank}-a` },
        b: { suit: "hearts"  as Suit, rank, id: `mem-h-${rank}-b` },
      });
    }
  } else {
    for (let i = 0; i < 13; i++) {
      const rank = RANKS[i];
      pairs.push({
        pairId: `p-h-sh-${rank}`,
        a: { suit: "spades"  as Suit, rank, id: `mem-s-${rank}-a` },
        b: { suit: "hearts"  as Suit, rank, id: `mem-h-${rank}-b` },
      });
    }
    for (let i = 0; i < 5; i++) {
      const rank = RANKS[i];
      pairs.push({
        pairId: `p-h-dc-${rank}`,
        a: { suit: "diamonds" as Suit, rank, id: `mem-d-${rank}-a` },
        b: { suit: "clubs"    as Suit, rank, id: `mem-c-${rank}-b` },
      });
    }
  }

  const cards: MemCardData[] = [];
  for (const p of pairs) {
    cards.push({ card: p.a, pairId: p.pairId });
    cards.push({ card: p.b, pairId: p.pairId });
  }
  return cards;
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MemoryProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function Memory({ settings, onNewGame, onQuit }: MemoryProps) {
  const difficulty: MemoryDifficulty = settings.memoryDifficulty;

  const [allCards,      setAllCards]      = useState<MemCardData[]>([]);
  const [cardStates,    setCardStates]    = useState<Record<string, CardVisualState>>({});
  const [phase,         setPhase]         = useState<Phase>("shuffle");
  const [selectedIds,   setSelectedIds]   = useState<string[]>([]);
  const [scoredIds,     setScoredIds]     = useState<Set<string>>(new Set<string>());
  const [flashIds,      setFlashIds]      = useState<Set<string>>(new Set<string>());
  const [attempts,      setAttempts]      = useState(0);
  const [pairsFound,    setPairsFound]    = useState(0);
  const [elapsed,       setElapsed]       = useState(0);
  const [appearance,    setAppearance]    = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);

  // Scored pile — permanent stack, face-up cards fan slightly
  const scoredStack = useRef(new CardStack({
    zTier: 1,
    baseX: PILE_X,
    baseY: pileY(difficulty),
    offsetX: 0.4,
    offsetY: -0.3,
  }));

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  function after(ms: number, fn: () => void): void {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }

  // Timer
  const startTimeRef = useRef<number | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const ensureTimer = useCallback(() => {
    if (timerRef.current !== null) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (phase === "game-over") stopTimer();
  }, [phase, stopTimer]);

  useEffect(() => () => { stopTimer(); }, [stopTimer]);

  // ── startGame ──────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    clearTimers();
    stopTimer();
    setElapsed(0);
    startTimeRef.current = null;
    setSelectedIds([]);
    setFlashIds(new Set<string>());
    setAttempts(0);
    setPairsFound(0);

    const isRestart = allCards.length > 0;
    const memCards  = buildMemoryCards(difficulty);
    const shuffled  = fisherYates(memCards);

    // Build initial card states — all at pile center, face-down, instant
    const initStates: Record<string, CardVisualState> = {};
    for (const mc of shuffled) {
      initStates[mc.card.id] = {
        x: PILE_X, y: pileY(difficulty), z: 10,
        rotation: 0, faceDown: true, transitionMs: 0,
      };
    }

    const GATHER  = 300;
    const SPLIT   = 280;
    const PAUSE   = 80;
    const MERGE   = 200;
    const STAGGER = 8;
    const DEAL    = 380;
    const MERGE_TOTAL = MERGE + (shuffled.length - 1) * STAGGER;

    function mergeStates(cards1: MemCardData[], cards2: MemCardData[]): Record<string, CardVisualState> {
      const interleaved: MemCardData[] = [];
      const len = Math.max(cards1.length, cards2.length);
      for (let i = 0; i < len; i++) {
        if (i < cards1.length) interleaved.push(cards1[i]);
        if (i < cards2.length) interleaved.push(cards2[i]);
      }
      const states: Record<string, CardVisualState> = {};
      interleaved.forEach((mc, i) => {
        states[mc.card.id] = {
          x: PILE_X, y: pileY(difficulty), z: 10 + i,
          rotation: rnd(-5, 5), faceDown: true,
          transitionMs: MERGE, transitionDelay: i * STAGGER,
        };
      });
      return states;
    }

    const half  = Math.floor(shuffled.length / 2);
    const left  = shuffled.slice(0, half);
    const right = shuffled.slice(half);
    const leftX  = PILE_X - 80;
    const rightX = PILE_X + 80;

    if (isRestart) {
      // Gather scored cards back to pile center (face-up, they animate from their scored positions)
      const gatherStates: Record<string, CardVisualState> = {};
      for (const mc of allCards) {
        gatherStates[mc.card.id] = {
          x: PILE_X, y: pileY(difficulty), z: 10,
          rotation: rnd(-3, 3), faceDown: false,
          transitionMs: GATHER,
        };
      }
      scoredStack.current.clear();
      setScoredIds(new Set<string>());
      setAllCards(shuffled);
      setCardStates(gatherStates);
      setPhase("shuffle");

      let now = GATHER + PAUSE;

      // Flip face-down (split apart so the "flip" is visible)
      after(now, () => {
        const states: Record<string, CardVisualState> = {};
        left.forEach((mc, i) => {
          states[mc.card.id] = { x: leftX + i * 0.5, y: pileY(difficulty) - i * 0.5, z: 300 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        right.forEach((mc, i) => {
          states[mc.card.id] = { x: rightX - i * 0.5, y: pileY(difficulty) - i * 0.5, z: 400 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        setCardStates(states);
      });
      now += SPLIT + PAUSE;

      after(now, () => setCardStates(mergeStates(left, right)));
      now += MERGE_TOTAL + PAUSE;

      after(now, () => {
        left.forEach((mc, i) => {
          setCardStates(prev => ({ ...prev, [mc.card.id]: { x: leftX + i * 0.4, y: pileY(difficulty) - i * 0.4, z: 300 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT } }));
        });
        right.forEach((mc, i) => {
          setCardStates(prev => ({ ...prev, [mc.card.id]: { x: rightX - i * 0.4, y: pileY(difficulty) - i * 0.4, z: 400 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT } }));
        });
        // Do the second split as a batch
        const states: Record<string, CardVisualState> = {};
        left.forEach((mc, i) => {
          states[mc.card.id] = { x: leftX + i * 0.4, y: pileY(difficulty) - i * 0.4, z: 300 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        right.forEach((mc, i) => {
          states[mc.card.id] = { x: rightX - i * 0.4, y: pileY(difficulty) - i * 0.4, z: 400 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        setCardStates(states);
      });
      now += SPLIT + PAUSE;

      after(now, () => setCardStates(mergeStates(left, right)));
      now += MERGE_TOTAL + PAUSE;

      after(now, () => {
        const dealStates: Record<string, CardVisualState> = {};
        shuffled.forEach((mc, idx) => {
          const pos = gridPos(idx, difficulty);
          dealStates[mc.card.id] = { x: pos.x, y: pos.y, z: 200 + idx, rotation: 0, faceDown: true, transitionMs: DEAL };
        });
        setCardStates(dealStates);
        after(DEAL + 100, () => setPhase("idle"));
      });

    } else {
      // First game: instant placement at pile center, then shuffle and deal
      scoredStack.current.clear();
      setScoredIds(new Set<string>());
      setAllCards(shuffled);
      setCardStates(initStates);
      setPhase("shuffle");

      let now = 80;  // let browser paint "all at center" frame first

      after(now, () => {
        const states: Record<string, CardVisualState> = {};
        left.forEach((mc, i) => {
          states[mc.card.id] = { x: leftX + i * 0.5, y: pileY(difficulty) - i * 0.5, z: 300 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        right.forEach((mc, i) => {
          states[mc.card.id] = { x: rightX - i * 0.5, y: pileY(difficulty) - i * 0.5, z: 400 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        setCardStates(states);
      });
      now += SPLIT + PAUSE;

      after(now, () => setCardStates(mergeStates(left, right)));
      now += MERGE_TOTAL + PAUSE;

      after(now, () => {
        const states: Record<string, CardVisualState> = {};
        left.forEach((mc, i) => {
          states[mc.card.id] = { x: leftX + i * 0.4, y: pileY(difficulty) - i * 0.4, z: 300 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        right.forEach((mc, i) => {
          states[mc.card.id] = { x: rightX - i * 0.4, y: pileY(difficulty) - i * 0.4, z: 400 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
        });
        setCardStates(states);
      });
      now += SPLIT + PAUSE;

      after(now, () => setCardStates(mergeStates(left, right)));
      now += MERGE_TOTAL + PAUSE;

      after(now, () => {
        const dealStates: Record<string, CardVisualState> = {};
        shuffled.forEach((mc, idx) => {
          const pos = gridPos(idx, difficulty);
          dealStates[mc.card.id] = { x: pos.x, y: pos.y, z: 200 + idx, rotation: 0, faceDown: true, transitionMs: DEAL };
        });
        setCardStates(dealStates);
        after(DEAL + 100, () => setPhase("idle"));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards, difficulty]);

  useEffect(() => {
    startGame();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Card click ────────────────────────────────────────────────────────────

  const handleCardClick = useCallback((cardId: string) => {
    if (phase !== "idle" && phase !== "one-up") return;

    setCardStates(prev => {
      const cs = prev[cardId];
      if (!cs || !cs.faceDown) return prev;  // already face-up or scored
      return { ...prev, [cardId]: { ...cs, faceDown: false, transitionMs: 0 } };
    });

    ensureTimer();

    if (phase === "idle") {
      setSelectedIds([cardId]);
      setPhase("one-up");
    } else {
      // second card
      setSelectedIds(prev => {
        const firstId = prev[0];
        if (!firstId || firstId === cardId) return prev;

        const firstMc = allCards.find(mc => mc.card.id === firstId);
        const secondMc = allCards.find(mc => mc.card.id === cardId);
        if (!firstMc || !secondMc) return prev;

        setAttempts(a => a + 1);
        setPhase("checking");

        if (firstMc.pairId === secondMc.pairId) {
          // Match!
          const matchIds = [firstId, cardId];
          setFlashIds(new Set<string>(matchIds));

          after(900, () => {
            // Move matched cards to scored pile
            setFlashIds(new Set<string>());
            const mc1 = allCards.find(m => m.card.id === firstId)!;
            const mc2 = allCards.find(m => m.card.id === cardId)!;

            scoredStack.current.addCard(mc1.card, { toTop: true, faceDown: false, rotation: rnd(-8, 8) });
            scoredStack.current.addCard(mc2.card, { toTop: true, faceDown: false, rotation: rnd(-8, 8) });

            const pileLayout = scoredStack.current.layout(350);
            // During flight: use z=500+ so they fly over everything
            setCardStates(prev2 => ({
              ...prev2,
              [firstId]: { ...pileLayout[firstId], z: 500, transitionMs: 350 },
              [cardId]:  { ...pileLayout[cardId],  z: 501, transitionMs: 350 },
            }));

            setScoredIds(prev2 => new Set<string>([...prev2, firstId, cardId]));
            setPairsFound(p => {
              const newPairs = p + 1;
              const totalPairs = allCards.length / 2;
              after(400, () => {
                // restore real pile z after flight
                setCardStates(prev3 => ({
                  ...prev3,
                  [firstId]: { ...prev3[firstId], z: pileLayout[firstId].z },
                  [cardId]:  { ...prev3[cardId],  z: pileLayout[cardId].z },
                }));
                if (newPairs >= totalPairs) {
                  setPhase("game-over");
                } else {
                  setPhase("idle");
                }
              });
              return newPairs;
            });
          });
        } else {
          // No match — flip back after delay
          after(900, () => {
            setCardStates(prev2 => {
              const next = { ...prev2 };
              if (next[firstId]) next[firstId] = { ...next[firstId], faceDown: true, transitionMs: 0 };
              if (next[cardId])  next[cardId]  = { ...next[cardId],  faceDown: true, transitionMs: 0 };
              return next;
            });
            setPhase("idle");
          });
        }

        return [];
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, allCards]);

  // ── Menus ─────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const gameItems: MenuBarMenu["items"] = [
      { label: "New Game", onClick: startGame },
      ...(onNewGame ? [{ label: "Change Game…", onClick: onNewGame }] : []),
      ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game",    items: gameItems },
      { label: "Options", items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }] },
    ];
  }, [startGame, onNewGame, onQuit]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────

  function difficultyLabel(): string {
    if (difficulty === "easy")   return "Easy (4×4)";
    if (difficulty === "medium") return "Medium (6×4)";
    return "Hard (6×6)";
  }

  const totalPairs = allCards.length / 2;
  const pairsLeft  = totalPairs - pairsFound;
  const sh         = stageH(difficulty);

  return (
    <div className="memory">
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      <div className="memory__infobar">
        <span>{difficultyLabel()}</span>
      </div>

      <div className="memory__stage" style={{ width: STAGE_W, height: sh }}>
        {phase === "game-over" && (
          <div className="memory__win-banner">
            <div className="memory__win-title">You Won!</div>
            <div className="memory__win-stats">
              {attempts} attempt{attempts !== 1 ? "s" : ""} · {elapsed}s
            </div>
            <button className="memory__btn memory__btn--primary" onClick={startGame}>
              Play Again
            </button>
          </div>
        )}

        {allCards.map(mc => {
          const cs = cardStates[mc.card.id];
          if (!cs) return null;
          const isSelected = selectedIds.includes(mc.card.id);
          const isFlash    = flashIds.has(mc.card.id);
          const isScored   = scoredIds.has(mc.card.id);
          const highlight  = isFlash    ? "#44cc44"
                           : isSelected ? "#cc4400"
                           : undefined;
          const canClick   = !isScored && cs.faceDown && (phase === "idle" || phase === "one-up");
          return (
            <PermCard
              key={mc.card.id}
              card={mc.card}
              cs={isScored ? { ...cs, rotation: cs.rotation } : cs}
              appearance={appearance}
              size="sm"
              highlightColor={highlight}
              onClick={canClick ? () => handleCardClick(mc.card.id) : undefined}
            />
          );
        })}
      </div>

      <div className="memory__statusbar">
        <span>Attempts: {attempts}</span>
        <span>Time: {elapsed}s</span>
        <span>{pairsLeft} pair{pairsLeft !== 1 ? "s" : ""} left</span>
      </div>

      <div className="memory__controls">
        <button className="memory__btn memory__btn--primary" onClick={startGame}>
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
