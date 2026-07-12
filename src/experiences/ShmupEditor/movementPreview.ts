/**
 * Interpolates a unit instance's actual position at any encounter-time `t`
 * for the timeline scrubber's live motion preview (specs/shmup-editor.md's
 * Encounter editor section). This is the editor's own preview
 * approximation — there's no shared runtime to match (`games/shmup` has no
 * enemy-movement implementation yet), the same "no shared code" stance the
 * whole editor already takes toward the game.
 *
 * **A step's `pos` is a waypoint the unit travels toward, not a place it
 * teleports between.** Each movement kind's own doc comments already say
 * "along the base A→B path" — A is the active step's `pos`, B is the next
 * step's `pos` (direction only; speed/shape are the movement's own
 * params). The last step in a sequence has no B, so it continues the
 * heading from the previous step; a lone step with no neighbors at all
 * defaults to heading straight down (into the tile, the usual "forward"
 * for a vertical shmup).
 *
 * **`turnRate` (homing toward the player) is not simulated.** There's no
 * live player position at authoring time — the same reason `playerPosition`
 * triggers and `onProximity` attack triggers were both cut. The preview
 * uses a fixed heading and ignores turnRate; this is a known, documented
 * approximation, not a bug.
 *
 * **Position is clamped to the destination, not extrapolated past it.**
 * Between two steps, the effective elapsed time fed into the position
 * formula is capped at `baseElapsedFor(movement, distanceToNextWaypoint)`
 * (encounterTiming.ts) — "however long the base path takes to travel that
 * far" — so the unit holds at the next waypoint once it arrives instead of
 * sailing past it. This matters for a *manually*-timed step whose authored
 * gap is longer than the movement's natural travel time; a *derived* step's
 * duration already matches the travel time by construction, so the clamp
 * is a no-op there. Past the last step (no next waypoint to clamp against),
 * elapsed is capped at `LAST_STEP_PREVIEW_WINDOW` seconds so
 * scrubbing/playing doesn't run a unit off into infinity — this was a real
 * bug (unbounded travel past the final waypoint) before this cap existed.
 */
import { baseElapsedFor, distanceBetween } from "./encounterTiming";
import { activeStepAt } from "./encounterSteps";
import type { EncounterStep, EncounterUnit, Vec2 } from "./encounterTypes";
import type { ActionDef, MovementBehavior, UnitDef, Waveform } from "./unitTypes";

export interface InstancePreview {
  pos: Vec2;
  action: ActionDef;
  step: EncounterStep;
}

/** How many seconds past the last step's time its movement keeps visibly playing before the preview holds position — there's no "next" waypoint to derive a natural stopping point from. */
export const LAST_STEP_PREVIEW_WINDOW = 3;

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}
function rotate90(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}
function unitVector(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-6 ? { x: 0, y: 1 } : { x: v.x / len, y: v.y / len };
}

function headingFor(steps: EncounterStep[], idx: number): Vec2 {
  const cur = steps[idx];
  const next = steps[idx + 1];
  if (next) return unitVector(sub(next.pos, cur.pos));
  const prev = steps[idx - 1];
  if (prev) return unitVector(sub(cur.pos, prev.pos));
  return { x: 0, y: 1 };
}

function waveformValue(waveform: Waveform, x: number): number {
  const p = x - Math.floor(x); // fractional phase, 0..1
  switch (waveform) {
    case "smooth":
      return Math.sin(p * Math.PI * 2);
    case "triangle":
      if (p < 0.25) return p * 4;
      if (p < 0.75) return 2 - p * 4;
      return p * 4 - 4;
    case "square":
      return p < 0.5 ? 1 : -1;
  }
}

function positionFor(movement: MovementBehavior | null, from: Vec2, heading: Vec2, elapsed: number): Vec2 {
  if (!movement) return from;
  switch (movement.kind) {
    case "straightLine": {
      const dist = movement.speed * elapsed + 0.5 * movement.accel * elapsed * elapsed;
      return add(from, scale(heading, dist));
    }
    case "wave": {
      const base = add(from, scale(heading, movement.speed * elapsed));
      const perp = rotate90(heading);
      const wave = waveformValue(movement.waveform, movement.frequency * elapsed + movement.phase) * movement.amplitude;
      return add(base, scale(perp, wave));
    }
    case "spiral": {
      const center = add(from, scale(heading, movement.speed * elapsed));
      const radius = Math.max(0, movement.radius + movement.radiusGrowth * elapsed);
      const angleRad = (movement.angularSpeed * elapsed * Math.PI) / 180;
      return add(center, { x: radius * Math.cos(angleRad), y: radius * Math.sin(angleRad) });
    }
  }
}

/** The instance's interpolated position/action at encounter-time `t`, or null if it hasn't spawned yet (t before its first step) or its Unit/Action can't be resolved. */
export function computeInstancePreview(instance: EncounterUnit, unitDef: UnitDef | undefined, t: number): InstancePreview | null {
  if (!unitDef) return null;
  const step = activeStepAt(instance, t);
  if (!step) return null;
  const action = unitDef.actions.find((a) => a.id === step.actionId);
  if (!action) return null;
  const idx = instance.steps.findIndex((s) => s.id === step.id);
  const heading = headingFor(instance.steps, idx);
  const next = instance.steps[idx + 1];
  const rawElapsed = Math.max(0, t - step.time);
  let effectiveElapsed = rawElapsed * step.speedMultiplier;
  if (next && action.movement) {
    const targetDistance = distanceBetween(step.pos, next.pos);
    effectiveElapsed = Math.min(effectiveElapsed, baseElapsedFor(action.movement, targetDistance));
  } else if (!next) {
    effectiveElapsed = Math.min(effectiveElapsed, LAST_STEP_PREVIEW_WINDOW * step.speedMultiplier);
  }
  const pos = positionFor(action.movement, step.pos, heading, effectiveElapsed);
  return { pos, action, step };
}
