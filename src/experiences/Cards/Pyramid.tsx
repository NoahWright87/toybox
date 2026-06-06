import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import "./Pyramid.css";
import { PermCard } from "./PermCard";
import type { CardVisualState } from "./cardStack";
import type { Card, CardAppearance, DeckSettings } from "./types";
import { buildDeck } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Layout constants ─────────────────────────────────────────────────────────

const ROWS = 7;
const CARD_W = 52;
const CARD_H = 72;
const H_GAP = 4;   // horizontal gap between cards in the same row
const V_STEP = 34; // vertical distance between row tops (overlap)

const BASE_ROW_W = ROWS * CARD_W + (ROWS - 1) * H_GAP; // 388
const GRID_H = (ROWS - 1) * V_STEP + CARD_H;            // 276

const STAGE_W = BASE_ROW_W + 32;   // 420
const PYRAMID_TOP = 20;
const STAGE_H = PYRAMID_TOP + GRID_H + 28 + CARD_H + 24;  // ~440

// Pile centers (x is card center, y is card center)
const PILE_Y = PYRAMID_TOP + GRID_H + 28 + CARD_H / 2;
const STOCK_X = STAGE_W / 2 - 44;
const WASTE_X = STAGE_W / 2 + 44;
const REMOVE_X = STAGE_W + 300;   // far off-screen right
const REMOVE_Y = PILE_Y;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Array.at() is ES2022 — use this instead for broader lib compat
function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

function pyramidValue(card: Card): number {
  if (card.rank === "A") return 1;
  if (card.rank === "J") return 11;
  if (card.rank === "Q") return 12;
  if (card.rank === "K") return 13;
  if (card.rank === "Joker") return 0;
  return parseInt(card.rank as string, 10);
}

// Card center helpers (return CENTER of card, not top-left)
function cardX(row: number, col: number): number {
  const rowW = row * CARD_W + (row - 1) * H_GAP;
  const startX = (STAGE_W - rowW) / 2;
  return startX + col * (CARD_W + H_GAP) + CARD_W / 2;
}

function cardY(row: number): number {
  return PYRAMID_TOP + (row - 1) * V_STEP + CARD_H / 2;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PyramidSlot {
  card: Card;
  row: number;
  col: number;
  removed: boolean;
}

type GamePhase = "dealing" | "playing" | "won" | "lost";

interface PyramidState {
  slots: PyramidSlot[];
  stock: Card[];
  waste: Card[];
  selected: string | null;
  phase: GamePhase;
  removedCount: number;
}

function buildPyramid(settings: DeckSettings): PyramidState {
  const deck = buildDeck(settings);
  const pyramidSize = (ROWS * (ROWS + 1)) / 2; // 28
  const pyramidCards = deck.slice(0, pyramidSize);
  const stock = deck.slice(pyramidSize);

  const slots: PyramidSlot[] = [];
  let idx = 0;
  for (let row = 1; row <= ROWS; row++) {
    for (let col = 0; col < row; col++) {
      slots.push({ card: pyramidCards[idx++], row, col, removed: false });
    }
  }

  return { slots, stock, waste: [], selected: null, phase: "playing", removedCount: 0 };
}

function isAvailable(slot: PyramidSlot, slots: PyramidSlot[]): boolean {
  if (slot.removed) return false;
  if (slot.row === ROWS) return true;
  const coversLeft  = slots.find((s) => s.row === slot.row + 1 && s.col === slot.col);
  const coversRight = slots.find((s) => s.row === slot.row + 1 && s.col === slot.col + 1);
  return (!coversLeft || coversLeft.removed) && (!coversRight || coversRight.removed);
}

function checkLost(state: PyramidState): boolean {
  if (state.phase !== "playing") return false;
  const available = state.slots.filter((s) => isAvailable(s, state.slots));
  const wasteTop = last(state.waste);

  const hasKing = available.some((s) => pyramidValue(s.card) === 13) ||
                  (wasteTop !== undefined && pyramidValue(wasteTop) === 13);
  if (hasKing) return false;

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      if (pyramidValue(available[i].card) + pyramidValue(available[j].card) === 13) return false;
    }
    if (wasteTop && pyramidValue(available[i].card) + pyramidValue(wasteTop) === 13) return false;
  }

  if (state.stock.length > 0) return false;

  return true;
}

