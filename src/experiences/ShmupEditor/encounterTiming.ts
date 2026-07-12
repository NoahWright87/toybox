/**
 * Derives an EncounterStep's `time` from distance and speed instead of
 * treating it as a fully independent authored number (specs/shmup-editor.md's
 * timeline scrubber section) — fixes a real bug where a step's time-on-the-
 * timeline had no relationship to how long its movement actually took to
 * cover the distance, so a fast unit would sail straight past its next
 * waypoint (or the last one, forever) long before/after the timeline said
 * it should.
 *
 * **A step's `time` is derived whenever its *preceding* step's Action has
 * movement** — there's a real destination and a real speed to compute a
 * duration from. It stays manually authored when there's no preceding step
 * (the first step of an instance — this is *when the unit spawns*, nothing
 * to derive) or the preceding step's Action is stationary (dwelling has no
 * destination, so there's nothing to derive a duration from either).
 *
 * Dragging a *derived* step on the timeline (EncounterTimeline.tsx) doesn't
 * set its `time` directly — it solves for the `speedMultiplier` the
 * *preceding* step would need to arrive exactly there
 * (`speedMultiplierForDuration`), and writes that onto the preceding step's
 * `EncounterStep`, never onto the shared `ActionDef` — the whole point of
 * the per-step override fields is tuning pacing without mutating a Unit's
 * reusable Action buffet. `recomputeStepTimes` is the actual derivation
 * pass; call it after any change that could affect distances or speeds
 * (position drag, action change, speedMultiplier change) to keep every
 * derived step's stored `time` in sync — `EncounterEditor.tsx` does this by
 * wrapping its `updateInstance` helper rather than calling it at every
 * individual site.
 */
import type { EncounterStep, EncounterUnit, Vec2 } from "./encounterTypes";
import type { MovementBehavior, UnitDef } from "./unitTypes";

/** No segment is allowed to collapse to zero (or negative) duration — degenerate for both the timeline UI and the position-interpolation math. */
export const MIN_STEP_DURATION = 0.1;
/** Used when a movement's params genuinely can't reach the target distance (e.g. decelerating to a stop short of it) — a reasonable default rather than Infinity/NaN leaking into the UI. */
const FALLBACK_DURATION = 2;
const MIN_MULTIPLIER = 0.05;
const MAX_MULTIPLIER = 20;

export function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Elapsed time (at speedMultiplier 1) for a movement's base path to cover
 * `distance` — the same "along the base A→B path" progress
 * movementPreview.ts's positionFor uses, just solved in reverse. Exported
 * so movementPreview.ts can clamp a segment's preview to "however far the
 * base path actually gets before reaching the destination," rather than
 * overshooting past it when a step's authored time is longer than the
 * movement's natural travel time.
 */
export function baseElapsedFor(movement: MovementBehavior, distance: number): number {
  if (distance <= 0) return 0;
  switch (movement.kind) {
    case "straightLine": {
      const { speed, accel } = movement;
      if (accel === 0) {
        return speed > 0 ? distance / speed : FALLBACK_DURATION;
      }
      // Solve 0.5*accel*t^2 + speed*t - distance = 0 for the smallest positive t.
      const a = 0.5 * accel;
      const b = speed;
      const c = -distance;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) return FALLBACK_DURATION; // these params never reach that far
      const sqrtDisc = Math.sqrt(discriminant);
      const candidates = [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)].filter((t) => t > 0);
      return candidates.length > 0 ? Math.min(...candidates) : FALLBACK_DURATION;
    }
    case "wave":
    case "spiral":
      // Oscillation/orbit is perpendicular to the base path, so it doesn't affect along-path distance.
      return movement.speed > 0 ? distance / movement.speed : FALLBACK_DURATION;
  }
}

/** How long (real seconds) this movement takes to cover `distance`, at `speedMultiplier`. */
export function segmentDuration(movement: MovementBehavior, speedMultiplier: number, distance: number): number {
  const multiplier = speedMultiplier > 0 ? speedMultiplier : 1;
  return Math.max(MIN_STEP_DURATION, baseElapsedFor(movement, distance) / multiplier);
}

/** Inverse of segmentDuration — the speedMultiplier that makes this movement cover `distance` in exactly `desiredDuration`. Used when a derived step is dragged on the timeline. */
export function speedMultiplierForDuration(movement: MovementBehavior, distance: number, desiredDuration: number): number {
  const duration = Math.max(MIN_STEP_DURATION, desiredDuration);
  const multiplier = baseElapsedFor(movement, distance) / duration;
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, multiplier));
}

/** True if `stepId`'s time is computed (its preceding step's Action moves) rather than manually authored. */
export function isStepTimeDerived(instance: EncounterUnit, stepId: string, unitDef: UnitDef | undefined): boolean {
  const idx = instance.steps.findIndex((s) => s.id === stepId);
  if (idx <= 0) return false;
  const prevAction = unitDef?.actions.find((a) => a.id === instance.steps[idx - 1].actionId);
  return prevAction?.movement != null;
}

/**
 * Walks the instance's steps in array order (the authorial sequence — see
 * file header, this is no longer sorted-by-time separately from that) and
 * recomputes every derived step's `time`. A manually-timed step is left
 * alone except for a floor at "after its predecessor," so a stale value
 * can't leave the sequence out of order.
 */
export function recomputeStepTimes(instance: EncounterUnit, unitDef: UnitDef | undefined): EncounterUnit {
  if (instance.steps.length === 0) return instance;
  const steps: EncounterStep[] = instance.steps.map((s) => ({ ...s }));
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const prevAction = unitDef?.actions.find((a) => a.id === prev.actionId);
    if (prevAction?.movement) {
      const d = distanceBetween(prev.pos, steps[i].pos);
      steps[i].time = prev.time + segmentDuration(prevAction.movement, prev.speedMultiplier, d);
    } else {
      steps[i].time = Math.max(steps[i].time, prev.time + MIN_STEP_DURATION);
    }
  }
  return { ...instance, steps };
}
