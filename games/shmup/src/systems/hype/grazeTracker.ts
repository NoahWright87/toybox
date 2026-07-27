/**
 * Diffs per-frame graze state to emit start/end events (hype-and-ratings.spec.md,
 * F7 #135). Keyed by an opaque id (EnemyBullet.spawnId), not object reference,
 * since pooled bullets are reused across fires.
 */
import type { GrazeEvent, GrazeRingDef } from "./types";

export interface GrazeFrameResult {
  events: GrazeEvent[];
  /** Count of bullets currently grazed simultaneously, after this frame's update. */
  streak: number;
  /** Sum of ring.mult across all currently-active grazes — feeds the Hype gain rate directly. */
  totalMult: number;
}

export class GrazeTracker {
  private active = new Map<number, GrazeRingDef>();

  /** Pass this frame's id -> ring map (already innermost-ring-resolved per bullet). */
  update(current: ReadonlyMap<number, GrazeRingDef>): GrazeFrameResult {
    const events: GrazeEvent[] = [];

    for (const [id, ring] of current) {
      if (!this.active.has(id)) {
        events.push({ type: "start", id, ring, streak: current.size });
      }
    }
    for (const id of this.active.keys()) {
      if (!current.has(id)) {
        events.push({ type: "end", id, streak: current.size });
      }
    }

    this.active = new Map(current);

    let totalMult = 0;
    for (const ring of this.active.values()) totalMult += ring.mult;

    return { events, streak: this.active.size, totalMult };
  }

  reset(): void {
    this.active.clear();
  }
}
