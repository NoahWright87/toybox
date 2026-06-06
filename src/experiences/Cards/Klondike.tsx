import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Cards.css";
import "./Klondike.css";
import { PermCard } from "./PermCard";
import { CardStack } from "./cardStack";
import type { CardVisualState } from "./cardStack";
import type { Card, CardAppearance, DeckSettings } from "./types";
import type { Rank, Suit } from "./types";
import { buildDeck, shuffle } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Stage layout ──────────────────────────────────────────────────────────────

const STAGE_W  = 596;
const STAGE_H  = 520;
const CARD_W   = 72;
const CARD_H   = 100;
const TOP_Y    = 66;
const TAB_Y    = 196;

// 7 column x-centers, evenly spaced
const COL_X: number[] = (() => {
  const gridW = 7 * CARD_W + 6 * 8;
  const startX = (STAGE_W - gridW) / 2 + CARD_W / 2;
  return Array.from({ length: 7 }, (_, i) => startX + i * (CARD_W + 8));
})();

const Z_DRAG = 9000;
const KLONDIKE_SAVE_KEY = "cards-klondike-save";

// ── Persistence helpers ───────────────────────────────────────────────────────

interface SnapshotEntry { id: string; suit: string; rank: string; faceDown: boolean; }
interface KlondikeSnapshot {
  version: number;
  moves: number;
  tableau: SnapshotEntry[][];
  foundations: SnapshotEntry[][];
  stock: SnapshotEntry[];
  waste: SnapshotEntry[];
}

function snapshotStack(stack: CardStack): SnapshotEntry[] {
  const lays = stack.layout(0);
  return stack.cards.map(c => ({
    id: c.id, suit: c.suit as string, rank: c.rank as string,
    faceDown: lays[c.id]?.faceDown ?? false,
  }));
}

// ── Game logic helpers ────────────────────────────────────────────────────────

const RANK_VALUE: Partial<Record<Rank, number>> = {
  "A":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,
};

function rv(card: Card): number { return RANK_VALUE[card.rank as Rank] ?? 0; }

function cardColor(card: Card): "red" | "black" {
  return card.suit === "hearts" || card.suit === "diamonds" ? "red" : "black";
}

function canPlaceOnTableau(card: Card, top: Card | null, relaxed: boolean): boolean {
  if (top === null) return card.rank === "K" || relaxed;
  return rv(card) === rv(top) - 1 && cardColor(card) !== cardColor(top);
}

