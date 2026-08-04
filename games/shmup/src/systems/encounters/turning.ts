/**
 * What a Unit's `turnRateDegPerSec` and `minSpeed` mean — the runtime twin
 * of `src/experiences/ShmupEditor/turning.ts`, re-declared rather than
 * imported for the same reason as `authoredTypes.ts`: no shared runtime
 * code between the two packages.
 *
 * The two motion stats combine into the one geometric quantity every path
 * decision is made against:
 *
 *     minTurnRadius = minSpeed / radians(turnRateDegPerSec)
 *
 * - **`minSpeed === 0`** — it can stop, so it can pivot on the spot. No
 *   corner is off-limits; a corner costs `pivotSeconds` of standing still.
 * - **`minSpeed > 0`** — it can't stop, so it must arc. Its path is solved
 *   (`pathSolver.ts`) into a tangent-continuous curve that never bends
 *   tighter than `minTurnRadius`.
 *
 * This has to match the editor exactly: the editor draws (and times) the
 * solved path, and the game has to fly that same path.
 */

/** Degrees/sec floor for the Turn rate stat. Deliberately not 0: a Unit that can never change heading can't be routed anywhere, and `minTurnRadius` would be infinite. 1°/s is 6 minutes for a full circle — slower than anything real, but still finite. */
export const MIN_TURN_RATE_DEG_PER_SEC = 1;

/** Turn rate at or above which a Unit is treated as turning instantly for pivot-timing purposes — a person or a light turret spinning at ~2 revolutions/sec doesn't need a measurable pause modelled at this game's timescale. */
export const INSTANT_TURN_DEG_PER_SEC = 720;

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * The tightest circle this Unit can hold, in world units — 0 when it can
 * stop (`minSpeed === 0`), which means "no corner is too sharp; it pivots
 * instead". Everything the path solver enforces is expressed through this
 * one number.
 */
export function minTurnRadius(minSpeed: number, turnRateDegPerSec: number): number {
  if (minSpeed <= 0) return 0;
  const rate = Math.max(MIN_TURN_RATE_DEG_PER_SEC, turnRateDegPerSec);
  return minSpeed / degToRad(rate);
}

/** True when this Unit corners by stopping and rotating rather than by arcing around — the split that decides which routing policy `pathSolver.ts` applies. */
export function canPivotInPlace(minSpeed: number): boolean {
  return minSpeed <= 0;
}

/** Seconds spent stationary while rotating through `angleDeg` — the cost a pivot-capable Unit pays at a corner instead of being unable to make it. */
export function pivotSeconds(angleDeg: number, turnRateDegPerSec: number): number {
  const rate = Math.max(MIN_TURN_RATE_DEG_PER_SEC, turnRateDegPerSec);
  if (rate >= INSTANT_TURN_DEG_PER_SEC) return 0;
  return Math.abs(angleDeg) / rate;
}

/** Smallest signed rotation from `fromDeg` to `toDeg`, in (-180, 180] — so a 350°-to-10° turn is +20°, not -340°. */
export function signedAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/**
 * How fast a Unit may travel through a curve of radius `radius` — a turn
 * it can only hold at `turnRate × radius`, never below its own `minSpeed`
 * (it can't slow further) and never above the speed it was asked for.
 * Tight arcs therefore slow a Unit down on their own, which is what makes
 * a heavy Unit's cornering *read* as heavy rather than just being drawn
 * differently.
 */
export function speedThroughRadius(radius: number, minSpeed: number, maxSpeed: number, turnRateDegPerSec: number): number {
  if (!Number.isFinite(radius)) return maxSpeed;
  const rate = Math.max(MIN_TURN_RATE_DEG_PER_SEC, turnRateDegPerSec);
  const held = degToRad(rate) * radius;
  return Math.min(maxSpeed, Math.max(Math.min(minSpeed, maxSpeed), held));
}