// ── computePositions ─────────────────────────────────────────────────────────

function computePositions(
  s: PyramidState,
  peekedId: string | null,
  ms: number
): Record<string, CardVisualState> {
  const result: Record<string, CardVisualState> = {};

  // Pyramid slots
  for (const slot of s.slots) {
    if (slot.removed) {
      result[slot.card.id] = {
        x: REMOVE_X,
        y: REMOVE_Y,
        z: 5000 + slot.row * 10 + slot.col,
        rotation: 12,
        faceDown: false,
        transitionMs: ms,
      };
    } else {
      const isPeeked = peekedId === slot.card.id;
      const isSelected = s.selected === slot.card.id;
      result[slot.card.id] = {
        x: cardX(slot.row, slot.col),
        y: cardY(slot.row) - (isSelected ? 8 : 0),
        z: (slot.row * 10 + slot.col) + (isPeeked ? 5000 : 0),
        faceDown: false,
        rotation: 0,
        transitionMs: isPeeked ? 0 : ms,
      };
    }
  }

  // Stock: stacked face-down, depth goes LEFT so stack doesn't cover pyramid cards above.
  // stock[0] is the next card drawn (logical top) → depth=0, highest z, no offset.
  const n = s.stock.length;
  s.stock.forEach((card, i) => {
    const depth = i;           // 0 = top card (stock[0]), n-1 = bottom
    result[card.id] = {
      x: STOCK_X - depth * 0.5,
      y: PILE_Y,
      z: 100 + (n - 1 - i),   // stock[0] gets highest z
      faceDown: true,
      rotation: 0,
      transitionMs: ms,
    };
  });

  // Waste: stacked face-up, depth goes LEFT.
  // waste[wn-1] is the top card (most recently drawn) → depth=0, highest z.
  const wn = s.waste.length;
  s.waste.forEach((card, i) => {
    const depth = wn - 1 - i;
    result[card.id] = {
      x: WASTE_X - depth * 0.5,
      y: PILE_Y,
      z: 200 + i,
      faceDown: false,
      rotation: 0,
      transitionMs: ms,
    };
  });

  return result;
}

// ── Component ────────────────────────────────────────────────────────────────

interface PyramidProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

const PYR_SAVE_KEY = "cards-pyramid-save";

