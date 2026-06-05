import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Cards.css";
import "./FreeCell.css";
import { PermCard } from "./PermCard";
import { CardStack } from "./cardStack";
import type { CardVisualState } from "./cardStack";
import type { Card, CardAppearance, DeckSettings, Suit } from "./types";
import { shuffle } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Layout ────────────────────────────────────────────────────────────────────

const STAGE_W  = 520;
const STAGE_H  = 540;
const TOP_Y    = 50;
const CASC_Y   = 152;
const FAN_STEP = 22;
const ANIM_Z   = 9000;
const ANIM_MS  = 180;
const STEP_MS  = 220;

// 8 evenly-spaced column centers for sm cards (52px wide) with 8px gaps
const COL_X = (() => {
  const gw = 8 * 52 + 7 * 8;
  const sx = (STAGE_W - gw) / 2 + 26;
  return Array.from({ length: 8 }, (_, i) => sx + i * 60);
})();

const CARD_W = 52;
const CARD_H = 72;

const SUIT_SYMBOL: Record<string, string> = { spades:"♠", hearts:"♥", diamonds:"♦", clubs:"♣" };
const FOUNDATION_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

// ── Game helpers ──────────────────────────────────────────────────────────────

const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"] as const;
const SUITS: Suit[] = ["spades","hearts","diamonds","clubs"];
const RV: Record<string, number> = {
  A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13,
};

function isRed(s: string) { return s === "hearts" || s === "diamonds"; }
function canStack(top: Card, base: Card): boolean {
  return isRed(top.suit) !== isRed(base.suit) && RV[top.rank] === RV[base.rank] - 1;
}
function canFound(c: Card, pile: Card[]): boolean {
  if (pile.length === 0) return RV[c.rank] === 1;
  const t = pile[pile.length - 1];
  return t.suit === c.suit && RV[c.rank] === RV[t.rank] + 1;
}
function isValidSeq(cards: Card[]): boolean {
  for (let i = 0; i < cards.length - 1; i++) if (!canStack(cards[i + 1], cards[i])) return false;
  return true;
}
function maxMovable(fcs: (Card|null)[], cols: Card[][], excl: number): number {
  const ef = fcs.filter(c => c === null).length;
  const ec = cols.filter((c, i) => i !== excl && c.length === 0).length;
  return (ef + 1) * Math.pow(2, ec);
}
function isSafeAuto(card: Card, foundations: Card[][]): boolean {
  const v = RV[card.rank];
  if (v <= 2) return true;
  const need = v - 1;
  const opp = isRed(card.suit) ? SUITS.filter(s => !isRed(s)) : SUITS.filter(s => isRed(s));
  return opp.every(s => {
    const fi = SUITS.indexOf(s);
    const top = foundations[fi].length > 0 ? RV[foundations[fi][foundations[fi].length - 1].rank] : 0;
    return top >= need;
  });
}

// ── Animation step planner ────────────────────────────────────────────────────
// seq: bottom-to-top (seq[0] placed on destination first, last card placed last).
// Routes multi-card moves visibly through free cells and empty columns.

interface AnimStep { cardId: string; x: number; y: number; z: number; }

