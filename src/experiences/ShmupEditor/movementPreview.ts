/**
 * Interpolates a unit instance's actual position at any encounter-time `t`
 * for the timeline scrubber's live motion preview (specs/shmup-editor.md's
 * Timing section). This is the editor's own preview approximation —
 * `games/shmup` mirrors the same math (`systems/encounters/movement.ts`)
 * rather than sharing it, the same "no shared code" stance the whole
 * editor takes toward the game.
 *
 * **The path comes from `pathSolver.ts`, not from the steps directly.**
 * A Unit's `minSpeed`/`turnRateDegPerSec` (`turning.ts`) decide what shape
 * it can actually fly between the authored waypoints, so the preview shows
 * the *solved* path: a jet swings wide through a corner it can't turn on
 * the spot, while a tank drives the straight legs and pivots.
 *
 * **A pivot is a real, timed pause.** For a Unit that can stop
 * (`minSpeed === 0`), a corner costs `pivotSeconds` of standing still
 * while it rotates — so the traversal of a segment is "hold at the
 * waypoint rotating, then travel". That hold is part of the step's own
 * time budget (`encounterTiming.ts` builds it into the next step's
 * `time`), and this file replays it: position freezes and heading
 * interpolates from the arrival heading to the departure one.
 *
 * **A step at the same position as its predecessor (dwelling), or a step
 * with no next waypoint at all, holds in place — it never moves in the
 * preview.** There's no principled destination to head toward in either
 * case, so the preview doesn't guess one; freezing is the only outcome
 * that can never look like the unit "keeps traveling after it reaches the
 * final node" (a real bug this editor hit before this behavior existed).
 *
 * **`invincible` replaces the old per-step `visible` flag** — derived by
 * walking the instance's own steps' `actionId`s through the owning Unit's
 * Action buffet (`actionState.ts`'s `resolveInvincibleAt`), not read
 * directly off the step. Until a real animation system exists to swap in
 * an alternate sprite, rendering code treats `invincible` the same way it
 * used to treat `visible === false` — hide the sprite as a temporary
 * stand-in (unitTypes.ts's file header).
 */
import { cubicBezierPoint, distanceBetween } from "./bezier";
import { activeStepAt } from "./encounterSteps";
import { resolveInvincibleAt } from "./actionState";
import { limitsFor, solvePathCached, type SolvedPath } from "./pathSolver";
import { signedAngleDelta } from "./turning";
import type { EncounterStep, EncounterUnit, Vec2 } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

export interface InstancePreview {
  pos: Vec2;
  step: EncounterStep;
  invincible: boolean;
}

/** How far past the last step's time the timeline ruler extends, purely for layout (so the final diamond isn't flush against the edge) — not used for motion preview, which holds terminal/dwelling steps in place. */
export const LAST_STEP_PREVIEW_WINDOW = 3;

/** Stand-in heading (degrees, down) for `computeInstanceHeadingDeg` when an instance is dwelling/stationary and has no solved tangent to fall back on either. Same convention as ActionPreview.tsx's own stand-in for the isolated (no-real-path) authoring preview. */
const STATIONARY_HEADING_FALLBACK_DEG = 90;

const POSITION_EPSILON = 0.5;

/** Time delta used to numerically differentiate the bezier position curve for `computeInstanceHeadingDeg` — small enough to closely track the curve's real tangent, large enough to stay well clear of floating-point noise. */
const HEADING_EPSILON_SEC = 0.05;

/** The instance's solved path — one segment per consecutive pair of steps, plus the pivot pauses and headings its Unit's turning limits imply. Memoized, so calling it per frame per instance is fine. */
export function solveInstancePath(instance: EncounterUnit, unitDef: UnitDef): SolvedPath {
  return solvePathCached(instance.steps, limitsFor(unitDef));
}

/** The instance's interpolated position at encounter-time `t`, or null if it hasn't spawned yet (t before its first step) or its Unit can't be resolved. */
export function computeInstancePreview(instance: EncounterUnit, unitDef: UnitDef | undefined, t: number): InstancePreview | null {
  if (!unitDef) return null;
  const step = activeStepAt(instance, t);
  if (!step) return null;
  const invincible = resolveInvincibleAt(instance.steps, unitDef.actions, t);

  const idx = instance.steps.findIndex((s) => s.id === step.id);
  const next = instance.steps[idx + 1];
  if (!next || distanceBetween(step.pos, next.pos) <= POSITION_EPSILON) {
    return { pos: step.pos, step, invincible }; // no destination to head toward — hold in place
  }

  const solved = solveInstancePath(instance, unitDef);
  const pivot = solved.pivotSec[idx] ?? 0;
  const elapsed = t - step.time;
  if (elapsed <= pivot) {
    return { pos: step.pos, step, invincible }; // still turning on the spot before setting off
  }

  const travelDuration = next.time - step.time - pivot;
  const u = travelDuration > 0 ? Math.min(1, Math.max(0, (elapsed - pivot) / travelDuration)) : 0;
  const segment = solved.segments[idx];
  if (!segment) return { pos: step.pos, step, invincible };
  return { pos: cubicBezierPoint(segment.p0, segment.p1, segment.p2, segment.p3, u), step, invincible };
}

/**
 * The instance's facing (degrees, 0 = +x / 90 = +y) at encounter-time `t`
 * — used to resolve a `facing: "faceMovement"` Action to a real angle.
 *
 * Numerically differentiated from the position curve while travelling.
 * **While pivoting it can't be**, since the position isn't changing: the
 * heading there is interpolated across the pivot from the solved arrival
 * tangent to the solved departure one, which is precisely the rotation the
 * pivot exists to pay for. Without that, a tank would sit motionless
 * through its corner and then snap.
 */
export function computeInstanceHeadingDeg(instance: EncounterUnit, unitDef: UnitDef | undefined, t: number): number {
  if (!unitDef) return STATIONARY_HEADING_FALLBACK_DEG;
  const step = activeStepAt(instance, t);
  if (!step) return STATIONARY_HEADING_FALLBACK_DEG;
  const idx = instance.steps.findIndex((s) => s.id === step.id);
  const solved = solveInstancePath(instance, unitDef);
  const pivot = solved.pivotSec[idx] ?? 0;
  const elapsed = t - step.time;

  if (pivot > 0 && elapsed <= pivot) {
    const from = solved.headingInDeg[idx] ?? STATIONARY_HEADING_FALLBACK_DEG;
    const to = solved.headingOutDeg[idx] ?? from;
    return from + signedAngleDelta(from, to) * Math.min(1, Math.max(0, elapsed / pivot));
  }

  const a = computeInstancePreview(instance, unitDef, t);
  const b = computeInstancePreview(instance, unitDef, t + HEADING_EPSILON_SEC);
  if (a && b) {
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    if (Math.hypot(dx, dy) >= 0.01) return (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  // Dwelling or past the final waypoint: hold the heading the solve gave this
  // waypoint, so a Unit that has travelled keeps pointing where it ended up
  // rather than snapping. An instance that never moves at all has no direction
  // of travel to hold, so it takes the documented stand-in instead.
  const travels = solved.segments.some((s) => s.length > POSITION_EPSILON);
  return travels ? (solved.headingOutDeg[idx] ?? STATIONARY_HEADING_FALLBACK_DEG) : STATIONARY_HEADING_FALLBACK_DEG;
}
