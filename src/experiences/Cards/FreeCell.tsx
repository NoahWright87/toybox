import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import "./Cards.css";
import "./FreeCell.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, CardAppearance, DeckSettings, Suit } from "./types";
import { shuffle } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
const ALL_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const FOUNDATION_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

const RANK_VAL: Record<string, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
  "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FreeCellSelection {
  from: "cascade" | "freecell";
  colIndex: number;
  cardIndex: number; // index in cascade where sequence starts (0 = bottommost = topmost visible)
  cards: Card[];
}

interface FreeCellState {
  cascades: Card[][];
  freeCells: (Card | null)[];
  foundations: Card[][];
  selected: FreeCellSelection | null;
  moves: number;
  phase: "playing" | "won";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFreeCellDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return shuffle(cards);
}

function isRed(suit: string): boolean {
  return suit === "hearts" || suit === "diamonds";
}

function isBlack(suit: string): boolean {
  return suit === "spades" || suit === "clubs";
}

function oppositeColor(a: string, b: string): boolean {
  return (isRed(a) && isBlack(b)) || (isBlack(a) && isRed(b));
}

/** Can card `top` be placed on `base` in the tableau? */
function canStackOnCascade(top: Card, base: Card): boolean {
  if (top.suit === "joker" || base.suit === "joker") return false;
  return (
    oppositeColor(top.suit, base.suit) &&
    RANK_VAL[top.rank] === RANK_VAL[base.rank] - 1
  );
}

/** Can card be placed on foundation? */
function canPlaceOnFoundation(card: Card, foundation: Card[]): boolean {
  if (card.suit === "joker") return false;
  if (foundation.length === 0) return RANK_VAL[card.rank] === 1;
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && RANK_VAL[card.rank] === RANK_VAL[top.rank] + 1;
}

/** Check if a sequence of cards forms a valid alternating-color descending run */
function isValidSequence(cards: Card[]): boolean {
  for (let i = 0; i < cards.length - 1; i++) {
    if (!canStackOnCascade(cards[i + 1], cards[i])) return false;
  }
  return true;
}

/** Supermove: max cards that can be moved */
function maxMovableCards(freeCells: (Card | null)[], cascades: Card[][], excludeColIndex: number): number {
  const emptyFreeCells = freeCells.filter((c) => c === null).length;
  const emptyCascades = cascades.filter((col, i) => i !== excludeColIndex && col.length === 0).length;
  return (emptyFreeCells + 1) * Math.pow(2, emptyCascades);
}

function makeInitialState(): FreeCellState {
  const deck = buildFreeCellDeck();
  const cascades: Card[][] = Array.from({ length: 8 }, () => []);
  // Deal: columns 0–3 get 7 cards, columns 4–7 get 6 cards
  let idx = 0;
  for (let col = 0; col < 8; col++) {
    const count = col < 4 ? 7 : 6;
    for (let i = 0; i < count; i++) {
      cascades[col].push(deck[idx++]);
    }
  }
  return {
    cascades,
    freeCells: [null, null, null, null],
    foundations: [[], [], [], []],
    selected: null,
    moves: 0,
    phase: "playing",
  };
}

