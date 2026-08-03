/**
 * What a Unit's `turnRateDegPerSec` and `minSpeed` actually mean, in one
 * place, for both the editor and (mirrored) the game.
 *
 * **This replaced a stat that wasn't one.** `turnRate` used to be a cap on
 * how far a bezier handle could stick out, as a multiple of its segment's
 * straight-line length — an authoring constraint on curve editing wearing a
 * ship-handling name. It couldn't limit how sharply a Unit cornered (a
 * corner is the *junction between* two segments, which no handle clamp
 * touches), and on a path whose handles were never hand-dragged it did
 * nothing at all: the default handle is colinear with the segment, so
 * clamping it shorter still leaves a straight line. Worse, its effect
 * wasn't monotonic — a *short* handle is the tightest curve, because the
 * whole turn is crammed into a few pixels, so "drag less" made turns
 * sharper, not gentler.
 *
 * The stat is now literally degrees per second, and the two motion stats
 * combine into the one geometric quantity every path decision is made
 * against:
 *
 *     minTurnRadius = minSpeed / radians(turnRateDegPerSec)
 *
 * A Unit travelling `v` and rotating at most `w` rad/sec can't hold a
 * circle tighter than `v / w`; the tightest circle it can *ever* hold is
 * therefore at its slowest sustained speed. **`minSpeed` is what makes
 * that finite and useful:**
 *
 * - **`minSpeed === 0` — it can stop, so it can pivot.** Its minimum turn
 *   radius is 0: no corner is off-limits, and a corner costs *time*
 *   (`pivotSeconds`) rather than being impossible. Tanks, helicopters and
 *   turrets live here; they drive in straight lines and turn on the spot,
 *   which is exactly how they read on screen.
 * - **`minSpeed > 0` — it can't stop, so it must arc.** Its path is
 *   solved (`pathSolver.ts`) into a tangent-continuous curve that never
 *   bends tighter than `minTurnRadius`, swinging wide through a corner it
 *   couldn't otherwise make. Jets, ships and wheeled vehicles live here.
 *
 * The payoff is that a Unit's stats decide what routes an encounter author
 * can draw with it, without the editor ever having to reject a placement —
 * see `pathSolver.ts`.
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
