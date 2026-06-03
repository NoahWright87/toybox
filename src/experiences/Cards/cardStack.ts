import type { Card } from "./types";

export interface CardVisualState {
  x: number;
  y: number;
  z: number;
  rotation: number;
  faceDown: boolean;
  transitionMs: number;
  transitionDelay?: number;  // per-card stagger for riffle effect
}

interface StackEntry {
  card: Card;
  faceDown: boolean;
  rotation: number;
}

/**
 * Pure-logic stack primitive — no React.
 *
 * Manages an ordered list of cards (index 0 = bottom, index n-1 = top) and
 * computes absolute x/y/z positions within a stage. Call layout() after any
 * mutation to get the new CardVisualState map, then merge into React state.
 */
export class CardStack {
  readonly zTier: number;
  baseX: number;
  baseY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  private entries: StackEntry[] = [];

  constructor(opts: {
    zTier: number;
    baseX: number;
    baseY: number;
    offsetX?: number;
    offsetY?: number;
  }) {
    this.zTier = opts.zTier;
    this.baseX = opts.baseX;
    this.baseY = opts.baseY;
    this.offsetX = opts.offsetX ?? 0;
    this.offsetY = opts.offsetY ?? 0;
  }

  get size(): number { return this.entries.length; }

  /** Returns a snapshot of card references, bottom → top. */
  get cards(): Card[] { return this.entries.map(e => e.card); }

  clear(): void { this.entries = []; }

  /**
   * Add a card.
   * toTop=true  → top of stack (highest z, rendered on top).
   * toTop=false → bottom of stack (z = zTier*100 + 0, slides under existing cards).
   */
  addCard(card: Card, opts: { toTop: boolean; faceDown: boolean; rotation?: number }): void {
    const entry: StackEntry = { card, faceDown: opts.faceDown, rotation: opts.rotation ?? 0 };
    if (opts.toTop) { this.entries.push(entry); }
    else { this.entries.unshift(entry); }
  }

  /** Remove and return the top card, or null if empty. */
  removeTop(): Card | null {
    return this.entries.pop()?.card ?? null;
  }

  /** Remove a specific card by id. Returns the card, or null if not found. */
  removeCard(id: string): Card | null {
    const idx = this.entries.findIndex(e => e.card.id === id);
    if (idx === -1) return null;
    return this.entries.splice(idx, 1)[0].card;
  }

  setBase(x: number, y: number): void { this.baseX = x; this.baseY = y; }

  /** Compute visual state for every card in this stack. */
  layout(transitionMs = 350): Record<string, CardVisualState> {
    const result: Record<string, CardVisualState> = {};
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      result[e.card.id] = {
        x: this.baseX + i * this.offsetX,
        y: this.baseY + i * this.offsetY,
        z: this.zTier * 100 + i,
        rotation: e.rotation,
        faceDown: e.faceDown,
        transitionMs,
      };
    }
    return result;
  }
}