function checkWin(state: FreeCellState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

// ── Auto-move logic ───────────────────────────────────────────────────────────

/**
 * Return true if moving `card` to foundation is "safe" —
 * i.e. no card that could be built on it is still in play at a lower foundation level.
 */
function isSafeToAutoMove(card: Card, foundations: Card[][]): boolean {
  if (card.suit === "joker") return false;
  const cardVal = RANK_VAL[card.rank];
  if (cardVal <= 2) return true;
  // Safe if both colors of the rank below are already on foundations
  const needVal = cardVal - 1;
  for (const suit of FOUNDATION_SUITS) {
    const foundIdx = FOUNDATION_SUITS.indexOf(suit);
    const f = foundations[foundIdx];
    const topVal = f.length > 0 ? RANK_VAL[f[f.length - 1].rank] : 0;
    if (isRed(card.suit) !== isRed(suit) && topVal < needVal) {
      return false;
    }
  }
  return true;
}

function autoMoveToFoundation(state: FreeCellState): FreeCellState {
  let changed = true;
  let s = { ...state };
  while (changed) {
    changed = false;
    // Check free cells
    for (let i = 0; i < 4; i++) {
      const card = s.freeCells[i];
      if (!card) continue;
      const foundIdx = FOUNDATION_SUITS.indexOf(card.suit as Suit);
      if (foundIdx >= 0 && canPlaceOnFoundation(card, s.foundations[foundIdx]) && isSafeToAutoMove(card, s.foundations)) {
        const newFounds = s.foundations.map((f, fi) => fi === foundIdx ? [...f, card] : f);
        const newFreeCells = s.freeCells.map((c, ci) => ci === i ? null : c);
        s = { ...s, foundations: newFounds, freeCells: newFreeCells, moves: s.moves + 1 };
        changed = true;
      }
    }
    // Check cascade tops
    for (let col = 0; col < 8; col++) {
      if (s.cascades[col].length === 0) continue;
      const card = s.cascades[col][s.cascades[col].length - 1];
      const foundIdx = FOUNDATION_SUITS.indexOf(card.suit as Suit);
      if (foundIdx >= 0 && canPlaceOnFoundation(card, s.foundations[foundIdx]) && isSafeToAutoMove(card, s.foundations)) {
        const newFounds = s.foundations.map((f, fi) => fi === foundIdx ? [...f, card] : f);
        const newCascades = s.cascades.map((col2, ci) => ci === col ? col2.slice(0, col2.length - 1) : col2);
        s = { ...s, foundations: newFounds, cascades: newCascades, moves: s.moves + 1 };
        changed = true;
      }
    }
  }
  return s;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface FreeCellProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

type PortraitLayout = "rotate" | "grid";

export default function FreeCell({ settings, onNewGame, onQuit }: FreeCellProps) {
  const [state, setState] = useState<FreeCellState>(() => makeInitialState());
  const [appearance, setAppearance] = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);

  // Portrait-mode detection
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [portraitLayout, setPortraitLayout] = useState<PortraitLayout>("rotate");

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isNarrow = containerSize.w > 0 && containerSize.w < 500;

  // ── Game actions ──────────────────────────────────────────────────────────

  const restart = useCallback(() => {
    setState(makeInitialState());
  }, []);

  const handleAutoMove = useCallback(() => {
    setState((s) => {
      if (s.phase === "won") return s;
      const next = autoMoveToFoundation(s);
      const won = checkWin(next);
      return { ...next, phase: won ? "won" : "playing" };
    });
  }, []);

  // ── Selection & move logic ────────────────────────────────────────────────

  const handleFreeCellClick = useCallback((cellIdx: number) => {
    setState((s) => {
      if (s.phase === "won") return s;
      const cellCard = s.freeCells[cellIdx];

      // If something is selected, try to move it here
      if (s.selected) {
        // Can only move single card to free cell from cascade
        if (s.selected.cards.length === 1) {
          const movingCard = s.selected.cards[0];

          // Move to empty free cell
          if (cellCard === null && s.selected.from === "cascade") {
            const newFreeCells = s.freeCells.map((c, i) => i === cellIdx ? movingCard : c);
            const newCascades = s.cascades.map((col, i) =>
              i === s.selected!.colIndex ? col.slice(0, s.selected!.cardIndex) : col
            );
            const next: FreeCellState = {
              ...s,
              freeCells: newFreeCells,
              cascades: newCascades,
              selected: null,
              moves: s.moves + 1,
            };
            return autoMoveToFoundation(next);
          }

          // Move from free cell to free cell (if destination empty)
          if (cellCard === null && s.selected.from === "freecell") {
            if (cellIdx === s.selected.colIndex) {
              return { ...s, selected: null };
            }
            const newFreeCells = s.freeCells.map((c, i) => {
              if (i === cellIdx) return movingCard;
              if (i === s.selected!.colIndex) return null;
              return c;
            });
            const next: FreeCellState = {
              ...s,
              freeCells: newFreeCells,
              selected: null,
              moves: s.moves + 1,
            };
            return autoMoveToFoundation(next);
          }
        }

        // Click same free cell card — deselect
        if (s.selected.from === "freecell" && s.selected.colIndex === cellIdx) {
          return { ...s, selected: null };
        }

        // Try selecting the free cell card instead
        if (cellCard) {
          return {
            ...s,
            selected: {
              from: "freecell",
              colIndex: cellIdx,
              cardIndex: 0,
              cards: [cellCard],
            },
          };
        }

        return { ...s, selected: null };
      }

      // No selection — select the free cell card
      if (cellCard) {
        return {
          ...s,
          selected: {
            from: "freecell",
            colIndex: cellIdx,
            cardIndex: 0,
            cards: [cellCard],
          },
        };
      }

      return s;
    });
  }, []);

  const handleFoundationClick = useCallback((foundIdx: number) => {
    setState((s) => {
      if (s.phase === "won") return s;
      if (!s.selected || s.selected.cards.length !== 1) return s;

      const movingCard = s.selected.cards[0];
      if (!canPlaceOnFoundation(movingCard, s.foundations[foundIdx])) {
        return { ...s, selected: null };
      }

      const newFounds = s.foundations.map((f, fi) =>
        fi === foundIdx ? [...f, movingCard] : f
      );

      let newCascades = s.cascades;
      let newFreeCells = s.freeCells;

      if (s.selected.from === "cascade") {
        newCascades = s.cascades.map((col, i) =>
          i === s.selected!.colIndex ? col.slice(0, s.selected!.cardIndex) : col
        );
      } else {
        newFreeCells = s.freeCells.map((c, i) =>
          i === s.selected!.colIndex ? null : c
        );
      }

      const next: FreeCellState = {
        ...s,
        foundations: newFounds,
        cascades: newCascades,
        freeCells: newFreeCells,
        selected: null,
        moves: s.moves + 1,
      };
      const afterAuto = autoMoveToFoundation(next);
      const won = checkWin(afterAuto);
      return { ...afterAuto, phase: won ? "won" : "playing" };
    });
  }, []);

  const handleCascadeClick = useCallback((colIndex: number, cardIdx: number) => {
    setState((s) => {
      if (s.phase === "won") return s;
      const col = s.cascades[colIndex];

      // If nothing selected, try to select from this cascade
      if (!s.selected) {
        if (col.length === 0) return s;
        // cardIdx is the index in the array (last = top of pile)
        const seq = col.slice(cardIdx);
        if (!isValidSequence(seq)) return s;
        return {
          ...s,
          selected: {
            from: "cascade",
            colIndex,
            cardIndex: cardIdx,
            cards: seq,
          },
        };
      }

      // Something is selected — try to move it here
      const { selected } = s;

      // Click same card to deselect
      if (
        selected.from === "cascade" &&
        selected.colIndex === colIndex &&
        selected.cardIndex === cardIdx
      ) {
        return { ...s, selected: null };
      }

      const movingCards = selected.cards;
      const movingTop = movingCards[0]; // first card = top of sequence (placed last)

      // Can we place here?
      let canPlace = false;
      if (col.length === 0) {
        canPlace = true;
      } else {
        const destTop = col[col.length - 1];
        canPlace = canStackOnCascade(movingTop, destTop);
      }

      if (!canPlace) {
        // Try to change selection to the clicked column
        if (col.length > 0 && cardIdx < col.length) {
          const seq = col.slice(cardIdx);
          if (isValidSequence(seq)) {
            return {
              ...s,
              selected: {
                from: "cascade",
                colIndex,
                cardIndex: cardIdx,
                cards: seq,
              },
            };
          }
        }
        return { ...s, selected: null };
      }

      // Check supermove limit
      const maxMove = maxMovableCards(s.freeCells, s.cascades, colIndex);
      if (movingCards.length > maxMove) {
        return { ...s, selected: null };
      }

      // Perform the move
      const newCascades = s.cascades.map((c, i) => {
        if (i === colIndex) return [...c, ...movingCards];
        if (selected.from === "cascade" && i === selected.colIndex) {
          return c.slice(0, selected.cardIndex);
        }
        return c;
      });

      let newFreeCells = s.freeCells;
      if (selected.from === "freecell") {
        newFreeCells = s.freeCells.map((c, i) =>
          i === selected.colIndex ? null : c
        );
      }

      const next: FreeCellState = {
        ...s,
        cascades: newCascades,
        freeCells: newFreeCells,
        selected: null,
        moves: s.moves + 1,
      };
      const afterAuto = autoMoveToFoundation(next);
      const won = checkWin(afterAuto);
      return { ...afterAuto, phase: won ? "won" : "playing" };
    });
  }, []);

  const handleEmptyCascadeClick = useCallback((colIndex: number) => {
    setState((s) => {
      if (s.phase === "won") return s;
      if (!s.selected) return s;

      const { selected } = s;
      const movingCards = selected.cards;

      const maxMove = maxMovableCards(s.freeCells, s.cascades, colIndex);
      if (movingCards.length > maxMove) {
        return { ...s, selected: null };
      }

      const newCascades = s.cascades.map((col, i) => {
        if (i === colIndex) return [...col, ...movingCards];
        if (selected.from === "cascade" && i === selected.colIndex) {
          return col.slice(0, selected.cardIndex);
        }
        return col;
      });

      let newFreeCells = s.freeCells;
      if (selected.from === "freecell") {
        newFreeCells = s.freeCells.map((c, i) =>
          i === selected.colIndex ? null : c
        );
      }

      const next: FreeCellState = {
        ...s,
        cascades: newCascades,
        freeCells: newFreeCells,
        selected: null,
        moves: s.moves + 1,
      };
      const afterAuto = autoMoveToFoundation(next);
      const won = checkWin(afterAuto);
      return { ...afterAuto, phase: won ? "won" : "playing" };
    });
  }, []);

  // ── Computed highlight state ──────────────────────────────────────────────

  const validDestinations = useMemo(() => {
    if (!state.selected) return null;
    const sel = state.selected;
    const movingCards = sel.cards;
    const movingTop = movingCards[0];

    const maxMove = maxMovableCards(state.freeCells, state.cascades, sel.from === "cascade" ? sel.colIndex : -1);

    const cascadeValid: boolean[] = state.cascades.map((col, i) => {
      if (sel.from === "cascade" && i === sel.colIndex) return false;
      if (movingCards.length > maxMove) return false;
      if (col.length === 0) return true;
      const destTop = col[col.length - 1];
      return canStackOnCascade(movingTop, destTop);
    });

    const freeCellValid: boolean[] = state.freeCells.map((c, i) => {
      if (sel.from === "freecell" && i === sel.colIndex) return false;
      return c === null && movingCards.length === 1;
    });

    const foundationValid: boolean[] = state.foundations.map((f, fi) => {
      return movingCards.length === 1 && canPlaceOnFoundation(movingTop, f) &&
        FOUNDATION_SUITS[fi] === movingTop.suit;
    });

    return { cascadeValid, freeCellValid, foundationValid };
  }, [state]);

  // ── Menus ─────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const gameItems: MenuBarMenu["items"] = [
      { label: "Restart", onClick: restart },
      ...(onNewGame ? [{ label: "New Game", onClick: onNewGame }] : []),
      ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game", items: gameItems },
      {
        label: "Options",
        items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }],
      },
    ];
  }, [restart, onNewGame, onQuit]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────

  const { cascades, freeCells, foundations, selected, moves, phase } = state;

  const SUIT_SYMBOL: Record<string, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
  };

  // Cascades split for 2×4 portrait grid layout
  const cascadesTop = cascades.slice(0, 4);
  const cascadesBottom = cascades.slice(4, 8);

  const gameContent = (
    <>
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      {/* Top area: free cells + foundations */}
      <div className="freecell__top-row">
        {/* Free cells */}
        <div className="freecell__free-cells">
          {freeCells.map((card, i) => {
            const isSelected = selected?.from === "freecell" && selected.colIndex === i;
            const isValid = validDestinations?.freeCellValid[i] ?? false;
            return (
              <div
                key={i}
                className={
                  "freecell__cell-slot" +
                  (isSelected ? " freecell__cell-slot--selected" : "") +
                  (isValid ? " freecell__cell-slot--valid" : "")
                }
                onClick={() => handleFreeCellClick(i)}
                title="Free Cell"
              >
                {card ? (
                  <PlayingCard card={card} appearance={appearance} size="sm" />
                ) : (
                  <div className="freecell__empty-slot freecell__empty-slot--freecell" />
                )}
              </div>
            );
          })}
        </div>

        {/* Spacer / status */}
        <div className="freecell__center-status">
          <div className="freecell__moves">Moves: {moves}</div>
          <button
            className="freecell__auto-btn"
            onClick={handleAutoMove}
            disabled={phase === "won"}
            title="Auto-move safe cards to foundations"
          >
            Auto
          </button>
        </div>

        {/* Foundations */}
        <div className="freecell__foundations">
          {FOUNDATION_SUITS.map((suit, i) => {
            const pile = foundations[i];
            const topCard = pile.length > 0 ? pile[pile.length - 1] : null;
            const isValid = validDestinations?.foundationValid[i] ?? false;
            return (
              <div
                key={suit}
                className={
                  "freecell__cell-slot freecell__cell-slot--foundation" +
                  (isValid ? " freecell__cell-slot--valid" : "")
                }
                onClick={() => handleFoundationClick(i)}
                title={`${suit} foundation`}
              >
                {topCard ? (
                  <PlayingCard card={topCard} appearance={appearance} size="sm" />
                ) : (
                  <div className="freecell__empty-slot freecell__empty-slot--foundation">
                    <span className="freecell__suit-hint">{SUIT_SYMBOL[suit]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cascade area — normal 8-column or 2×4 grid */}
      {isNarrow && portraitLayout === "grid" ? (
        <>
          <div className="freecell__cascades">
            {cascadesTop.map((col, i) => {
              const colIdx = i;
              return renderCascadeCol(col, colIdx);
            })}
          </div>
          <div className="freecell__cascades">
            {cascadesBottom.map((col, i) => {
              const colIdx = i + 4;
              return renderCascadeCol(col, colIdx);
            })}
          </div>
        </>
      ) : (
        <div className="freecell__cascades">
          {cascades.map((col, colIdx) => renderCascadeCol(col, colIdx))}
        </div>
      )}

      {/* Win banner */}
      {phase === "won" && (
        <div className="freecell__win-overlay">
          <div className="freecell__win-banner">
            <div className="freecell__win-title">You Win!</div>
            <div className="freecell__win-moves">Completed in {moves} moves</div>
            <div className="freecell__win-btns">
              <button className="freecell__btn freecell__btn--primary" onClick={restart}>
                Play Again
              </button>
              {onNewGame && (
                <button className="freecell__btn freecell__btn--secondary" onClick={onNewGame}>
                  New Game
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  function renderCascadeCol(col: Card[], colIdx: number) {
    const isCascadeValid = validDestinations?.cascadeValid[colIdx] ?? false;
    const colHeight = col.length === 0 ? 72 : (col.length - 1) * 22 + 72;
    return (
      <div
        key={colIdx}
        className={
          "freecell__cascade" +
          (isCascadeValid ? " freecell__cascade--valid" : "")
        }
        style={{ height: colHeight }}
        onClick={col.length === 0 ? () => handleEmptyCascadeClick(colIdx) : undefined}
      >
        {col.length === 0 ? (
          <div className="freecell__empty-slot freecell__empty-slot--cascade" />
        ) : (
          col.map((card, cardIdx) => {
            const isSeqStart = selected?.from === "cascade" &&
              selected.colIndex === colIdx &&
              selected.cardIndex === cardIdx;
            const isInSelected = selected?.from === "cascade" &&
              selected.colIndex === colIdx &&
              cardIdx >= selected.cardIndex;
            const isTop = cardIdx === col.length - 1;
            const offsetY = cardIdx * 22;
            return (
              <div
                key={card.id}
                className={
                  "freecell__cascade-card" +
                  (isInSelected ? " freecell__cascade-card--selected" : "") +
                  (isSeqStart ? " freecell__cascade-card--seq-start" : "")
                }
                style={{ top: `${offsetY}px`, zIndex: cardIdx + 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCascadeClick(colIdx, cardIdx);
                }}
                title={isTop ? `${card.rank} of ${card.suit}` : undefined}
              >
                <PlayingCard card={card} appearance={appearance} size="sm" />
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (isNarrow && portraitLayout === "rotate") {
    // Rotate the game 90° CW so landscape content fills a portrait container.
    // Container: W×H (portrait). Landscape element: H×W.
    // After `translateY(H) rotate(90deg)` (rotate first, then translate):
    //   rotated bounds → x=[0,W], y=[0,H]. Fills container exactly.
    const gameW = containerSize.h;  // landscape width  = portrait height (H)
    const gameH = containerSize.w;  // landscape height = portrait width  (W)
    const wrapHeight = gameW || 400; // outer height = H (portrait height)
    return (
      <div
        ref={wrapperRef}
        className="freecell-wrapper freecell-wrapper--rotate"
        style={{ position: "relative", height: wrapHeight, overflow: "hidden" }}
      >
        <div className="freecell__portrait-toggle freecell__portrait-toggle--overlay">
          <button
            className="freecell__portrait-btn"
            onClick={() => setPortraitLayout("grid")}
            title="Switch to 2×4 grid layout"
          >▦ 2×4</button>
        </div>
        <div
          className="freecell"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: gameW,
            height: gameH,
            transform: `translateY(${gameW}px) rotate(90deg)`,
            transformOrigin: "top left",
          }}
        >
          {gameContent}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="freecell-wrapper">
      {isNarrow && (
        <div className="freecell__portrait-toggle">
          <button
            className={"freecell__portrait-btn" + (portraitLayout === "rotate" ? " freecell__portrait-btn--active" : "")}
            onClick={() => setPortraitLayout("rotate")}
            title="Rotate 90°"
          >⟳ Rotate</button>
          <button
            className={"freecell__portrait-btn" + (portraitLayout === "grid" ? " freecell__portrait-btn--active" : "")}
            onClick={() => setPortraitLayout("grid")}
            title="2×4 grid layout"
          >▦ 2×4</button>
        </div>
      )}
      <div className="freecell">
        {gameContent}
      </div>
    </div>
  );
}
