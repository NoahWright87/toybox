/**
 * Derives an EncounterStep's `time` from the bezier segment's arc length
 * and the owning Unit's `speed` instead of treating it as a fully
 * independent authored number (specs/shmup-editor.md's Timing section) —
 * fixes a real bug where a step's time-on-the-timeline had no relationship
 * to how long its movement actually took to cover the distance, so a fast
 * unit would sail straight past its next waypoint (or the last one,
 * forever) long before/after the timeline said it should.
 *
 * **A step's `time` is derived whenever its position differs from its
 * predecessor's** — there's a real curve (`bezier.ts`) and a real speed
 * (the owning Unit's, unitTypes.ts) to compute a duration from. It stays
 * manually authored when there's no preceding step (the first step of an
 * instance — this is *when the unit spawns*, nothing to derive) or the
 * predecessor is at the *same position* (dwelling has no destination, so
 * there's nothing to derive a duration from — this replaced the old "the
 * predecessor's Action is stationary" check once movement stopped being
 * an Action-level concept at all).
 *
 * Dragging a *derived* step on the timeline (EncounterTimeline.tsx) doesn't
 * set its `time` directly — it solves for the `speedMultiplier` the
 * *preceding* step would need to arrive exactly there
 * (`speedMultiplierForDuration`), and writes that onto the preceding step's
 * `EncounterStep`, never onto the shared `UnitDef` — the whole point of
 * the per-step override fields is tuning pacing without mutating a Unit's
 * reusable stats. `recomputeStepTimes` is the actual derivation pass; call
 * it after any change that could affect distances, handles, or speed
 * (position drag, handle drag, speedMultiplier change) to keep every
 * derived step's stored `time` in sync — `EncounterEditor.tsx` does this by
 * wrapping its `updateInstance` helper rather than calling it at every
 * individual site.
 */
import { cubicBezierLength, distanceBetween, resolveSegment } from "./bezier";
import type { EncounterStep, EncounterUnit } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

/** No segment is allowed to collapse to zero (or negative) duration — degenerate for both the timeline UI and the position-interpolation math. */
export const MIN_STEP_DURATION = 0.1;
/** Below this straight-line distance, a step is treated as dwelling at its predecessor's position rather than traveling — see file header. */
const POSITION_EPSILON = 0.5;
const MIN_MULTIPLIER = 0.05;
const MAX_MULTIPLIER = 20;

/** How long (real seconds) traversing `arcLength` at `speed`/`speedMultiplier` takes. */
export function segmentDuration(arcLength: number, speed: number, speedMultiplier: number): number {
  const effectiveSpeed = speed > 0 ? speed * (speedMultiplier > 0 ? speedMultiplier : 1) : 1;
  return Math.max(MIN_STEP_DURATION, arcLength / effectiveSpeed);
}

/** Inverse of segmentDuration — the speedMultiplier that covers `arcLength` at `speed` in exactly `desiredDuration`. Used when a derived step is dragged on the timeline. */
export function speedMultiplierForDuration(arcLength: number, speed: number, desiredDuration: number): number {
  const duration = Math.max(MIN_STEP_DURATION, desiredDuration);
  const effectiveSpeed = arcLength / duration;
  const multiplier = speed > 0 ? effectiveSpeed / speed : 1;
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, multiplier));
}

/** The bezier arc length (bezier.ts) of the segment from `prev` to `cur`, resolved against `unitDef`'s turnRate. */
export function segmentArcLength(prev: EncounterStep, cur: EncounterStep, unitDef: UnitDef): number {
  const { p0, p1, p2, p3 } = resolveSegment(prev, cur, unitDef.turnRate);
  return cubicBezierLength(p0, p1, p2, p3);
}

/** True if `stepId`'s time is computed (its position differs from its predecessor's) rather than manually authored. */
export function isStepTimeDerived(instance: EncounterUnit, stepId: string, unitDef: UnitDef | undefined): boolean {
  if (!unitDef) return false;
  const idx = instance.steps.findIndex((s) => s.id === stepId);
  if (idx <= 0) return false;
  return distanceBetween(instance.steps[idx - 1].pos, instance.steps[idx].pos) > POSITION_EPSILON;
}

/**
 * Walks the instance's steps in array order (the authorial sequence — see
 * encounterTypes.ts, this is no longer sorted-by-time separately from
 * that) and recomputes every derived step's `time`. A manually-timed step
 * (dwelling at the same position as its predecessor) is left alone except
 * for a floor at "after its predecessor," so a stale value can't leave the
 * sequence out of order.
 */
export function recomputeStepTimes(instance: EncounterUnit, unitDef: UnitDef | undefined): EncounterUnit {
  if (instance.steps.length === 0 || !unitDef) return instance;
  const steps: EncounterStep[] = instance.steps.map((s) => ({ ...s }));
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const cur = steps[i];
    if (distanceBetween(prev.pos, cur.pos) > POSITION_EPSILON) {
      const arcLength = segmentArcLength(prev, cur, unitDef);
      cur.time = prev.time + segmentDuration(arcLength, unitDef.speed, prev.speedMultiplier);
    } else {
      cur.time = Math.max(cur.time, prev.time + MIN_STEP_DURATION);
    }
  }
  return { ...instance, steps };
}