function canPlaceOnFoundation(card: Card, top: Card | null): boolean {
  if (top === null) return card.rank === "A";
  return card.suit === top.suit && rv(card) === rv(top) + 1;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "shuffle" | "idle" | "animating" | "game-over";
type StackId = `tab-${number}` | `found-${number}` | "stock" | "waste";

interface DragState {
  ids: string[];
  fromStack: StackId;
  originStates: Record<string, CardVisualState>;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  startPx: number;
  startPy: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface KlondikeProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function Klondike({ settings, onNewGame, onQuit }: KlondikeProps) {
  const drawMode = settings.klondikeDraw;
  const relaxed  = settings.klondikeRelaxed;

  const [allCards,      setAllCards]      = useState<Card[]>([]);
  const [cardStates,    setCardStates]    = useState<Record<string, CardVisualState>>({});
  const [phase,         setPhase]         = useState<Phase>("shuffle");
  const [selectedRun,   setSelectedRun]   = useState<string[]>([]);
  const [moves,         setMoves]         = useState(0);
  const [elapsed,       setElapsed]       = useState(0);
  const [stockLeft,     setStockLeft]     = useState(0);
  const [appearance,    setAppearance]    = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [autoComplete,  setAutoComplete]  = useState(false);
  const [scale,         setScale]         = useState(1);

  const stageRef     = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stacks — face-down/face-up offsets for tableau fanning
  const tableau     = useRef<CardStack[]>(
    Array.from({ length: 7 }, (_, i) =>
      new CardStack({ zTier: 5 + i, baseX: COL_X[i], baseY: TAB_Y, faceDownOffsetY: 15, faceUpOffsetY: 20 })
    )
  );
  const foundations = useRef<CardStack[]>(
    Array.from({ length: 4 }, (_, i) =>
      new CardStack({ zTier: 1 + i, baseX: COL_X[3 + i], baseY: TOP_Y })
    )
  );
  const stockStack = useRef(new CardStack({ zTier: 12, baseX: COL_X[0], baseY: TOP_Y }));
  const wasteStack = useRef(new CardStack({ zTier: 13, baseX: COL_X[1], baseY: TOP_Y }));

  const drag = useRef<DragState | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  function after(ms: number, fn: () => void) { timers.current.push(setTimeout(fn, ms)); }

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);
  const ensureTimer = useCallback(() => {
    if (timerRef.current) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current !== null) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  useEffect(() => { if (phase === "game-over") stopTimer(); }, [phase, stopTimer]);
  useEffect(() => () => { stopTimer(); }, [stopTimer]);

  // Scale stage to fit container on narrow screens
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  function applyLayouts(...layouts: Record<string, CardVisualState>[]): void {
    setCardStates(prev => {
      const next = { ...prev };
      for (const l of layouts) Object.assign(next, l);
      return next;
    });
  }

  function stackById(id: StackId): CardStack {
    if (id === "stock") return stockStack.current;
    if (id === "waste") return wasteStack.current;
    if (id.startsWith("found-")) return foundations.current[parseInt(id.slice(6))];
    return tableau.current[parseInt(id.slice(4))];
  }

  // Build visual states for all stacks
  function allLayouts(ms = 250): Record<string, CardVisualState> {
    const result: Record<string, CardVisualState> = {};
    for (const t of tableau.current)     Object.assign(result, t.layout(ms));
    for (const f of foundations.current) Object.assign(result, f.layout(ms));
    Object.assign(result, stockStack.current.layout(ms));
    Object.assign(result, computeWasteLayout(ms));
    return result;
  }

  // Waste visual: draw-3 fans the top 3 cards left→right so all are visible
  function computeWasteLayout(ms = 250): Record<string, CardVisualState> {
    const cards = wasteStack.current.cards;
    if (cards.length === 0) return {};
    if (drawMode === 1 || cards.length <= 1) return wasteStack.current.layout(ms);
    const result: Record<string, CardVisualState> = {};
    const show = Math.min(3, cards.length);
    const base = cards.length - show;
    for (let i = 0; i < base; i++) {
      result[cards[i].id] = { x: COL_X[1], y: TOP_Y, z: 1300 + i, rotation: 0, faceDown: false, transitionMs: ms };
    }
    for (let j = 0; j < show; j++) {
      result[cards[base + j].id] = {
        x: COL_X[1] + (j - (show - 1)) * 8 + (show - 1) * 8,
        y: TOP_Y, z: 1300 + base + j,
        rotation: 0, faceDown: false, transitionMs: ms,
      };
    }
    return result;
  }

  // ── restoreKlondike ────────────────────────────────────────────────────────

  function restoreKlondike(snap: KlondikeSnapshot): void {
    clearTimers();
    stopTimer();
    setElapsed(0);
    startTimeRef.current = null;
    setSelectedRun([]);
    setMoves(snap.moves ?? 0);
    setAutoComplete(false);

    const seen = new Set<string>();
    const allC: Card[] = [];
    const collect = (entries: SnapshotEntry[]) => {
      for (const e of entries) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          allC.push({ id: e.id, suit: e.suit as Suit, rank: e.rank as Rank });
        }
      }
    };
    snap.tableau.forEach(col => collect(col));
    collect(snap.stock);
    collect(snap.waste);
    snap.foundations.forEach(f => collect(f));

    const byId = new Map(allC.map(c => [c.id, c]));

    for (const t of tableau.current)     t.clear();
    for (const f of foundations.current) f.clear();
    stockStack.current.clear();
    wasteStack.current.clear();

    snap.tableau.forEach((col, i) => {
      for (const e of col) {
        const c = byId.get(e.id); if (!c) continue;
        tableau.current[i].addCard(c, { toTop: true, faceDown: e.faceDown });
      }
    });
    snap.foundations.forEach((fi, i) => {
      for (const e of fi) {
        const c = byId.get(e.id); if (!c) continue;
        foundations.current[i].addCard(c, { toTop: true, faceDown: false });
      }
    });
    for (const e of snap.stock) {
      const c = byId.get(e.id); if (!c) continue;
      stockStack.current.addCard(c, { toTop: true, faceDown: true });
    }
    for (const e of snap.waste) {
      const c = byId.get(e.id); if (!c) continue;
      wasteStack.current.addCard(c, { toTop: true, faceDown: false });
    }

    setStockLeft(stockStack.current.size);
    setAllCards(allC);

    // Deal animation: all cards start at stock position, then fan out
    const initStates: Record<string, CardVisualState> = {};
    for (const c of allC) {
      initStates[c.id] = { x: COL_X[0], y: TOP_Y, z: 100, rotation: 0, faceDown: true, transitionMs: 0 };
    }
    setCardStates(initStates);
    setPhase("shuffle");

    const DEAL_MS = 250;
    const finalLayout = allLayouts(DEAL_MS);
    let di = 0;
    for (let col = 0; col < 7; col++) {
      for (const c of tableau.current[col].cards) {
        if (finalLayout[c.id]) finalLayout[c.id] = { ...finalLayout[c.id], transitionDelay: di++ * 28 };
      }
    }
    for (const c of wasteStack.current.cards) {
      if (finalLayout[c.id]) finalLayout[c.id] = { ...finalLayout[c.id], transitionDelay: di++ * 14 };
    }
    for (let f = 0; f < 4; f++) {
      for (const c of foundations.current[f].cards) {
        if (finalLayout[c.id]) finalLayout[c.id] = { ...finalLayout[c.id], transitionDelay: di++ * 14 };
      }
    }
    for (const c of stockStack.current.cards) {
      if (finalLayout[c.id]) finalLayout[c.id] = { ...finalLayout[c.id], transitionDelay: di++ * 6 };
    }

    after(60, () => {
      setCardStates(finalLayout);
      after(DEAL_MS + di * 28 + 200, () => { setCardStates(allLayouts(0)); setPhase("idle"); });
    });
  }

  // ── startGame ──────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    clearTimers();
    stopTimer();
    setElapsed(0);
    startTimeRef.current = null;
    setSelectedRun([]);
    setMoves(0);
    setAutoComplete(false);
    setPhase("shuffle");
    try { localStorage.removeItem(KLONDIKE_SAVE_KEY); } catch {}

    const deck = shuffle(buildDeck({
      ...settings,
      numDecks: 1,
      suits: ["spades", "hearts", "diamonds", "clubs"] as Suit[],
      includeJokers: false,
    }));

    for (const t of tableau.current)     t.clear();
    for (const f of foundations.current) f.clear();
    stockStack.current.clear();
    wasteStack.current.clear();

    const initStates: Record<string, CardVisualState> = {};
    for (const c of deck) {
      initStates[c.id] = { x: COL_X[0], y: TOP_Y, z: 1200, rotation: 0, faceDown: true, transitionMs: 0 };
    }
    setAllCards(deck);
    setCardStates(initStates);

    const SPLIT = 220, PAUSE = 60, MERGE = 160, STAGGER = 6;
    const DEAL_MS = 280;
    const MERGE_TOTAL = MERGE + (deck.length - 1) * STAGGER;

    function mergeAnim(c1: Card[], c2: Card[]): Record<string, CardVisualState> {
      const merged: Card[] = [];
      const len = Math.max(c1.length, c2.length);
      for (let i = 0; i < len; i++) {
        if (i < c1.length) merged.push(c1[i]);
        if (i < c2.length) merged.push(c2[i]);
      }
      const out: Record<string, CardVisualState> = {};
      merged.forEach((c, i) => {
        out[c.id] = { x: COL_X[0], y: TOP_Y, z: 10 + i, rotation: 0, faceDown: true, transitionMs: MERGE, transitionDelay: i * STAGGER };
      });
      return out;
    }

    const half = Math.floor(deck.length / 2);
    const left = deck.slice(0, half), right = deck.slice(half);
    const lx = COL_X[0] - 60, rx = COL_X[0] + 60;

    let now = 80;

    after(now, () => {
      const s: Record<string, CardVisualState> = {};
      left.forEach((c, i)  => { s[c.id] = { x: lx + i*0.4, y: TOP_Y - i*0.4, z: 300+i, rotation: 0, faceDown: true, transitionMs: SPLIT }; });
      right.forEach((c, i) => { s[c.id] = { x: rx - i*0.4, y: TOP_Y - i*0.4, z: 400+i, rotation: 0, faceDown: true, transitionMs: SPLIT }; });
      setCardStates(s);
    });
    now += SPLIT + PAUSE;

    after(now, () => setCardStates(mergeAnim(left, right)));
    now += MERGE_TOTAL + PAUSE;

    after(now, () => {
      const s: Record<string, CardVisualState> = {};
      left.forEach((c, i)  => { s[c.id] = { x: lx + i*0.3, y: TOP_Y - i*0.3, z: 300+i, rotation: 0, faceDown: true, transitionMs: SPLIT }; });
      right.forEach((c, i) => { s[c.id] = { x: rx - i*0.3, y: TOP_Y - i*0.3, z: 400+i, rotation: 0, faceDown: true, transitionMs: SPLIT }; });
      setCardStates(s);
    });
    now += SPLIT + PAUSE;

    after(now, () => setCardStates(mergeAnim(left, right)));
    now += MERGE_TOTAL + PAUSE;

    // Deal: col 0→1 card, col 1→2, ..., col 6→7; rest to stock
    after(now, () => {
      let idx = 0;
      for (let col = 0; col < 7; col++) {
        for (let row = 0; row <= col; row++) {
          tableau.current[col].addCard(deck[idx++], { toTop: true, faceDown: row < col });
        }
      }
      for (let i = idx; i < deck.length; i++) {
        stockStack.current.addCard(deck[i], { toTop: true, faceDown: true });
      }
      setStockLeft(stockStack.current.size);

      // Staggered deal states
      const dealStates: Record<string, CardVisualState> = {};
      idx = 0;
      for (let col = 0; col < 7; col++) {
        for (let row = 0; row <= col; row++) {
          const c = deck[idx++];
          let y = TAB_Y;
          for (let r = 0; r < row; r++) y += 15;
          dealStates[c.id] = {
            x: COL_X[col], y,
            z: 500 + col * 100 + row,
            rotation: 0, faceDown: row < col,
            transitionMs: DEAL_MS, transitionDelay: (col + row) * 40,
          };
        }
      }
      Object.assign(dealStates, stockStack.current.layout(DEAL_MS));
      setCardStates(dealStates);

      after(DEAL_MS + 12 * 40 + 100, () => {
        applyLayouts(allLayouts(0));
        setPhase("idle");
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // Save game state after every move
  useEffect(() => {
    if (allCards.length === 0 || phase === "shuffle") return;
    try {
      const snap: KlondikeSnapshot = {
        version: 1, moves,
        tableau: tableau.current.map(snapshotStack),
        foundations: foundations.current.map(snapshotStack),
        stock: snapshotStack(stockStack.current),
        waste: snapshotStack(wasteStack.current),
      };
      localStorage.setItem(KLONDIKE_SAVE_KEY, JSON.stringify(snap));
    } catch {}
  }, [moves, phase, allCards.length]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KLONDIKE_SAVE_KEY);
      if (raw) {
        const snap = JSON.parse(raw) as KlondikeSnapshot;
        if (snap.version === 1 && Array.isArray(snap.tableau)) {
          restoreKlondike(snap);
          return clearTimers;
        }
      }
    } catch {}
    startGame();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw card ─────────────────────────────────────────────────────────────

  const drawCard = useCallback(() => {
    if (phase !== "idle") return;
    ensureTimer();
    setSelectedRun([]);

    if (stockStack.current.size === 0) {
      if (wasteStack.current.size === 0) return;
      const cards = [...wasteStack.current.cards].reverse();
      wasteStack.current.clear();
      for (const c of cards) stockStack.current.addCard(c, { toTop: true, faceDown: true });
      setStockLeft(stockStack.current.size);
      applyLayouts(stockStack.current.layout(250), computeWasteLayout(250));
      setMoves(m => m + 1);
      return;
    }

    const n = Math.min(drawMode, stockStack.current.size);
    for (let i = 0; i < n; i++) {
      const c = stockStack.current.removeTop();
      if (c) wasteStack.current.addCard(c, { toTop: true, faceDown: false });
    }
    setStockLeft(stockStack.current.size);
    applyLayouts(stockStack.current.layout(200), computeWasteLayout(200));
    setMoves(m => m + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, drawMode]);

  // ── Stack lookup ──────────────────────────────────────────────────────────

  function findStack(cardId: string): StackId | null {
    for (let i = 0; i < 7; i++) {
      if (tableau.current[i].cards.some(c => c.id === cardId)) return `tab-${i}`;
    }
    for (let i = 0; i < 4; i++) {
      if (foundations.current[i].cards.some(c => c.id === cardId)) return `found-${i}`;
    }
    if (stockStack.current.cards.some(c => c.id === cardId)) return "stock";
    if (wasteStack.current.cards.some(c => c.id === cardId)) return "waste";
    return null;
  }

  function getRunFrom(cardId: string, stackId: StackId): Card[] {
    const cards = stackById(stackId).cards;
    const idx = cards.findIndex(c => c.id === cardId);
    return idx === -1 ? [] : cards.slice(idx);
  }

  // ── Drop target detection ─────────────────────────────────────────────────

  function findDropTarget(px: number, py: number, run: Card[]): StackId | null {
    const lead = run[0];
    const THRESH = 55;
    let best: StackId | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < 7; i++) {
      const top = tableau.current[i].top;
      if (!canPlaceOnTableau(lead, top, relaxed)) continue;
      const cy = top ? (cardStates[top.id]?.y ?? TAB_Y) : TAB_Y;
      const dist = Math.hypot(px - COL_X[i], py - cy);
      if (dist < THRESH && dist < bestDist) { bestDist = dist; best = `tab-${i}`; }
    }

    if (run.length === 1) {
      for (let i = 0; i < 4; i++) {
        const top = foundations.current[i].top;
        if (!canPlaceOnFoundation(lead, top)) continue;
        const dist = Math.hypot(px - COL_X[3 + i], py - TOP_Y);
        if (dist < THRESH && dist < bestDist) { bestDist = dist; best = `found-${i}`; }
      }
    }

    return best;
  }

  // ── Execute move ──────────────────────────────────────────────────────────

  function executeMove(run: Card[], fromId: StackId, toId: StackId): void {
    const from = stackById(fromId);
    const to   = stackById(toId);

    for (let i = run.length - 1; i >= 0; i--) from.removeCard(run[i].id);
    if (fromId.startsWith("tab-") && from.size > 0 && from.topFaceDown) from.flipTop();

    const faceDown = toId === "stock";
    for (const c of run) to.addCard(c, { toTop: true, faceDown });

    if (toId === "stock" || toId === "waste") setStockLeft(stockStack.current.size);
    setMoves(m => m + 1);

    const newLayouts = allLayouts(200);
    run.forEach((c, i) => {
      if (newLayouts[c.id]) newLayouts[c.id] = { ...newLayouts[c.id], transitionDelay: i * 40 };
    });
    applyLayouts(newLayouts);
    setSelectedRun([]);

    const won = foundations.current.every(f => f.size === 13);
    if (won) { after(400, () => setPhase("game-over")); return; }

    // Check auto-complete eligibility
    const allFaceUp = tableau.current.every(t => !t.topFaceDown || t.size === 0);
    const noStock   = stockStack.current.size === 0 && wasteStack.current.size === 0;
    setAutoComplete(allFaceUp && noStock);
  }

  // ── Auto-complete ─────────────────────────────────────────────────────────

  const runAutoComplete = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("animating");
    const step = () => {
      let moved = false;
      outer:
      for (const t of tableau.current) {
        const top = t.top;
        if (!top) continue;
        for (let fi = 0; fi < 4; fi++) {
          if (canPlaceOnFoundation(top, foundations.current[fi].top)) {
            t.removeTop();
            if (t.size > 0 && t.topFaceDown) t.flipTop();
            foundations.current[fi].addCard(top, { toTop: true, faceDown: false });
            moved = true;
            break outer;
          }
        }
      }
      // Also check waste
      if (!moved) {
        const top = wasteStack.current.top;
        if (top) {
          for (let fi = 0; fi < 4; fi++) {
            if (canPlaceOnFoundation(top, foundations.current[fi].top)) {
              wasteStack.current.removeTop();
              foundations.current[fi].addCard(top, { toTop: true, faceDown: false });
              moved = true;
              break;
            }
          }
        }
      }
      if (!moved) { setPhase("idle"); return; }
      applyLayouts(allLayouts(200));
      if (foundations.current.every(f => f.size === 13)) {
        after(400, () => setPhase("game-over"));
      } else {
        after(150, step);
      }
    };
    step();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handleCardPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, cardId: string) => {
    if (phase !== "idle") return;
    const cs = cardStates[cardId];
    if (!cs || cs.faceDown) return;

    const stackId = findStack(cardId);
    if (!stackId || stackId === "stock") return;

    // Waste: only top card is draggable
    if (stackId === "waste") {
      const topCard = wasteStack.current.top;
      if (!topCard || topCard.id !== cardId) return;
    }

    const run = getRunFrom(cardId, stackId);
    if (run.length === 0) return;

    // Validate run is a legal alternating-color descending sequence
    for (let i = 1; i < run.length; i++) {
      if (rv(run[i]) !== rv(run[i-1]) - 1 || cardColor(run[i]) === cardColor(run[i-1])) return;
    }

    ensureTimer();
    e.currentTarget.setPointerCapture(e.pointerId);

    const stageEl = stageRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    // Divide by actual rendered size to get stage-native coords (handles CSS scale)
    const stageScale = rect.width / STAGE_W;
    const px = (e.clientX - rect.left) / stageScale;
    const py = (e.clientY - rect.top)  / stageScale;

    drag.current = {
      ids: run.map(c => c.id),
      fromStack: stackId,
      originStates: Object.fromEntries(run.map(c => [c.id, cardStates[c.id]])),
      offsetX: px - cs.x,
      offsetY: py - cs.y,
      moved: false,
      startPx: px,
      startPy: py,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cardStates]);

  const handleStagePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const stageScale = rect.width / STAGE_W;
    const px = (e.clientX - rect.left) / stageScale;
    const py = (e.clientY - rect.top)  / stageScale;

    if (!d.moved) {
      // Compare current pointer to WHERE pointer was at pointerDown
      const dx = px - d.startPx;
      const dy = py - d.startPy;
      if (Math.hypot(dx, dy) < 5) return;
      d.moved = true;
    }

    setCardStates(prev => {
      const next = { ...prev };
      const originLead = d.originStates[d.ids[0]];
      d.ids.forEach((id, i) => {
        const origin = d.originStates[id];
        const offX = origin ? origin.x - originLead.x : 0;
        const offY = origin ? origin.y - originLead.y : 0;
        next[id] = { ...prev[id], x: px - d.offsetX + offX, y: py - d.offsetY + offY, z: Z_DRAG + i, transitionMs: 0 };
      });
      return next;
    });
  }, []);

  const handleStagePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;

    if (!d.moved) {
      // Tap/click — 2-click mode
      const leadId = d.ids[0];
      if (selectedRun.length > 0 && selectedRun[0] !== leadId) {
        const clickedStack = findStack(leadId);
        const fromStack    = findStack(selectedRun[0]);
        if (clickedStack && fromStack) {
          const run = selectedRun.map(id => allCards.find(c => c.id === id)!).filter(Boolean);
          if (run.length > 0) {
            executeMove(run, fromStack, clickedStack);
            return;
          }
        }
      }
      if (selectedRun[0] === leadId) {
        setSelectedRun([]);
        applyLayouts(allLayouts(150));
      } else {
        setSelectedRun(d.ids);
        applyLayouts(allLayouts(150));
      }
      return;
    }

    const stageEl = stageRef.current;
    if (!stageEl) { applyLayouts(allLayouts(200)); return; }
    const rect = stageEl.getBoundingClientRect();
    const stageScale = rect.width / STAGE_W;
    const px = (e.clientX - rect.left) / stageScale;
    const py = (e.clientY - rect.top)  / stageScale;

    const run = d.ids.map(id => allCards.find(c => c.id === id)!).filter(Boolean);
    const target = findDropTarget(px - d.offsetX, py - d.offsetY, run);

    if (target && target !== d.fromStack) {
      executeMove(run, d.fromStack, target);
    } else {
      setCardStates(prev => {
        const next = { ...prev };
        const origins = d.originStates;
        for (const id of Object.keys(origins)) {
          const cs: CardVisualState = origins[id];
          next[id] = { ...cs, transitionMs: 200 };
        }
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards, cardStates, selectedRun, relaxed]);

  // Double-click: auto-send top card to foundation
  const handleCardDoubleClick = useCallback((cardId: string) => {
    if (phase !== "idle") return;
    const stackId = findStack(cardId);
    if (!stackId) return;
    if (stackById(stackId).top?.id !== cardId) return;
    const card = allCards.find(c => c.id === cardId);
    if (!card) return;
    for (let fi = 0; fi < 4; fi++) {
      if (canPlaceOnFoundation(card, foundations.current[fi].top)) {
        executeMove([card], stackId, `found-${fi}`);
        return;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, allCards]);

  // 2-click: click a foundation slot directly
  const handleFoundationClick = useCallback((foundIdx: number) => {
    if (phase !== "idle" || selectedRun.length === 0) return;
    const run = selectedRun.map(id => allCards.find(c => c.id === id)!).filter(Boolean);
    if (run.length !== 1) return;
    const fromId = findStack(selectedRun[0]);
    if (!fromId) return;
    if (canPlaceOnFoundation(run[0], foundations.current[foundIdx].top)) {
      executeMove(run, fromId, `found-${foundIdx}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedRun, allCards]);

  // 2-click: click an empty tableau column
  const handleEmptyTabClick = useCallback((col: number) => {
    if (phase !== "idle" || selectedRun.length === 0) return;
    const run = selectedRun.map(id => allCards.find(c => c.id === id)!).filter(Boolean);
    const fromId = findStack(selectedRun[0]);
    if (!fromId || !canPlaceOnTableau(run[0], null, relaxed)) return;
    executeMove(run, fromId, `tab-${col}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedRun, allCards, relaxed]);

  // ── Menus ─────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const gameItems: MenuBarMenu["items"] = [
      { label: "New Game",    onClick: startGame },
      ...(onNewGame ? [{ label: "Change Game…", onClick: onNewGame }] : []),
      ...(onQuit    ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game",    items: gameItems },
      { label: "Options", items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }] },
    ];
  }, [startGame, onNewGame, onQuit]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="klondike">
      {showDeckModal && (
        <DeckModal appearance={appearance} onUpdate={setAppearance} onClose={() => setShowDeckModal(false)} />
      )}

      {/* Container measures available width; stage scales down to fit */}
      <div
        ref={containerRef}
        className="klondike__stage-container"
        style={{ height: Math.round(STAGE_H * scale) + 4 }}
      >
        <div
          ref={stageRef}
          className="klondike__stage"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
        >
          {/* Waste slot outline */}
          <div className="klondike__slot" style={{ left: COL_X[1] - CARD_W/2, top: TOP_Y - CARD_H/2 }} />

          {/* Foundation slots */}
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className="klondike__slot klondike__slot--foundation"
              style={{ left: COL_X[3+i] - CARD_W/2, top: TOP_Y - CARD_H/2 }}
              onClick={() => handleFoundationClick(i)}
            >
              <span className="klondike__slot-suit">{["♠","♥","♦","♣"][i]}</span>
            </div>
          ))}

          {/* Empty tableau column slots */}
          {tableau.current.map((t, i) => t.size === 0 && (
            <div
              key={i}
              className="klondike__slot"
              style={{ left: COL_X[i] - CARD_W/2, top: TAB_Y - CARD_H/2 }}
              onClick={() => handleEmptyTabClick(i)}
            />
          ))}

          {/* All 52 cards — permanently mounted */}
          {allCards.map(card => {
            const cs = cardStates[card.id];
            if (!cs) return null;
            const isSelected  = selectedRun.includes(card.id);
            const isTopStock  = stockStack.current.top?.id === card.id;
            const canInteract = !cs.faceDown && phase === "idle";
            return (
              <PermCard
                key={card.id}
                card={card}
                cs={cs}
                appearance={appearance}
                highlightColor={isSelected ? "#cc4400" : undefined}
                onClick={isTopStock ? drawCard : undefined}
                onDoubleClick={canInteract && !isTopStock ? () => handleCardDoubleClick(card.id) : undefined}
                onPointerDown={canInteract ? (e) => handleCardPointerDown(e, card.id) : undefined}
              />
            );
          })}

          {/* Stock click-catcher: transparent overlay above stock cards so taps work */}
          <div
            className="klondike__stock-hit"
            style={{
              left: COL_X[0] - CARD_W/2,
              top: TOP_Y - CARD_H/2,
              border: stockLeft === 0 ? "2px dashed rgba(255,255,255,0.25)" : "none",
            }}
            onClick={drawCard}
          >
            {stockLeft === 0 && <span className="klondike__slot-icon">↺</span>}
          </div>

          {/* Win overlay — inside stage so it's contained by isolation context */}
          {phase === "game-over" && (
            <div className="klondike__win-overlay">
              <div className="klondike__win-banner">
                <div className="klondike__win-title">You Win!</div>
                <div className="klondike__win-stats">{moves} moves · {elapsed}s</div>
                <button className="klondike__btn klondike__btn--primary" onClick={startGame}>Play Again</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="klondike__statusbar">
        <span>Moves: {moves}</span>
        <span>Stock: {stockLeft}</span>
        <span>Draw {drawMode}</span>
        <span>Time: {elapsed}s</span>
        {autoComplete && phase === "idle" && (
          <button className="klondike__btn klondike__btn--primary klondike__btn--sm" onClick={runAutoComplete}>
            Auto-Complete
          </button>
        )}
      </div>

      <div className="klondike__controls">
        <button className="klondike__btn klondike__btn--primary" onClick={startGame}>New Game</button>
        {onNewGame && <button className="klondike__btn klondike__btn--secondary" onClick={onNewGame}>Change Game</button>}
      </div>
    </div>
  );
}
