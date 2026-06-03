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
 *
 * Variable fan: when faceDownOffsetY / faceUpOffsetY are provided, layout()
 * accumulates Y positions using the per-card state rather than a uniform step.
 * This lets Klondike tableau columns fan face-down cards tightly and face-up
 * cards wider so rank/suit remains readable.
 */
export class CardStack {
  readonly zTier: number;
  baseX: number;
  baseY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly faceDownOffsetY?: number;
  readonly faceUpOffsetY?: number;
  private entries: StackEntry[] = [];

  constructor(opts: {
    zTier: number;
    baseX: number;
    baseY: number;
    offsetX?: number;
    offsetY?: number;
    faceDownOffsetY?: number;
    faceUpOffsetY?: number;
  }) {
    this.zTier            = opts.zTier;
    this.baseX            = opts.baseX;
    this.baseY            = opts.baseY;
    this.offsetX          = opts.offsetX ?? 0;
    this.offsetY          = opts.offsetY ?? 0;
    this.faceDownOffsetY  = opts.faceDownOffsetY;
    this.faceUpOffsetY    = opts.faceUpOffsetY;
  }

  get size(): number { return this.entries.length; }

  /** Returns a snapshot of card references, bottom → top. */
  get cards(): Card[] { return this.entries.map(e => e.card); }

  /** Top card reference without removing it. */
  get top(): Card | null { return this.entries.length > 0 ? this.entries[this.entries.length - 1].card : null; }

  /** Whether the top card is face-down. */
  get topFaceDown(): boolean {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1].faceDown : false;
  }

  clear(): void { this.entries = []; }

  /**
   * Add a card.
   * toTop=true  → top of stack (highest z, rendered on top).
   * toTop=false → bottom of stack (z = zTier*100 + 0, slides under existing cards).
   */
  addCard(card: Card, opts: { toTop: boolean; faceDown: boolean; rotation?: number }): void {
    const entry: StackEntry = { card, faceDown: opts.faceDown, rotation: opts.rotation ?? 0 };
    if (opts.toTop) { this.entries.push(entry); }
    else            { this.entries.unshift(entry); }
  }

  /** Remove and return the top card, or null if empty. */
  removeTop(): Card | null {
    return this.entries.pop()?.card ?? null;
  }

  /**
   * Remove the top N cards (as a run, bottom→top order) and return them.
   * Used by Klondike to lift a sequence off a tableau column.
   */
  removeTopN(n: number): Card[] {
    if (n <= 0) return [];
    const run = this.entries.splice(this.entries.length - n, n).map(e => e.card);
    return run;
  }

  /** Remove a specific card by id. Returns the card, or null if not found. */
  removeCard(id: string): Card | null {
    const idx = this.entries.findIndex(e => e.card.id === id);
    if (idx === -1) return null;
    return this.entries.splice(idx, 1)[0].card;
  }

  /** Flip the top card face-up. No-op if stack is empty or top is already face-up. */
  flipTop(): void {
    if (this.entries.length > 0) {
      this.entries[this.entries.length - 1].faceDown = false;
    }
  }

  /** Update the faceDown state of a specific card by id (used for hole-card reveal). */
  setFaceDown(id: string, faceDown: boolean): void {
    const entry = this.entries.find(e => e.card.id === id);
    if (entry) entry.faceDown = faceDown;
  }

  setBase(x: number, y: number): void { this.baseX = x; this.baseY = y; }

  /**
   * Compute visual state for every card in this stack.
   *
   * If faceDownOffsetY / faceUpOffsetY are set, Y positions are accumulated
   * (each card's Y = previous card's Y + that card's step), allowing columns
   * where face-down cards are packed tighter than face-up cards.
   */
  layout(transitionMs = 350): Record<string, CardVisualState> {
    const result: Record<string, CardVisualState> = {};
    const variableFan = this.faceDownOffsetY !== undefined || this.faceUpOffsetY !== undefined;

    if (variableFan) {
      let accumY = this.baseY;
      for (let i = 0; i < this.entries.length; i++) {
        const e = this.entries[i];
        result[e.card.id] = {
          x:          this.baseX + i * this.offsetX,
          y:          accumY,
          z:          this.zTier * 100 + i,
          rotation:   e.rotation,
          faceDown:   e.faceDown,
          transitionMs,
        };
        const step = e.faceDown
          ? (this.faceDownOffsetY ?? this.offsetY)
          : (this.faceUpOffsetY  ?? this.offsetY);
        accumY += step;
      }
    } else {
      for (let i = 0; i < this.entries.length; i++) {
        const e = this.entries[i];
        result[e.card.id] = {
          x:          this.baseX + i * this.offsetX,
          y:          this.baseY + i * this.offsetY,
          z:          this.zTier * 100 + i,
          rotation:   e.rotation,
          faceDown:   e.faceDown,
          transitionMs,
        };
      }
    }
    return result;
  }
}
