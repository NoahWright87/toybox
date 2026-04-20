import { useState, useCallback, useMemo } from "react";
import "./Pyramid.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, DeckSettings } from "./types";
import { buildDeck } from "./deckUtils";

// ── Layout constants ─────────────────────────────────────────────────────────

const ROWS = 7;
const CARD_W = 52;
const CARD_H = 72;
const H_GAP = 4;   // horizontal gap between cards in the same row
const V_STEP = 34; // vertical distance between row tops (overlap)

const BASE_ROW_W = ROWS * CARD_W + (ROWS - 1) * H_GAP; // 388
const GRID_H = (ROWS - 1) * V_STEP + CARD_H;            // 276

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

function cardX(row: number, col: number): number {
  const rowW = row * CARD_W + (row - 1) * H_GAP;
  const startX = (BASE_ROW_W - rowW) / 2;
  return startX + col * (CARD_W + H_GAP);
}

function cardY(row: number): number {
  return (row - 1) * V_STEP;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PyramidSlot {
  card: Card;
  row: number;
  col: number;
  removed: boolean;
}

type GamePhase = "playing" | "won" | "lost";

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

// ── Component ────────────────────────────────────────────────────────────────

interface PyramidProps {
  settings: DeckSettings;
}

export default function Pyramid({ settings }: PyramidProps) {
  const [state, setState] = useState<PyramidState>(() => buildPyramid(settings));

  const newGame = useCallback(() => setState(buildPyramid(settings)), [settings]);

  const drawFromStock = useCallback(() => {
    setState((s) => {
      if (s.phase !== "playing") return s;
      if (s.stock.length === 0) return s;
      const [top, ...rest] = s.stock;
      const next: PyramidState = { ...s, stock: rest, waste: [...s.waste, top], selected: null };
      return checkLost(next) ? { ...next, phase: "lost" } : next;
    });
  }, []);

  const selectCard = useCallback((cardId: string, fromWaste: boolean) => {
    setState((s) => {
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

  const availableIds = useMemo(
    () => new Set(state.slots.filter((s) => isAvailable(s, state.slots)).map((s) => s.card.id)),
    [state.slots]
  );

  const wasteTop = last(state.waste);
  const pyramidDone = state.slots.every((s) => s.removed);

  function statusText(): string {
    if (state.phase === "won") return "You cleared the pyramid!";
    if (state.phase === "lost") return "No moves remaining.";
    return `${state.removedCount} removed · ${state.stock.length} in stock`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pyramid">
      <div className="pyramid__table">
        {!pyramidDone && (
          <div className="pyramid__grid" style={{ width: BASE_ROW_W, height: GRID_H }}>
            {state.slots.map((slot) => {
              const avail = availableIds.has(slot.card.id);
              const selected = state.selected === slot.card.id;
              const cls = [
                "pyramid__card-wrap",
                slot.removed ? "pyramid__card-wrap--removed"     : "",
                !avail       ? "pyramid__card-wrap--unavailable" : "",
                selected     ? "pyramid__card-wrap--selected"    : "",
              ].join(" ");
              return (
                <div
                  key={slot.card.id}
                  className={cls}
                  style={{ left: cardX(slot.row, slot.col), top: cardY(slot.row) }}
                  onClick={() => avail && selectCard(slot.card.id, false)}
                >
                  <PlayingCard card={slot.card} size="sm" backColor={settings.cardBack} />
                </div>
              );
            })}
          </div>
        )}

        <div className="pyramid__piles">
          <div className="pyramid__pile">
            <div className="pyramid__pile-label">Stock</div>
            <div className="pyramid__stock-card" onClick={drawFromStock}>
              {state.stock.length > 0
                ? <PlayingCard card={state.stock[0]} faceDown size="sm" backColor={settings.cardBack} />
                : <div className="playing-card--empty" style={{ width: 52, height: 72 }} />
              }
            </div>
            <div className="pyramid__pile-count">{state.stock.length}</div>
          </div>

          <div className="pyramid__pile">
            <div className="pyramid__pile-label">Waste</div>
            {wasteTop
              ? (
                <div
                  className={state.selected === wasteTop.id
                    ? "pyramid__card-wrap pyramid__card-wrap--selected"
                    : "pyramid__card-wrap"}
                  style={{ position: "relative" }}
                  onClick={() => selectCard(wasteTop.id, true)}
                >
                  <PlayingCard card={wasteTop} size="sm" backColor={settings.cardBack} />
                </div>
              )
              : <div className="playing-card--empty" style={{ width: 52, height: 72 }} />
            }
            <div className="pyramid__pile-count">{state.waste.length}</div>
          </div>
        </div>
      </div>

      <div className="pyramid__controls">
        <div className={`pyramid__status${state.phase === "won" ? " pyramid__status--win" : state.phase === "lost" ? " pyramid__status--lose" : ""}`}>
          {statusText()}
        </div>
        <div className="pyramid__btn-row">
          {state.phase !== "playing" && (
            <button className="pyramid__btn pyramid__btn--primary" onClick={newGame}>
              New Game
            </button>
          )}
          {state.phase === "playing" && (
            <button className="pyramid__btn pyramid__btn--secondary" onClick={newGame}>
              Restart
            </button>
          )}
          {state.selected && (
            <button className="pyramid__btn pyramid__btn--secondary"
              onClick={() => setState((s) => ({ ...s, selected: null }))}>
              Deselect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
