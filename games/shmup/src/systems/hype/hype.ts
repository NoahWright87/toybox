/**
 * In-episode Hype meter — Model 1 formulas (hype-and-ratings.spec.md,
 * F7 #135, formulas locked 2026-06-22). Pure functions only; PlayScene owns
 * the HypeState instance and calls these each frame/event.
 */
import { TUNING } from "../../tuning";
import type { HypeState } from "./types";

/** HypeMax = base x crowdSize x itemMods (ceiling rises with the crowd). */
export function hypeMax(crowdSize: number, itemMods = 1): number {
  return TUNING.hype.base * crowdSize * itemMods;
}

/** Hype += eventValue x hypeGainMods, clamped to hypeMaxValue; resets idleTimeSec to 0. Returns a new state. */
export function gainHype(state: HypeState, eventValue: number, hypeMaxValue: number, hypeGainMods = 1): HypeState {
  const hype = Math.min(hypeMaxValue, state.hype + eventValue * hypeGainMods);
  return { hype, idleTimeSec: 0 };
}

/**
 * Super-linear decay: d = baseDecay x (1 + k_idle*idleTime) x (1 + k_level*Hype/HypeMax).
 * Idle time grows by dt; Hype is floored at 0. Returns a new state.
 */
export function decayHype(state: HypeState, dtSec: number, hypeMaxValue: number): HypeState {
  const idleTimeSec = state.idleTimeSec + dtSec;
  if (hypeMaxValue <= 0) return { hype: 0, idleTimeSec };
  const { kIdle, kLevel, baseDecay } = TUNING.hype;
  const d = baseDecay * (1 + kIdle * idleTimeSec) * (1 + kLevel * (state.hype / hypeMaxValue));
  const hype = Math.max(0, state.hype - d * dtSec);
  return { hype, idleTimeSec };
}

/** ScoreMult = 1 + (Hype/HypeMax) x M -- up to x(1+M) at full Hype. */
export function scoreMult(hype: number, hypeMaxValue: number): number {
  if (hypeMaxValue <= 0) return 1;
  return 1 + (hype / hypeMaxValue) * TUNING.hype.scoreMultDepth;
}
