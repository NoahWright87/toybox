/**
 * Data shapes for grazing, Hype, and Ratings (hype-and-ratings.spec.md,
 * F7 #135 — Model 1). Pure types only; behavior lives in the sibling
 * modules (grazeRings.ts, grazeTracker.ts, hype.ts, ratings.ts, eventBus.ts).
 */
import type { RatingsTierId } from "../../content";

/** One concentric ring, as a fraction of the grazeRadius stat (TUNING.graze.rings). */
export interface GrazeRingDef {
  frac: number;
  mult: number;
}

/** A single graze relationship starting or ending — keyed by an opaque id (e.g. an EnemyBullet's spawnId), not an object reference, since pooled entities are reused. */
export type GrazeEvent =
  | { type: "start"; id: number; ring: GrazeRingDef; streak: number }
  | { type: "end"; id: number; streak: number };

/** In-episode Hype meter state (hype-and-ratings.spec.md's HYPE formulas). */
export interface HypeState {
  hype: number;
  /** Seconds since the last Hype gain — drives the super-linear decay term; reset to 0 on any gain. */
  idleTimeSec: number;
}

export interface ScoreEventPayload {
  /** What produced this score, for debug/audience tagging — e.g. "kill", "graze". */
  source: string;
  /** Pre-multiplier amount. */
  baseAmount: number;
  scoreMult: number;
  /** baseAmount * scoreMult — what actually got added to the episode score. */
  amount: number;
}

export interface RatingsChangedPayload {
  ratings: number;
  delta: number;
  tier: RatingsTierId;
  cancelled: boolean;
}

export interface HypeChangedPayload {
  hype: number;
  hypeMax: number;
  scoreMult: number;
}

/**
 * The documented event API (acceptance criteria: "graze start/end, Hype
 * changed, Ratings changed, score event") that items (F4), the audience
 * service (T10 #161), and Score (C14 #163) subscribe to once they exist.
 * Nothing outside this package consumes it yet — PlayScene both emits and
 * is the sole subscriber for now (HUD + debug readout).
 */
export interface ShmupEventMap {
  grazeStart: Extract<GrazeEvent, { type: "start" }>;
  grazeEnd: Extract<GrazeEvent, { type: "end" }>;
  hypeChanged: HypeChangedPayload;
  ratingsChanged: RatingsChangedPayload;
  scoreEvent: ScoreEventPayload;
}