function planSteps(
  seq: Card[],
  dx: number, dy: number, dc: number,
  afc: Array<{x:number;y:number}>,
  acc: Array<{x:number;y:number}>,
  out: AnimStep[]
): void {
  const n = seq.length;
  if (n === 0) return;
  if (n === 1) { out.push({ cardId:seq[0].id, x:dx, y:dy+dc*FAN_STEP, z:ANIM_Z }); return; }
  if (afc.length >= n - 1) {
    for (let i = n - 1; i >= 1; i--)
      out.push({ cardId:seq[i].id, x:afc[n-1-i].x, y:afc[n-1-i].y, z:ANIM_Z+i });
    out.push({ cardId:seq[0].id, x:dx, y:dy+dc*FAN_STEP, z:ANIM_Z });
    for (let i = 1; i < n; i++)
      out.push({ cardId:seq[i].id, x:dx, y:dy+(dc+i)*FAN_STEP, z:ANIM_Z+(n-i) });
    return;
  }
  if (acc.length === 0) return;
  const tmp = acc[0], rem = acc.slice(1);
  const split = Math.ceil(n / 2);
  planSteps(seq.slice(n - split), tmp.x, tmp.y, 0, afc, rem, out);
  planSteps(seq.slice(0, n - split), dx, dy, dc, afc, rem, out);
  planSteps(seq.slice(n - split), dx, dy, dc + (n - split), afc, rem, out);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FCGame {
  cascades:    Card[][];
  freeCells:   (Card|null)[];
  foundations: Card[][];
}
type SelFrom = "cascade" | "freecell";
interface Selection { from: SelFrom; idx: number; startDepth: number; cards: Card[]; }
type Phase = "dealing" | "playing" | "animating" | "won";
interface FCProps { settings: DeckSettings; onNewGame?: () => void; onQuit?: () => void; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function FreeCell({ settings, onNewGame, onQuit }: FCProps) {
  const [allCards,      setAllCards]      = useState<Card[]>([]);
  const [cardStates,    setCardStates]    = useState<Record<string, CardVisualState>>({});
  const [game,          setGame]          = useState<FCGame>(() => ({
    cascades: Array.from({length:8}, () => []), freeCells:[null,null,null,null], foundations:[[],[],[],[]]
  }));
  const [phase,         setPhase]         = useState<Phase>("dealing");
  const [selected,      setSelected]      = useState<Selection | null>(null);
  const [moves,         setMoves]         = useState(0);
  const [appearance,    setAppearance]    = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [scale,         setScale]         = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const isAnim       = useRef(false);
  const gameRef      = useRef<FCGame>({ cascades: Array.from({length:8},()=>[]), freeCells:[null,null,null,null], foundations:[[],[],[],[]] });
  const timers       = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  function after(ms: number, fn: () => void) { timers.current.push(setTimeout(fn, ms)); }

  const cascSt = useRef(
    Array.from({length:8}, (_, i) =>
      new CardStack({ zTier:10+i, baseX:COL_X[i], baseY:CASC_Y, faceUpOffsetY:FAN_STEP })
    )
  );
  const fcSt = useRef(
    Array.from({length:4}, (_, i) =>
      new CardStack({ zTier:5+i, baseX:COL_X[i], baseY:TOP_Y })
    )
  );
  const foundSt = useRef(
    Array.from({length:4}, (_, i) =>
      new CardStack({ zTier:1+i, baseX:COL_X[4+i], baseY:TOP_Y })
    )
  );

  function allLayouts(ms = 250): Record<string, CardVisualState> {
    const r: Record<string, CardVisualState> = {};
    for (const s of cascSt.current)  Object.assign(r, s.layout(ms));
    for (const s of fcSt.current)    Object.assign(r, s.layout(ms));
    for (const s of foundSt.current) Object.assign(r, s.layout(ms));
    return r;
  }

  function syncStacks(g: FCGame): void {
    for (let i = 0; i < 8; i++) {
      cascSt.current[i].clear();
      for (const c of g.cascades[i]) cascSt.current[i].addCard(c, { toTop:true, faceDown:false });
    }
    for (let i = 0; i < 4; i++) {
      fcSt.current[i].clear();
      if (g.freeCells[i]) fcSt.current[i].addCard(g.freeCells[i]!, { toTop:true, faceDown:false });
    }
    for (let i = 0; i < 4; i++) {
      foundSt.current[i].clear();
      for (const c of g.foundations[i]) foundSt.current[i].addCard(c, { toTop:true, faceDown:false });
    }
  }

  function findAutoMove(g: FCGame): {
    card: Card; fi: number; fromKind: "freecell"|"cascade"; fromIdx: number; newG: FCGame;
  } | null {
    for (let i = 0; i < 4; i++) {
      const c = g.freeCells[i]; if (!c) continue;
      const fi = SUITS.indexOf(c.suit as Suit);
      if (fi >= 0 && canFound(c, g.foundations[fi]) && isSafeAuto(c, g.foundations)) {
        return { card:c, fi, fromKind:"freecell", fromIdx:i,
          newG: { ...g, freeCells:g.freeCells.map((fc,j):Card|null => j===i ? null : fc),
                        foundations:g.foundations.map((f,j) => j===fi ? [...f,c] : f) } };
      }
    }
    for (let col = 0; col < 8; col++) {
      if (g.cascades[col].length === 0) continue;
      const c = g.cascades[col][g.cascades[col].length - 1];
      const fi = SUITS.indexOf(c.suit as Suit);
      if (fi >= 0 && canFound(c, g.foundations[fi]) && isSafeAuto(c, g.foundations)) {
        return { card:c, fi, fromKind:"cascade", fromIdx:col,
          newG: { ...g, cascades:g.cascades.map((col2,j) => j===col ? col2.slice(0,-1) : col2),
                        foundations:g.foundations.map((f,j) => j===fi ? [...f,c] : f) } };
      }
    }
    return null;
  }

  function animateAutoMoves(g: FCGame, onDone: (finalG: FCGame) => void): void {
    const move = findAutoMove(g);
    if (!move) { onDone(g); return; }
    const { card, fi, fromKind, fromIdx, newG } = move;
    setCardStates(prev => ({
      ...prev,
      [card.id]: { ...prev[card.id], x:COL_X[4+fi], y:TOP_Y, z:ANIM_Z+1, transitionMs:200, transitionDelay:0 },
    }));
    after(300, () => {
      if (fromKind === "freecell") fcSt.current[fromIdx].clear();
      else cascSt.current[fromIdx].removeTop();
      foundSt.current[fi].addCard(card, { toTop:true, faceDown:false });
      setCardStates(allLayouts(0));
      animateAutoMoves(newG, onDone);
    });
  }

  function completeMove(newG: FCGame): void {
    syncStacks(newG);
    gameRef.current = newG;
    setGame(newG);
    setCardStates(allLayouts(0));
    setMoves(m => m + 1);
    animateAutoMoves(newG, (finalG) => {
      gameRef.current = finalG;
      setGame(finalG);
      setCardStates(allLayouts(0));
      isAnim.current = false;
      setPhase(finalG.foundations.every(f => f.length === 13) ? "won" : "playing");
    });
  }

  // Scale to fit container
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      setScale(Math.min(1, width / STAGE_W, height / STAGE_H));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── startGame ────────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    clearTimers();
    isAnim.current = false;
    setSelected(null);
    setMoves(0);
    setPhase("dealing");

    const deck: Card[] = [];
    for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank, id:`${suit}-${rank}` });
    const shuffled = shuffle(deck);

    for (const s of cascSt.current)  s.clear();
    for (const s of fcSt.current)    s.clear();
    for (const s of foundSt.current) s.clear();

    const cascades: Card[][] = Array.from({length:8}, () => []);
    let idx = 0;
    for (let col = 0; col < 8; col++) {
      const count = col < 4 ? 7 : 6;
      for (let i = 0; i < count; i++) {
        cascades[col].push(shuffled[idx]);
        cascSt.current[col].addCard(shuffled[idx], { toTop:true, faceDown:false });
        idx++;
      }
    }

    const newG: FCGame = { cascades, freeCells:[null,null,null,null], foundations:[[],[],[],[]] };
    gameRef.current = newG;
    setAllCards(shuffled);
    setGame(newG);

    const initStates: Record<string, CardVisualState> = {};
    for (const c of shuffled) initStates[c.id] = { x:STAGE_W/2, y:-80, z:100, rotation:0, faceDown:false, transitionMs:0 };
    setCardStates(initStates);

    after(80, () => {
      const dealStates: Record<string, CardVisualState> = {};
      let di = 0;
      for (let col = 0; col < 8; col++) {
        const count = col < 4 ? 7 : 6;
        for (let i = 0; i < count; i++) {
          const c = shuffled[di++];
          dealStates[c.id] = {
            x:COL_X[col], y:CASC_Y + i * FAN_STEP, z:(10+col)*100+i,
            rotation:0, faceDown:false, transitionMs:240, transitionDelay:(col + i) * 28,
          };
        }
      }
      setCardStates(dealStates);
      after(240 + 14 * 28 + 120, () => { setCardStates(allLayouts(0)); setPhase("playing"); });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, clearTimers]);

  useEffect(() => { startGame(); return clearTimers; }, []); // eslint-disable-line

  // ── Move executors ────────────────────────────────────────────────────────────

  function execAnimSteps(steps: AnimStep[], onDone: () => void): void {
    setPhase("animating"); isAnim.current = true; setSelected(null);
    let t = 0;
    for (const step of steps) {
      const s = step;
      after(t, () => setCardStates(prev => ({
        ...prev, [s.cardId]: { ...prev[s.cardId], x:s.x, y:s.y, z:s.z, transitionMs:ANIM_MS, transitionDelay:0 }
      })));
      t += STEP_MS;
    }
    after(t + ANIM_MS, onDone);
  }

  function doMoveToCol(sel: Selection, destColIdx: number): boolean {
    const g = gameRef.current;
    const destCol = g.cascades[destColIdx];
    const movingCards = sel.cards;

    if (destCol.length > 0 && !canStack(movingCards[0], destCol[destCol.length - 1])) return false;
    const excl = sel.from === "cascade" ? sel.idx : -1;
    if (movingCards.length > maxMovable(g.freeCells, g.cascades, destColIdx)) return false;

    const availFC = g.freeCells
      .map((c, i): {x:number;y:number}|null => c === null ? { x:COL_X[i], y:TOP_Y } : null)
      .filter((x): x is {x:number;y:number} => x !== null);
    const availCC = g.cascades
      .map((c, i): {x:number;y:number}|null =>
        (i !== destColIdx && i !== excl && c.length === 0) ? { x:COL_X[i], y:CASC_Y } : null)
      .filter((x): x is {x:number;y:number} => x !== null);

    const steps: AnimStep[] = [];
    planSteps(movingCards, COL_X[destColIdx], CASC_Y, destCol.length, availFC, availCC, steps);
    if (steps.length === 0) return false;

    const capSel = { ...sel }, capDest = destColIdx, capCards = [...movingCards];
    execAnimSteps(steps, () => {
      const prev = gameRef.current;
      const newCascades = prev.cascades.map((col, i): Card[] => {
        if (capSel.from === "cascade" && i === capSel.idx) return col.slice(0, capSel.startDepth);
        if (i === capDest) return [...col, ...capCards];
        return col;
      });
      const newFCs = prev.freeCells.map((c, i): Card|null =>
        capSel.from === "freecell" && i === capSel.idx ? null : c
      );
      completeMove({ cascades:newCascades, freeCells:newFCs, foundations:prev.foundations });
    });
    return true;
  }

  function doMoveToFC(sel: Selection, fcIdx: number): boolean {
    const g = gameRef.current;
    if (g.freeCells[fcIdx] !== null || sel.cards.length !== 1) return false;
    const card = sel.cards[0];
    const steps: AnimStep[] = [{ cardId:card.id, x:COL_X[fcIdx], y:TOP_Y, z:ANIM_Z }];
    const capSel = { ...sel }, capFC = fcIdx, capCard = card;
    execAnimSteps(steps, () => {
      const prev = gameRef.current;
      const newFCs = prev.freeCells.map((c, i): Card|null => i === capFC ? capCard : c);
      const newCascades = capSel.from === "cascade"
        ? prev.cascades.map((col, i) => i === capSel.idx ? col.slice(0, capSel.startDepth) : col)
        : prev.cascades;
      completeMove({ cascades:newCascades, freeCells:newFCs, foundations:prev.foundations });
    });
    return true;
  }

  function doMoveToFoundation(sel: Selection, foundIdx: number): boolean {
    const g = gameRef.current;
    if (sel.cards.length !== 1) return false;
    const card = sel.cards[0];
    if (!canFound(card, g.foundations[foundIdx])) return false;
    const steps: AnimStep[] = [{ cardId:card.id, x:COL_X[4+foundIdx], y:TOP_Y, z:ANIM_Z }];
    const capSel = { ...sel }, capFI = foundIdx, capCard = card;
    execAnimSteps(steps, () => {
      const prev = gameRef.current;
      const newFounds = prev.foundations.map((f, i) => i === capFI ? [...f, capCard] : f);
      const newCascades = capSel.from === "cascade"
        ? prev.cascades.map((col, i) => i === capSel.idx ? col.slice(0, capSel.startDepth) : col)
        : prev.cascades;
      const newFCs = prev.freeCells.map((c, i): Card|null =>
        capSel.from === "freecell" && i === capSel.idx ? null : c
      );
      completeMove({ cascades:newCascades, freeCells:newFCs, foundations:newFounds });
    });
    return true;
  }

  // ── Click handlers ────────────────────────────────────────────────────────────

  const handleCardClick = useCallback((cardId: string) => {
    if (isAnim.current || phase !== "playing") return;
    const g = gameRef.current;

    let kind: "cascade"|"freecell"|"foundation" = "cascade";
    let col = -1, depth = -1;
    found: {
      for (let c = 0; c < 8; c++) {
        const d = g.cascades[c].findIndex(x => x.id === cardId);
        if (d >= 0) { kind="cascade"; col=c; depth=d; break found; }
      }
      for (let i = 0; i < 4; i++) {
        if (g.freeCells[i]?.id === cardId) { kind="freecell"; col=i; depth=0; break found; }
      }
      for (let i = 0; i < 4; i++) {
        const d = g.foundations[i].findIndex(x => x.id === cardId);
        if (d >= 0) { kind="foundation"; col=i; depth=d; break found; }
      }
      return;
    }

    const sel = selected;

    if (!sel) {
      if (kind === "foundation") return;
      if (kind === "freecell") {
        setSelected({ from:"freecell", idx:col, startDepth:0, cards:[g.freeCells[col]!] });
        return;
      }
      const seq = g.cascades[col].slice(depth);
      if (isValidSeq(seq)) setSelected({ from:"cascade", idx:col, startDepth:depth, cards:seq });
      return;
    }

    if (kind === "foundation") {
      if (!doMoveToFoundation(sel, col)) setSelected(null);
      return;
    }
    if (kind === "freecell") {
      if (sel.from === "freecell" && sel.idx === col) { setSelected(null); return; }
      if (g.freeCells[col] === null) {
        if (!doMoveToFC(sel, col)) setSelected(null);
      } else {
        setSelected({ from:"freecell", idx:col, startDepth:0, cards:[g.freeCells[col]!] });
      }
      return;
    }
    // cascade
    if (sel.from === "cascade" && sel.idx === col && sel.startDepth === depth) { setSelected(null); return; }
    const destCol = g.cascades[col];
    if (depth === destCol.length - 1 || destCol.length === 0) {
      if (!doMoveToCol(sel, col)) {
        const seq = destCol.slice(depth);
        if (seq.length > 0 && isValidSeq(seq)) setSelected({ from:"cascade", idx:col, startDepth:depth, cards:seq });
        else setSelected(null);
      }
      return;
    }
    const seq2 = destCol.slice(depth);
    if (isValidSeq(seq2)) setSelected({ from:"cascade", idx:col, startDepth:depth, cards:seq2 });
    else setSelected(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected]);

  const handleEmptyColClick = useCallback((colIdx: number) => {
    if (isAnim.current || phase !== "playing" || !selected) return;
    if (!doMoveToCol(selected, colIdx)) setSelected(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected]);

  const handleEmptyFCClick = useCallback((fcIdx: number) => {
    if (isAnim.current || phase !== "playing" || !selected) return;
    if (!doMoveToFC(selected, fcIdx)) setSelected(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected]);

  const handleFoundationSlotClick = useCallback((foundIdx: number) => {
    if (isAnim.current || phase !== "playing" || !selected) return;
    if (!doMoveToFoundation(selected, foundIdx)) setSelected(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected]);

  const handleAutoMove = useCallback(() => {
    if (isAnim.current || phase !== "playing") return;
    isAnim.current = true;
    setPhase("animating");
    animateAutoMoves(gameRef.current, (finalG) => {
      gameRef.current = finalG;
      setGame(finalG);
      setCardStates(allLayouts(0));
      isAnim.current = false;
      setPhase(finalG.foundations.every(f => f.length === 13) ? "won" : "playing");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Derived render state ──────────────────────────────────────────────────────

  const selectedIds = useMemo(() => new Set(selected?.cards.map(c => c.id) ?? []), [selected]);

  const cardLocs = useMemo(() => {
    const m = new Map<string, {kind:"cascade"|"freecell"|"foundation"; col:number; depth:number}>();
    game.cascades.forEach((col, ci) => col.forEach((c, di) => m.set(c.id, {kind:"cascade",col:ci,depth:di})));
    game.freeCells.forEach((c, i) => { if (c) m.set(c.id, {kind:"freecell",col:i,depth:0}); });
    game.foundations.forEach((f, i) => f.forEach((c, di) => m.set(c.id, {kind:"foundation",col:i,depth:di})));
    return m;
  }, [game]);

  // ── Menus ─────────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const items: MenuBarMenu["items"] = [
      { label:"New Game", onClick: startGame },
      ...(onNewGame ? [{ label:"Change Game…", onClick: onNewGame }] : []),
      ...(onQuit    ? [{ separator:true as const }, { label:"Exit", onClick: onQuit }] : []),
    ];
    return [
      { label:"Game",    items },
      { label:"Options", items:[{ label:"Card Appearance…", onClick:() => setShowDeckModal(true) }] },
    ];
  }, [startGame, onNewGame, onQuit]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="freecell">
      {showDeckModal && (
        <DeckModal appearance={appearance} onUpdate={setAppearance} onClose={() => setShowDeckModal(false)} />
      )}

      <div ref={containerRef} className="freecell__stage-container">
        <div
          className="freecell__stage"
          style={{ width:STAGE_W, height:STAGE_H, transform:`scale(${scale})`, transformOrigin:"top left" }}
        >
          {/* Free cell slots */}
          {game.freeCells.map((fc, i) => (
            <div
              key={`fc-${i}`}
              className="freecell__slot freecell__slot--freecell"
              style={{ left:COL_X[i] - CARD_W/2, top:TOP_Y - CARD_H/2 }}
              onClick={fc === null ? () => handleEmptyFCClick(i) : undefined}
            />
          ))}

          {/* Foundation slots */}
          {FOUNDATION_SUITS.map((suit, i) => (
            <div
              key={suit}
              className="freecell__slot freecell__slot--foundation"
              style={{ left:COL_X[4+i] - CARD_W/2, top:TOP_Y - CARD_H/2 }}
              onClick={() => handleFoundationSlotClick(i)}
            >
              {game.foundations[i].length === 0 &&
                <span className="freecell__suit-hint">{SUIT_SYMBOL[suit]}</span>}
            </div>
          ))}

          {/* Empty cascade column slots */}
          {game.cascades.map((col, i) => col.length === 0 && (
            <div
              key={`casc-${i}`}
              className="freecell__slot"
              style={{ left:COL_X[i] - CARD_W/2, top:CASC_Y - CARD_H/2 }}
              onClick={() => handleEmptyColClick(i)}
            />
          ))}

          {/* All 52 cards permanently mounted */}
          {allCards.map(card => {
            const cs = cardStates[card.id];
            if (!cs) return null;
            const loc = cardLocs.get(card.id);
            const isHighlighted = selectedIds.has(card.id);
            let onClick: (() => void) | undefined;
            if (phase === "playing" && loc) {
              if (loc.kind === "foundation") {
                if (loc.depth === game.foundations[loc.col].length - 1)
                  onClick = () => handleFoundationSlotClick(loc.col);
              } else {
                onClick = () => handleCardClick(card.id);
              }
            }
            return (
              <PermCard
                key={card.id}
                card={card}
                cs={cs}
                appearance={appearance}
                size="sm"
                highlightColor={isHighlighted ? "#cc4400" : undefined}
                onClick={onClick}
              />
            );
          })}

          {/* Win overlay */}
          {phase === "won" && (
            <div className="freecell__win-overlay">
              <div className="freecell__win-banner">
                <div className="freecell__win-title">You Win!</div>
                <div className="freecell__win-moves">Completed in {moves} moves</div>
                <div className="freecell__win-btns">
                  <button className="freecell__btn freecell__btn--primary" onClick={startGame}>Play Again</button>
                  {onNewGame && (
                    <button className="freecell__btn freecell__btn--secondary" onClick={onNewGame}>New Game</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="freecell__statusbar">
        <span>Moves: {moves}</span>
        <button className="freecell__auto-btn" onClick={handleAutoMove} disabled={phase !== "playing"}>
          Auto
        </button>
      </div>

      <div className="freecell__controls">
        <button className="freecell__btn freecell__btn--primary" onClick={startGame}>New Game</button>
        {onNewGame && (
          <button className="freecell__btn freecell__btn--secondary" onClick={onNewGame}>Change Game</button>
        )}
      </div>
    </div>
  );
}
