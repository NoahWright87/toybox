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
 * there's nothing to derive a duration from).
 *
 * **Dragging a derived step on the timeline to retime it is gone.** It
 * used to solve for the *preceding* step's own `speedMultiplier` and
 * write that back onto the step — safe, because `speedMultiplier` was a
 * per-placement field. Now that "how fast" lives on the *Action*
 * (`movementPercent`, unitTypes.ts) — a reusable, shared thing referenced
 * by potentially many placements — solving-and-writing-back would quietly
 * rewrite every other placement of that same Action too. There's no
 * longer a safe place to stash a per-placement retime. Retiming a
 * movement segment now means picking a different (or Cloned, differently-
 * tuned) Action for that step, not dragging its timeline marker — the
 * drag-retime gesture survives only for Part-action placements
 * (`partActions.ts`), whose `time` is still freely per-placement authored.
 * `recomputeStepTimes` is the actual derivation pass; call it after any
 * change that could affect distances, handles, or which Action a step
 * references (position drag, handle drag, Action swap) to keep every
 * derived step's stored `time` in sync — `EncounterEditor.tsx` does this
 * by wrapping its `updateInstance` helper rather than calling it at every
 * individual site.
 */
import { cubicBezierLength, distanceBetween, resolveSegment } from "./bezier";
import type { EncounterStep, EncounterUnit } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

/** No segment is allowed to collapse to zero (or negative) duration — degenerate for both the timeline UI and the position-interpolation math. */
export const MIN_STEP_DURATION = 0.1;
/** Below this straight-line distance, a step is treated as dwelling at its predecessor's position rather than traveling — see file header. */
const POSITION_EPSILON = 0.5;
/** Floor for the *effective* movementPercent used in duration math — a segment with a real destination but a ~0% (or unresolved) Action still needs a finite, if very long, duration rather than NaN/Infinity. */
const MIN_EFFECTIVE_MOVEMENT_PERCENT = 1;
/** What a step's duration assumes when its Action can't be resolved (null actionId, or a stale/deleted reference) — full speed, so an unconfigured step doesn't silently stall the timeline. Rendering (movementPreview.ts) is free to treat "no Action" more strictly (e.g. not actually moving); this is purely about keeping the derived `time` math sane. */
const UNRESOLVED_ACTION_MOVEMENT_PERCENT = 100;

/** How long (real seconds) traversing `arcLength` at `speed`, moving at `movementPercent` (0–100) of it, takes. */
export function segmentDuration(arcLength: number, speed: number, movementPercent: number): number {
  const effectivePercent = Math.max(MIN_EFFECTIVE_MOVEMENT_PERCENT, movementPercent);
  const effectiveSpeed = speed > 0 ? speed * (effectivePercent / 100) : 1;
  return Math.max(MIN_STEP_DURATION, arcLength / effectiveSpeed);
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

/** `step`'s own Action's `movementPercent`, or the unresolved-fallback if its `actionId` is null or doesn't match anything in `unitDef.actions`. */
function movementPercentFor(step: EncounterStep, unitDef: UnitDef): number {
  const action = step.actionId ? unitDef.actions.find((a) => a.id === step.actionId) : undefined;
  return action?.movementPercent ?? UNRESOLVED_ACTION_MOVEMENT_PERCENT;
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
      cur.time = prev.time + segmentDuration(arcLength, unitDef.speed, movementPercentFor(prev, unitDef));
    } else {
      cur.time = Math.max(cur.time, prev.time + MIN_STEP_DURATION);
    }
  }
  return { ...instance, steps };
}
