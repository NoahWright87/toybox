import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Cards.css";
import "./Klondike.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, CardAppearance, DeckSettings, Suit } from "./types";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
const SUITS_ALL: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const FOUNDATION_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

const RANK_VAL: Record<string, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
  "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildStandardDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS_ALL) {
    for (const rank of RANKS) {
      cards.push({ suit, rank, id: `${suit}-${rank}` });
    }
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

function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

function canPlaceOnTableau(card: Card, topCard: Card | null): boolean {
  if (card.suit === "joker") return false;
  if (topCard === null) {
    // Empty column: only King
    return RANK_VAL[card.rank as string] === 13;
  }
  if (topCard.suit === "joker") return false;
  const oppColor = isRed(card.suit as Suit) !== isRed(topCard.suit as Suit);
  const oneBelow = RANK_VAL[card.rank as string] === RANK_VAL[topCard.rank as string] - 1;
  return oppColor && oneBelow;
}

function canPlaceOnFoundation(card: Card, foundation: Card[]): boolean {
  if (card.suit === "joker") return false;
  if (foundation.length === 0) {
    return RANK_VAL[card.rank as string] === 1;
  }
  const top = foundation[foundation.length - 1];
  return (
    top.suit === card.suit &&
    RANK_VAL[card.rank as string] === RANK_VAL[top.rank as string] + 1
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TableauColumn {
  faceDown: Card[];
  faceUp: Card[];
}

interface KlondikeSelection {
  from: "tableau" | "waste" | "foundation";
  colIndex: number;
  cardIndex: number;
}

type GamePhase = "playing" | "won";

interface KlondikeState {
  tableau: TableauColumn[];
  foundations: Card[][];
  stock: Card[];
  waste: Card[];
  wasteIndex: number;
  selected: KlondikeSelection | null;
  moves: number;
  startTime: number;
  phase: GamePhase;
}

// ── Game setup ────────────────────────────────────────────────────────────────

function makeInitialState(): KlondikeState {
  const deck = buildStandardDeck();
  const tableau: TableauColumn[] = [];

  let idx = 0;
  for (let col = 0; col < 7; col++) {
    const numCards = col + 1;
    const colCards = deck.slice(idx, idx + numCards);
    idx += numCards;
    tableau.push({
      faceDown: colCards.slice(0, numCards - 1),
      faceUp: [colCards[numCards - 1]],
    });
  }

  const stock = deck.slice(idx); // remaining 24 cards

  return {
    tableau,
    foundations: [[], [], [], []],
    stock,
    waste: [],
    wasteIndex: -1,
    selected: null,
    moves: 0,
    startTime: Date.now(),
    phase: "playing",
  };
}

// ── Move helpers ──────────────────────────────────────────────────────────────

function getVisibleWasteCard(state: KlondikeState): Card | null {
  if (state.wasteIndex < 0 || state.waste.length === 0) return null;
  const idx = Math.min(state.wasteIndex, state.waste.length - 1);
  return state.waste[idx];
}

function allFaceUp(tableau: TableauColumn[]): boolean {
  return tableau.every((col) => col.faceDown.length === 0);
}

function checkWon(foundations: Card[][]): boolean {
  return foundations.every((f) => f.length === 13);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface KlondikeProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function Klondike({ settings, onNewGame, onQuit }: KlondikeProps) {
  const [state, setState] = useState<KlondikeState>(() => makeInitialState());
  const [appearance, setAppearance] = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const autoCompleteRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === "won") return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - state.startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase, state.startTime]);

  // ── Auto-complete ──────────────────────────────────────────────────────────

  const startAutoComplete = useCallback(() => {
    if (autoCompleteRef.current) return;
    autoCompleteRef.current = setInterval(() => {
      setState((s) => {
        if (s.phase === "won") {
          if (autoCompleteRef.current) {
            clearInterval(autoCompleteRef.current);
            autoCompleteRef.current = null;
          }
          return s;
        }

        // Try to move any card to a foundation
        const newFoundations = s.foundations.map((f) => [...f]);
        const newTableau = s.tableau.map((col) => ({
          faceDown: [...col.faceDown],
          faceUp: [...col.faceUp],
        }));
        const newWaste = [...s.waste];
        let moved = false;

        // Try tableau cards
        for (let ci = 0; ci < 7 && !moved; ci++) {
          const col = newTableau[ci];
          if (col.faceUp.length === 0) continue;
          const card = col.faceUp[col.faceUp.length - 1];
          for (let fi = 0; fi < 4 && !moved; fi++) {
            if (canPlaceOnFoundation(card, newFoundations[fi])) {
              newFoundations[fi] = [...newFoundations[fi], card];
              col.faceUp = col.faceUp.slice(0, col.faceUp.length - 1);
              // flip next face-down
              if (col.faceUp.length === 0 && col.faceDown.length > 0) {
                col.faceUp = [col.faceDown[col.faceDown.length - 1]];
                col.faceDown = col.faceDown.slice(0, col.faceDown.length - 1);
              }
              moved = true;
            }
          }
        }

        // Try waste top
        if (!moved && s.wasteIndex >= 0 && newWaste.length > 0) {
          const wIdx = Math.min(s.wasteIndex, newWaste.length - 1);
          const card = newWaste[wIdx];
          for (let fi = 0; fi < 4 && !moved; fi++) {
            if (canPlaceOnFoundation(card, newFoundations[fi])) {
              newFoundations[fi] = [...newFoundations[fi], card];
              newWaste.splice(wIdx, 1);
              moved = true;
            }
          }
        }

        if (!moved) {
          if (autoCompleteRef.current) {
            clearInterval(autoCompleteRef.current);
            autoCompleteRef.current = null;
          }
          return s;
        }

        const won = checkWon(newFoundations);
        const newWasteIndex = Math.min(s.wasteIndex, newWaste.length - 1);
        const newPhase: GamePhase = won ? "won" : s.phase;

        return {
          ...s,
          tableau: newTableau,
          foundations: newFoundations,
          waste: newWaste,
          wasteIndex: newWasteIndex,
          moves: s.moves + 1,
          phase: newPhase,
          selected: null,
        };
      });
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (autoCompleteRef.current) {
        clearInterval(autoCompleteRef.current);
        autoCompleteRef.current = null;
      }
    };
  }, []);

  // ── Restart ────────────────────────────────────────────────────────────────

  const restart = useCallback(() => {
    if (autoCompleteRef.current) {
      clearInterval(autoCompleteRef.current);
      autoCompleteRef.current = null;
    }
    setState(makeInitialState());
    setElapsed(0);
  }, []);

  // ── Stock click ────────────────────────────────────────────────────────────

  const handleStockClick = useCallback(() => {
    setState((s) => {
      if (s.phase !== "playing") return s;
      const draw = settings.klondikeDraw;

      if (s.stock.length === 0) {
        // Reset: flip waste back to stock
        if (s.waste.length === 0) return s;
        return {
          ...s,
          stock: [...s.waste].reverse(),
          waste: [],
          wasteIndex: -1,
          selected: null,
          moves: s.moves + 1,
        };
      }

      // Draw from stock to waste
      const toDraw = Math.min(draw, s.stock.length);
      const drawn = s.stock.slice(0, toDraw);
      const newStock = s.stock.slice(toDraw);
      const newWaste = [...s.waste, ...drawn];
      const newWasteIndex = newWaste.length - 1;

      return {
        ...s,
        stock: newStock,
        waste: newWaste,
        wasteIndex: newWasteIndex,
        selected: null,
        moves: s.moves + 1,
      };
    });
  }, [settings.klondikeDraw]);

  // ── Move logic ─────────────────────────────────────────────────────────────

  const tryMoveToFoundation = useCallback(
    (
      from: KlondikeSelection["from"],
      colIndex: number,
      cardIndex: number,
      s: KlondikeState
    ): KlondikeState | null => {
      let card: Card | null = null;

      if (from === "tableau") {
        const col = s.tableau[colIndex];
        if (col.faceUp.length === 0) return null;
        // Only move single card (top of the sequence) to foundation
        if (cardIndex !== col.faceUp.length - 1) return null;
        card = col.faceUp[col.faceUp.length - 1];
      } else if (from === "waste") {
        card = getVisibleWasteCard(s);
      } else if (from === "foundation") {
        if (s.foundations[colIndex].length === 0) return null;
        card = s.foundations[colIndex][s.foundations[colIndex].length - 1];
      }

      if (!card) return null;

      // Find a matching foundation (must be a different pile if source is foundation)
      for (let fi = 0; fi < 4; fi++) {
        // Can't move a foundation card onto the same foundation pile
        if (from === "foundation" && fi === colIndex) continue;

        if (canPlaceOnFoundation(card, s.foundations[fi])) {
          // Build new foundations: add card to fi
          const newFoundations = s.foundations.map((f, i) =>
            i === fi ? [...f, card!] : [...f]
          );

          let newTableau = s.tableau;
          let newWaste = s.waste;
          let newWasteIndex = s.wasteIndex;

          if (from === "tableau") {
            newTableau = s.tableau.map((tCol, ci) => {
              if (ci !== colIndex) return tCol;
              const newFaceUp = tCol.faceUp.slice(0, tCol.faceUp.length - 1);
              const newFaceDown = [...tCol.faceDown];
              // Flip next card if face-up becomes empty
              if (newFaceUp.length === 0 && newFaceDown.length > 0) {
                newFaceUp.push(newFaceDown[newFaceDown.length - 1]);
                newFaceDown.pop();
              }
              return { faceDown: newFaceDown, faceUp: newFaceUp };
            });
          } else if (from === "waste") {
            const wIdx = Math.min(s.wasteIndex, s.waste.length - 1);
            newWaste = [...s.waste];
            newWaste.splice(wIdx, 1);
            newWasteIndex = Math.min(s.wasteIndex, newWaste.length - 1);
          } else if (from === "foundation") {
            // Remove card from source foundation pile
            newFoundations[colIndex] = newFoundations[colIndex].slice(
              0,
              newFoundations[colIndex].length - 1
            );
          }

          const won = checkWon(newFoundations);
          const newPhase: GamePhase = won ? "won" : s.phase;

          return {
            ...s,
            tableau: newTableau,
            foundations: newFoundations,
            waste: newWaste,
            wasteIndex: newWasteIndex,
            selected: null,
            moves: s.moves + 1,
            phase: newPhase,
          };
        }
      }

      return null;
    },
    []
  );

  const tryMoveToTableau = useCallback(
    (
      sel: KlondikeSelection,
      destCol: number,
      s: KlondikeState
    ): KlondikeState | null => {
      // Get the sequence of cards to move
      let cards: Card[] = [];

      if (sel.from === "tableau") {
        const col = s.tableau[sel.colIndex];
        cards = col.faceUp.slice(sel.cardIndex);
      } else if (sel.from === "waste") {
        const wCard = getVisibleWasteCard(s);
        if (!wCard) return null;
        cards = [wCard];
      } else if (sel.from === "foundation") {
        const f = s.foundations[sel.colIndex];
        if (f.length === 0) return null;
        cards = [f[f.length - 1]];
      }

      if (cards.length === 0) return null;

      // Can't move a column onto itself
      if (sel.from === "tableau" && sel.colIndex === destCol) return null;

      const destColData = s.tableau[destCol];
      const topCard =
        destColData.faceUp.length > 0
          ? destColData.faceUp[destColData.faceUp.length - 1]
          : null;

      if (!canPlaceOnTableau(cards[0], topCard)) return null;

      // Build new state
      let newTableau = s.tableau.map((col) => ({
        faceDown: [...col.faceDown],
        faceUp: [...col.faceUp],
      }));
      let newWaste = [...s.waste];
      let newWasteIndex = s.wasteIndex;
      let newFoundations = s.foundations.map((f) => [...f]);

      // Remove from source
      if (sel.from === "tableau") {
        const srcCol = newTableau[sel.colIndex];
        srcCol.faceUp = srcCol.faceUp.slice(0, sel.cardIndex);
        // Flip next face-down if needed
        if (srcCol.faceUp.length === 0 && srcCol.faceDown.length > 0) {
          srcCol.faceUp = [srcCol.faceDown[srcCol.faceDown.length - 1]];
          srcCol.faceDown = srcCol.faceDown.slice(0, srcCol.faceDown.length - 1);
        }
      } else if (sel.from === "waste") {
        const wIdx = Math.min(s.wasteIndex, s.waste.length - 1);
        newWaste.splice(wIdx, 1);
        newWasteIndex = Math.min(s.wasteIndex, newWaste.length - 1);
      } else if (sel.from === "foundation") {
        newFoundations[sel.colIndex] = newFoundations[sel.colIndex].slice(
          0,
          newFoundations[sel.colIndex].length - 1
        );
      }

      // Add to destination
      newTableau[destCol].faceUp = [...newTableau[destCol].faceUp, ...cards];

      return {
        ...s,
        tableau: newTableau,
        foundations: newFoundations,
        waste: newWaste,
        wasteIndex: newWasteIndex,
        selected: null,
        moves: s.moves + 1,
      };
    },
    []
  );

  // ── Click handlers ─────────────────────────────────────────────────────────

  const handleWasteClick = useCallback(() => {
    setState((s) => {
      if (s.phase !== "playing") return s;
      const card = getVisibleWasteCard(s);
      if (!card) return { ...s, selected: null };

      // If already selected from waste → deselect
      if (s.selected?.from === "waste") {
        return { ...s, selected: null };
      }

      // If something is selected, try move to... waste? That's not valid. Change selection.
      if (s.selected) {
        // Can't move to waste, so select waste card instead
        return {
          ...s,
          selected: { from: "waste", colIndex: 0, cardIndex: 0 },
        };
      }

      // Select the waste top
      return {
        ...s,
        selected: { from: "waste", colIndex: 0, cardIndex: 0 },
      };
    });
  }, []);

  const handleFoundationClick = useCallback(
    (fi: number) => {
      setState((s) => {
        if (s.phase !== "playing") return s;

        // If something is selected, try moving it to foundation
        if (s.selected) {
          // Don't move from same foundation to same foundation
          if (s.selected.from === "foundation" && s.selected.colIndex === fi) {
            return { ...s, selected: null };
          }

          const moved = tryMoveToFoundation(
            s.selected.from,
            s.selected.colIndex,
            s.selected.cardIndex,
            s
          );
          if (moved) return moved;

          // If selection is a foundation card, switch selection
          const fTop = s.foundations[fi];
          if (fTop.length > 0) {
            return { ...s, selected: { from: "foundation", colIndex: fi, cardIndex: 0 } };
          }

          return { ...s, selected: null };
        }

        // Select top of foundation
        if (s.foundations[fi].length > 0) {
          return {
            ...s,
            selected: { from: "foundation", colIndex: fi, cardIndex: 0 },
          };
        }

        return s;
      });
    },
    [tryMoveToFoundation]
  );

  const handleTableauCardClick = useCallback(
    (colIndex: number, cardIndex: number) => {
      setState((s) => {
        if (s.phase !== "playing") return s;
        const col = s.tableau[colIndex];
        const card = col.faceUp[cardIndex];
        if (!card) return s;

        // If clicking the same card, deselect
        if (
          s.selected?.from === "tableau" &&
          s.selected.colIndex === colIndex &&
          s.selected.cardIndex === cardIndex
        ) {
          return { ...s, selected: null };
        }

        // If something is selected, try moving to this column
        if (s.selected) {
          const moved = tryMoveToTableau(s.selected, colIndex, s);
          if (moved) return moved;

          // Try double-click-style: if single card and can go to foundation
          // But user clicked a tableau card, not a foundation — try to move selection to foundation
          // first try to move clicked card to foundation if it's the selection target
          // Actually: if move fails, change selection to the clicked card
          return {
            ...s,
            selected: { from: "tableau", colIndex, cardIndex },
          };
        }

        // No selection — select this card
        return {
          ...s,
          selected: { from: "tableau", colIndex, cardIndex },
        };
      });
    },
    [tryMoveToTableau]
  );

  const handleTableauEmptyClick = useCallback(
    (colIndex: number) => {
      setState((s) => {
        if (s.phase !== "playing") return s;
        if (!s.selected) return s;

        const moved = tryMoveToTableau(s.selected, colIndex, s);
        if (moved) return moved;

        return { ...s, selected: null };
      });
    },
    [tryMoveToTableau]
  );

  // Double-click: auto-move to foundation
  const handleTableauCardDblClick = useCallback(
    (colIndex: number, cardIndex: number) => {
      setState((s) => {
        if (s.phase !== "playing") return s;
        const col = s.tableau[colIndex];
        if (cardIndex !== col.faceUp.length - 1) return s; // only top card
        const moved = tryMoveToFoundation("tableau", colIndex, cardIndex, s);
        return moved ?? s;
      });
    },
    [tryMoveToFoundation]
  );

  const handleWasteDblClick = useCallback(() => {
    setState((s) => {
      if (s.phase !== "playing") return s;
      const moved = tryMoveToFoundation("waste", 0, 0, s);
      return moved ?? s;
    });
  }, [tryMoveToFoundation]);

  // ── Valid destination highlighting ─────────────────────────────────────────

  const validTableauDests = useMemo<boolean[]>(() => {
    if (!state.selected) return Array(7).fill(false);
    return state.tableau.map((col, ci) => {
      // Don't highlight source column
      if (state.selected!.from === "tableau" && state.selected!.colIndex === ci) return false;

      let cards: Card[] = [];
      if (state.selected!.from === "tableau") {
        cards = state.tableau[state.selected!.colIndex].faceUp.slice(state.selected!.cardIndex);
      } else if (state.selected!.from === "waste") {
        const wc = getVisibleWasteCard(state);
        if (wc) cards = [wc];
      } else if (state.selected!.from === "foundation") {
        const f = state.foundations[state.selected!.colIndex];
        if (f.length > 0) cards = [f[f.length - 1]];
      }

      if (cards.length === 0) return false;
      const topCard =
        col.faceUp.length > 0 ? col.faceUp[col.faceUp.length - 1] : null;
      return canPlaceOnTableau(cards[0], topCard);
    });
  }, [state]);

  // ── Menus ──────────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  const { tableau, foundations, stock, waste, wasteIndex, selected, moves, phase } = state;
  const wasteTopCard = getVisibleWasteCard(state);
  const canAutoComplete = allFaceUp(tableau) && phase === "playing";
  const autoRunning = autoCompleteRef.current !== null;

  const SUIT_SYMBOLS: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
  };

  return (
    <div className="klondike">
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      {/* Top area: foundations + stock/waste */}
      <div className="klondike__top-row">
        {/* Foundations */}
        <div className="klondike__foundations">
          {FOUNDATION_SUITS.map((suit, fi) => {
            const fPile = foundations[fi];
            const fTop = fPile.length > 0 ? fPile[fPile.length - 1] : null;
            const isSelected =
              selected?.from === "foundation" && selected.colIndex === fi;
            return (
              <div
                key={suit}
                className={
                  "klondike__foundation-slot" +
                  (isSelected ? " klondike__foundation-slot--selected" : "")
                }
                onClick={() => handleFoundationClick(fi)}
                title={`${suit} foundation`}
              >
                {fTop ? (
                  <PlayingCard card={fTop} appearance={appearance} size="sm" />
                ) : (
                  <div className="klondike__empty-slot klondike__empty-slot--suit">
                    <span className="klondike__suit-hint">{SUIT_SYMBOLS[suit]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="klondike__top-spacer" />

        {/* Stock + Waste */}
        <div className="klondike__stock-area">
          {/* Waste */}
          <div
            className={
              "klondike__waste-slot" +
              (selected?.from === "waste" ? " klondike__waste-slot--selected" : "")
            }
            onClick={handleWasteClick}
            onDoubleClick={handleWasteDblClick}
          >
            {wasteTopCard ? (
              <>
                {/* Show peeks of cards behind in draw-3 mode (back=furthest left, mid=closer) */}
                {settings.klondikeDraw === 3 && wasteIndex >= 2 && waste[wasteIndex - 2] && (
                  <div className="klondike__waste-peek klondike__waste-peek--back">
                    <PlayingCard
                      card={waste[wasteIndex - 2]}
                      appearance={appearance}
                      size="sm"
                    />
                  </div>
                )}
                {settings.klondikeDraw === 3 && wasteIndex >= 1 && waste[wasteIndex - 1] && (
                  <div className="klondike__waste-peek klondike__waste-peek--mid">
                    <PlayingCard
                      card={waste[wasteIndex - 1]}
                      appearance={appearance}
                      size="sm"
                    />
                  </div>
                )}
                <div className="klondike__waste-top">
                  <PlayingCard card={wasteTopCard} appearance={appearance} size="sm" />
                </div>
              </>
            ) : (
              <div className="klondike__empty-slot" />
            )}
          </div>

          {/* Stock */}
          <div
            className="klondike__stock-slot"
            onClick={handleStockClick}
            title={stock.length > 0 ? `Stock: ${stock.length} cards` : "Click to reset"}
          >
            {stock.length > 0 ? (
              <PlayingCard
                card={stock[0]}
                faceDown
                appearance={appearance}
                size="sm"
              />
            ) : (
              <div className="klondike__empty-slot klondike__stock-reset">
                <span className="klondike__reset-icon">↺</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="klondike__tableau">
        {tableau.map((col, ci) => {
          const isValidDest = validTableauDests[ci];
          const totalCards = col.faceDown.length + col.faceUp.length;
          // Height: face-down slivers (18px each) + face-up slivers (26px each) + last card full height (72px)
          const colHeight = totalCards === 0
            ? 72
            : col.faceDown.length * 18 +
              (col.faceUp.length > 1 ? (col.faceUp.length - 1) * 26 : 0) +
              72;

          return (
            <div
              key={ci}
              className={
                "klondike__column" +
                (isValidDest ? " klondike__column--valid-dest" : "")
              }
              style={{ height: colHeight }}
              onClick={totalCards === 0 ? () => handleTableauEmptyClick(ci) : undefined}
            >
              {/* Face-down cards */}
              {col.faceDown.map((card, di) => (
                <div
                  key={card.id}
                  className="klondike__facedown-card"
                  style={{ top: di * 18 }}
                >
                  <PlayingCard card={card} faceDown appearance={appearance} size="sm" />
                </div>
              ))}

              {/* Face-up cards */}
              {col.faceUp.map((card, ui) => {
                const topOffset = col.faceDown.length * 18;
                const isSelected =
                  selected?.from === "tableau" &&
                  selected.colIndex === ci &&
                  selected.cardIndex <= ui;
                const isSelectionStart =
                  selected?.from === "tableau" &&
                  selected.colIndex === ci &&
                  selected.cardIndex === ui;
                return (
                  <div
                    key={card.id}
                    className={
                      "klondike__faceup-card" +
                      (isSelected ? " klondike__faceup-card--selected" : "") +
                      (isSelectionStart ? " klondike__faceup-card--selection-start" : "")
                    }
                    style={{ top: topOffset + ui * 26 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTableauCardClick(ci, ui);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleTableauCardDblClick(ci, ui);
                    }}
                  >
                    <PlayingCard card={card} appearance={appearance} size="sm" />
                  </div>
                );
              })}

              {/* Empty column placeholder */}
              {totalCards === 0 && (
                <div className="klondike__empty-slot" />
              )}
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className="klondike__statusbar">
        <span>Moves: {moves}</span>
        <span>Time: {elapsed}s</span>
        <span>Draw: {settings.klondikeDraw}</span>
        {canAutoComplete && !autoRunning && (
          <button className="klondike__autocomplete-btn" onClick={startAutoComplete}>
            Auto-Complete
          </button>
        )}
      </div>

      {/* Win overlay */}
      {phase === "won" && (
        <div className="klondike__win-overlay">
          <div className="klondike__win-banner">
            <div className="klondike__win-title">YOU WIN!</div>
            <div className="klondike__win-stats">
              {moves} moves &bull; {elapsed}s
            </div>
            <button className="klondike__win-btn" onClick={restart}>
              Play Again
            </button>
            {onNewGame && (
              <button className="klondike__win-btn klondike__win-btn--secondary" onClick={onNewGame}>
                New Game
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
