/**
 * Interpolates a unit instance's actual position at any encounter-time `t`
 * for the timeline scrubber's live motion preview (specs/shmup-editor.md's
 * Timing section). This is the editor's own preview approximation —
 * there's no shared runtime to match (`games/shmup` has no enemy-movement
 * implementation yet), the same "no shared code" stance the whole editor
 * already takes toward the game.
 *
 * **Every segment is a single cubic bezier curve** (`bezier.ts`) between
 * two steps' positions, shaped by their `handleIn`/`handleOut` and paced by
 * the owning Unit's `speed`. Since a segment's duration (`next.time -
 * step.time`) is *derived* from that exact same curve's arc length divided
 * by speed (`encounterTiming.ts`), evaluating the curve at `u =
 * elapsed/duration` lands almost exactly on the destination at `u = 1` by
 * construction — there's no separate overshoot-clamp needed here anymore
 * the way the old per-movement-kind system needed one; `u` is simply
 * clamped to `[0, 1]` as a numerical-precision safety net.
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
import { cubicBezierPoint, distanceBetween, resolveSegment } from "./bezier";
import { activeStepAt } from "./encounterSteps";
import { resolveInvincibleAt } from "./actionState";
import type { EncounterStep, EncounterUnit, Vec2 } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

export interface InstancePreview {
  pos: Vec2;
  step: EncounterStep;
  invincible: boolean;
}

/** How far past the last step's time the timeline ruler extends, purely for layout (so the final diamond isn't flush against the edge) — not used for motion preview, which holds terminal/dwelling steps in place. */
export const LAST_STEP_PREVIEW_WINDOW = 3;

/** Stand-in heading (degrees, down) for `computeInstanceHeadingDeg` when an instance is dwelling/stationary — there's no real direction of travel to derive one from, so a facing="faceMovement" Action needs *some* fixed reading rather than an undefined one. Same convention as ActionPreview.tsx's own stand-in for the isolated (no-real-path) authoring preview. */
const STATIONARY_HEADING_FALLBACK_DEG = 90;
/** Time delta used to numerically differentiate the bezier position curve for `computeInstanceHeadingDeg` — small enough to closely track the curve's real tangent, large enough to stay well clear of floating-point noise. */
const HEADING_EPSILON_SEC = 0.05;

const POSITION_EPSILON = 0.5;

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

  const duration = next.time - step.time;
  const u = duration > 0 ? Math.min(1, Math.max(0, (t - step.time) / duration)) : 0;
  const { p0, p1, p2, p3 } = resolveSegment(step, next, unitDef.turnRate);
  const pos = cubicBezierPoint(p0, p1, p2, p3, u);
  return { pos, step, invincible };
}

/** The instance's direction of travel (degrees, 0=+x/90=+y) at encounter-time `t`, numerically differentiated from `computeInstancePreview`'s own position curve — used to resolve a facing="faceMovement" Action to a real angle. Falls back to a fixed stand-in when the instance isn't actually moving at `t` (dwelling, before/after its path, or unresolvable) since there's no principled direction in that case either. */
export function computeInstanceHeadingDeg(instance: EncounterUnit, unitDef: UnitDef | undefined, t: number): number {
  const a = computeInstancePreview(instance, unitDef, t);
  const b = computeInstancePreview(instance, unitDef, t + HEADING_EPSILON_SEC);
  if (!a || !b) return STATIONARY_HEADING_FALLBACK_DEG;
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  if (Math.hypot(dx, dy) < 0.01) return STATIONARY_HEADING_FALLBACK_DEG;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