export default function Pyramid({ settings, onNewGame, onQuit }: PyramidProps) {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, CardVisualState>>({});
  const [peekedCardId, setPeekedCardId] = useState<string | null>(null);

  const [state, setState] = useState<PyramidState>(() => {
    try {
      const raw = localStorage.getItem(PYR_SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { version: number; state: PyramidState };
        if (saved?.version === 1 && saved.state?.slots) {
          return { ...saved.state, phase: saved.state.phase === "dealing" ? "playing" : saved.state.phase };
        }
      }
    } catch {}
    return buildPyramid(settings);
  });
  const [appearance, setAppearance] = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  function after(ms: number, fn: () => void) { timers.current.push(setTimeout(fn, ms)); }

  // ── Scale to fit container ──────────────────────────────────────────────────

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

  // ── Persistence ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === "won" || state.phase === "lost") {
      try { localStorage.removeItem(PYR_SAVE_KEY); } catch {}
      return;
    }
    if (state.phase === "dealing") return;
    try {
      localStorage.setItem(PYR_SAVE_KEY, JSON.stringify({ version: 1, state }));
    } catch {}
  }, [state]);

  // ── Deal animation helper ───────────────────────────────────────────────────

  function dealAnimation(s: PyramidState, cards: Card[]): void {
    const total = cards.length;
    const half = Math.floor(total / 2);

    // Start: all cards stacked at stock, depth goes LEFT, no transition
    const init: Record<string, CardVisualState> = {};
    cards.forEach((c, i) => {
      const d = total - 1 - i;
      init[c.id] = { x: STOCK_X - d * 0.3, y: PILE_Y, z: 100 + i, rotation: 0, faceDown: true, transitionMs: 0 };
    });
    setCardStates(init);

    // Riffle shuffle: split left/right then merge back
    const shufflePass = (delay: number, onDone: () => void): void => {
      after(delay, () => {
        const split: Record<string, CardVisualState> = {};
        cards.forEach((c, i) => {
          const isLeft = i < half;
          const pos = isLeft ? i : i - half;
          const len = isLeft ? half : total - half;
          const d = len - 1 - pos;
          split[c.id] = {
            x: (isLeft ? STOCK_X - 24 : STOCK_X + 24) + (isLeft ? -d : d) * 0.3,
            y: PILE_Y,
            z: 100 + i,
            rotation: isLeft ? -3 : 3,
            faceDown: true,
            transitionMs: 200,
          };
        });
        setCardStates(split);

        after(280, () => {
          const merged: Record<string, CardVisualState> = {};
          cards.forEach((c, i) => {
            const d = total - 1 - i;
            merged[c.id] = {
              x: STOCK_X - d * 0.3,
              y: PILE_Y,
              z: 100 + i,
              rotation: 0,
              faceDown: true,
              transitionMs: 200,
              transitionDelay: i * 3,
            };
          });
          setCardStates(merged);
          after(420, onDone);
        });
      });
    };

    // Two shuffle passes, then deal pyramid cards to their positions
    shufflePass(60, () => {
      shufflePass(0, () => {
        after(60, () => {
          const deal: Record<string, CardVisualState> = {};
          // Stock cards snap to final pile positions (no transition).
          // stock[0] = logical top: depth=0, highest z, no offset.
          s.stock.forEach((card, i) => {
            deal[card.id] = { x: STOCK_X - i * 0.5, y: PILE_Y, z: 100 + (s.stock.length - 1 - i), faceDown: true, rotation: 0, transitionMs: 0 };
          });
          // Pyramid cards fly to grid positions with stagger (apex first)
          s.slots.forEach(slot => {
            const stagger = (slot.row - 1) * 7 + slot.col;
            deal[slot.card.id] = {
              x: cardX(slot.row, slot.col),
              y: cardY(slot.row),
              z: slot.row * 10 + slot.col,
              faceDown: false,
              rotation: 0,
              transitionMs: 280,
              transitionDelay: stagger * 35,
            };
          });
          setCardStates(deal);

          after(28 * 35 + 280 + 80, () => {
            setState(prev => ({ ...prev, phase: "playing" }));
          });
        });
      });
    });
  }

  // ── newGame ─────────────────────────────────────────────────────────────────

  const newGame = useCallback(() => {
    clearTimers();
    try { localStorage.removeItem(PYR_SAVE_KEY); } catch {}
    const s = buildPyramid(settings);
    const cards = [...s.slots.map(sl => sl.card), ...s.stock];
    setAllCards(cards);
    setPeekedCardId(null);
    const dealingState: PyramidState = { ...s, phase: "dealing" };
    setState(dealingState);
    dealAnimation(s, cards);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, clearTimers]);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem(PYR_SAVE_KEY);
    let restoredState: PyramidState | null = null;
    try {
      if (raw) {
        const saved = JSON.parse(raw) as { version: number; state: PyramidState };
        if (saved?.version === 1 && saved.state?.slots) {
          restoredState = { ...saved.state, phase: "playing" };
        }
      }
    } catch {}

    if (restoredState) {
      const s = restoredState;
      const cards = [...s.slots.map(sl => sl.card), ...s.stock, ...s.waste];
      setAllCards(cards);
      setPeekedCardId(null);
      setState({ ...s, phase: "dealing" });

      // Deal animation for restore
      const init: Record<string, CardVisualState> = {};
      for (const c of cards) {
        init[c.id] = { x: STOCK_X, y: PILE_Y, z: 100, rotation: 0, faceDown: true, transitionMs: 0 };
      }
      setCardStates(init);

      after(60, () => {
        const finalPositions = computePositions({ ...s, phase: "playing" }, null, 260);
        // Add stagger for pyramid cards
        s.slots.forEach(slot => {
          if (!slot.removed && finalPositions[slot.card.id]) {
            const staggerIdx = (slot.row - 1) * 7 + slot.col;
            finalPositions[slot.card.id] = {
              ...finalPositions[slot.card.id],
              transitionDelay: staggerIdx * 30,
            };
          }
        });
        setCardStates(finalPositions);
        const totalDelay = 28 * 30 + 260 + 80;
        after(totalDelay, () => {
          setState(prev => ({ ...prev, phase: "playing" }));
        });
      });
    } else {
      const s = buildPyramid(settings);
      const cards = [...s.slots.map(sl => sl.card), ...s.stock];
      setAllCards(cards);
      setPeekedCardId(null);
      const dealingState: PyramidState = { ...s, phase: "dealing" };
      setState(dealingState);
      dealAnimation(s, cards);
    }

    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync positions on every state change ────────────────────────────────────

  useEffect(() => {
    if (allCards.length === 0) return;
    if (state.phase === "dealing") return;  // deal animation manages positions
    setCardStates(computePositions(state, peekedCardId, 200));
  }, [state, peekedCardId, allCards.length]);

  // ── drawFromStock ───────────────────────────────────────────────────────────

  const drawFromStock = useCallback(() => {
    setState((s: PyramidState) => {
      if (s.phase !== "playing") return s;
      if (s.stock.length === 0) return s;
      const [top, ...rest] = s.stock;
      const next: PyramidState = { ...s, stock: rest, waste: [...s.waste, top], selected: null };
      return checkLost(next) ? { ...next, phase: "lost" } : next;
    });
  }, []);

  // ── selectCard ──────────────────────────────────────────────────────────────

  const selectCard = useCallback((cardId: string, fromWaste: boolean) => {
    setState((s: PyramidState) => {
      if (s.phase !== "playing") return s;

      if (s.selected === cardId) return { ...s, selected: null };

      const clickedSlot = fromWaste ? null : s.slots.find((sl) => sl.card.id === cardId);
      const clickedCard = fromWaste ? last(s.waste) : clickedSlot?.card;

      if (!clickedCard) return s;

      // King removes itself immediately
      if (pyramidValue(clickedCard) === 13) {
        let slots = s.slots;
        let waste = s.waste;
        if (fromWaste) {
          waste = s.waste.slice(0, -1);
        } else {
          slots = s.slots.map((sl) => sl.card.id === cardId ? { ...sl, removed: true } : sl);
        }
        const removedCount = s.removedCount + 1;
        const phase: GamePhase = slots.every((sl) => sl.removed) ? "won" : "playing";
        const next: PyramidState = { ...s, slots, waste, selected: null, removedCount, phase };
        return phase === "playing" && checkLost(next) ? { ...next, phase: "lost" } : next;
      }

      if (!s.selected) return { ...s, selected: cardId };

      // Try to pair with previously selected card
      const wasteTop = last(s.waste);
      const prevIsWaste = wasteTop?.id === s.selected;
      const prevCard = prevIsWaste
        ? wasteTop!
        : s.slots.find((sl) => sl.card.id === s.selected)?.card;

      if (!prevCard) return { ...s, selected: cardId };

      if (pyramidValue(prevCard) + pyramidValue(clickedCard) === 13) {
        let slots = s.slots;
        let waste = s.waste;

        if (prevIsWaste) {
          waste = waste.slice(0, -1);
        } else {
          slots = slots.map((sl) => sl.card.id === s.selected ? { ...sl, removed: true } : sl);
        }
        if (fromWaste) {
          waste = waste.slice(0, -1);
        } else {
          slots = slots.map((sl) => sl.card.id === cardId ? { ...sl, removed: true } : sl);
        }

        const removedCount = s.removedCount + 2;
        const phase: GamePhase = slots.every((sl) => sl.removed) ? "won" : "playing";
        const next: PyramidState = { ...s, slots, waste, selected: null, removedCount, phase };
        return phase === "playing" && checkLost(next) ? { ...next, phase: "lost" } : next;
      }

      return { ...s, selected: cardId };
    });
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  function statusText(): string {
    if (state.phase === "won") return "You cleared the pyramid!";
    if (state.phase === "lost") return "No moves remaining.";
    if (state.phase === "dealing") return "Dealing…";
    return `${state.removedCount} removed · ${state.stock.length} in stock`;
  }

  // ── Menus ─────────────────────────────────────────────────────────────────

  const pyramidMenus = useMemo<MenuBarMenu[]>(() => {
    const items: MenuBarMenu["items"] = [
      { label: "Restart", onClick: newGame },
      ...(onNewGame ? [{ label: "New Game", onClick: onNewGame }] : []),
      ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game", items },
      { label: "Options", items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }] },
    ];
  }, [newGame, onNewGame, onQuit]);

  useWindowMenus(pyramidMenus);

  // ── Render ────────────────────────────────────────────────────────────────

  const wasteTop = last<Card>(state.waste);

  return (
    <div className="pyramid">
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}
      <div
        className="pyramid__stage-container"
        ref={containerRef}
        style={{ height: Math.round(STAGE_H * scale) }}
      >
        <div
          className="pyramid__stage"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
          onPointerUp={() => setPeekedCardId(null)}
        >
          {/* Pile slot outlines */}
          <div
            className="pyramid__pile-slot"
            style={{ left: STOCK_X - CARD_W / 2, top: PILE_Y - CARD_H / 2 }}
          >
            {state.stock.length === 0 && <span className="pyramid__pile-icon">↺</span>}
          </div>
          <div
            className="pyramid__pile-slot"
            style={{ left: WASTE_X - CARD_W / 2, top: PILE_Y - CARD_H / 2 }}
          />

          {/* Pile count labels */}
          <div
            className="pyramid__pile-label-abs"
            style={{ left: STOCK_X, top: PILE_Y + CARD_H / 2 + 3 }}
          >
            Stock · {state.stock.length}
          </div>
          <div
            className="pyramid__pile-label-abs"
            style={{ left: WASTE_X, top: PILE_Y + CARD_H / 2 + 3 }}
          >
            Waste · {state.waste.length}
          </div>

          {/* All cards as PermCards */}
          {allCards.map(card => {
            const cs = cardStates[card.id];
            if (!cs) return null;
            const slot = state.slots.find(sl => sl.card.id === card.id);
            const inPyramid = !!slot && !slot.removed;
            const avail = inPyramid ? isAvailable(slot, state.slots) : false;
            const isSelected = state.selected === card.id;
            const canAct = state.phase === "playing";
            return (
              <PermCard
                key={card.id}
                card={card}
                cs={cs}
                appearance={appearance}
                size="sm"
                highlightColor={isSelected ? "#ffdd00" : undefined}
                onClick={canAct && avail ? () => selectCard(card.id, false) : undefined}
                onPointerDown={canAct && inPyramid && !avail
                  ? () => setPeekedCardId(card.id)
                  : undefined}
              />
            );
          })}

          {/* Waste hit area — top waste card selectable */}
          {state.phase === "playing" && wasteTop && (
            <div
              className="pyramid__hit-area"
              style={{ left: WASTE_X - CARD_W / 2, top: PILE_Y - CARD_H / 2 }}
              onClick={() => selectCard(wasteTop.id, true)}
            />
          )}

          {/* Stock hit area */}
          {state.phase === "playing" && (
            <div
              className="pyramid__hit-area"
              style={{ left: STOCK_X - CARD_W / 2, top: PILE_Y - CARD_H / 2 }}
              onClick={drawFromStock}
            />
          )}
        </div>
      </div>

      <div className="pyramid__controls">
        <div
          className={`pyramid__status${state.phase === "won" ? " pyramid__status--win" : state.phase === "lost" ? " pyramid__status--lose" : ""}`}
        >
          {statusText()}
        </div>
        <div className="pyramid__btn-row">
          {(state.phase === "won" || state.phase === "lost") && (
            <button className="pyramid__btn pyramid__btn--primary" onClick={newGame}>
              New Game
            </button>
          )}
          {state.phase === "playing" && (
            <button className="pyramid__btn pyramid__btn--secondary" onClick={newGame}>
              Restart
            </button>
          )}
          {state.selected && state.phase === "playing" && (
            <button
              className="pyramid__btn pyramid__btn--secondary"
              onClick={() => setState((s) => ({ ...s, selected: null }))}
            >
              Deselect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
