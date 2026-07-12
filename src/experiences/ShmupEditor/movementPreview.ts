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
 * The Action's `attack`/`animationState`/`visible` still evaluate
 * normally; only position freezes.
 */
import { cubicBezierPoint, distanceBetween, resolveSegment } from "./bezier";
import { activeStepAt } from "./encounterSteps";
import type { EncounterStep, EncounterUnit, Vec2 } from "./encounterTypes";
import type { ActionDef, UnitDef } from "./unitTypes";

export interface InstancePreview {
  pos: Vec2;
  action: ActionDef;
  step: EncounterStep;
}

/** How far past the last step's time the timeline ruler extends, purely for layout (so the final diamond isn't flush against the edge) — not used for motion preview, which holds terminal/dwelling steps in place. */
export const LAST_STEP_PREVIEW_WINDOW = 3;

const POSITION_EPSILON = 0.5;

/** The instance's interpolated position/action at encounter-time `t`, or null if it hasn't spawned yet (t before its first step) or its Unit/Action can't be resolved. */
export function computeInstancePreview(instance: EncounterUnit, unitDef: UnitDef | undefined, t: number): InstancePreview | null {
  if (!unitDef) return null;
  const step = activeStepAt(instance, t);
  if (!step) return null;
  const action = unitDef.actions.find((a) => a.id === step.actionId);
  if (!action) return null;

  const idx = instance.steps.findIndex((s) => s.id === step.id);
  const next = instance.steps[idx + 1];
  if (!next || distanceBetween(step.pos, next.pos) <= POSITION_EPSILON) {
    return { pos: step.pos, action, step }; // no destination to head toward — hold in place
  }

  const duration = next.time - step.time;
  const u = duration > 0 ? Math.min(1, Math.max(0, (t - step.time) / duration)) : 0;
  const { p0, p1, p2, p3 } = resolveSegment(step, next, unitDef.turnRate);
  const pos = cubicBezierPoint(p0, p1, p2, p3, u);
  return { pos, action, step };
}
