/**
 * Where an authored instance *is* at a given encounter time, and which
 * Action is governing it there — the runtime twin of the editor's
 * `movementPreview.ts` / `encounterSteps.ts` / `actionState.ts`.
 *
 * A step's `time` is already *derived* at authoring time from the segment's
 * bezier arc length and the referenced Action's `movementPercent` of the
 * Unit's `speed` (the editor's `encounterTiming.ts`), and persisted that
 * way. So the runtime never re-derives speed: it interpolates the curve at
 * `u = (t - step.time) / (next.time - step.time)`, which lands on the
 * destination at `u = 1` by construction. Re-deriving would risk drifting
 * out of sync with the timeline the author actually scrubbed.
 *
 * **A step at the same position as its predecessor (a dwell), or a final
 * step with nothing after it, holds in place.** There is no principled
 * destination to head toward in either case, and freezing is the only
 * outcome that can never look like "it kept traveling past its last
 * waypoint" — the same rule the editor's preview follows.
 */
import { cubicBezierPoint, distanceBetween } from "./bezier";
import { limitsFor, solvePathCached } from "./pathSolver";
import { signedAngleDelta } from "./turning";
import type { AuthoredAction, AuthoredStep, AuthoredUnitDef, Vec2 } from "./authoredTypes";

/** Below this straight-line distance, a step is treated as dwelling at its predecessor's position rather than traveling. */
const POSITION_EPSILON = 0.5;

/** Stand-in heading (degrees, pointing down/south) when there's no real direction of travel to read — matches the editor's own fallback. */
export const STATIONARY_HEADING_FALLBACK_DEG = 90;

/** Time delta used to numerically differentiate the position curve into a heading. */
const HEADING_EPSILON_SEC = 0.05;

export interface InstanceState {
  pos: Vec2;
  /** The step governing this instant — its `actionId` is the Action in force. */
  step: AuthoredStep;
  stepIndex: number;
}

/** The latest step whose `time` is <= t, or null if `t` is before the instance's first step (it hasn't spawned yet). Array order tracks chronological order. */
export function activeStepIndexAt(steps: readonly AuthoredStep[], t: number): number {
  let index = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].time <= t) index = i;
    else break;
  }
  return index;
}

/** The motion stats a path solve needs from the owning Unit — narrowed so callers can pass a whole `AuthoredUnit`. */
type MotionStats = Pick<AuthoredUnitDef, "speed" | "minSpeed" | "turnRateDegPerSec">;

/** The instance's solved path — memoized in `pathSolver.ts`, so calling this every frame costs a map lookup. */
function pathFor(steps: readonly AuthoredStep[], unit: MotionStats) {
  return solvePathCached([...steps], limitsFor(unit));
}

/**
 * The instance's interpolated position at encounter-time `t`, or null if it
 * hasn't spawned yet.
 *
 * **A pivot is a real pause.** A Unit that corners by stopping
 * (`minSpeed === 0`) spends `pivotSec` standing at the waypoint rotating
 * before it sets off; the editor built that time into the next step's
 * `time` when it derived the timeline, so replaying it here is what keeps
 * the game on the same clock as the timeline the author scrubbed.
 */
export function instanceStateAt(steps: readonly AuthoredStep[], unit: MotionStats, t: number): InstanceState | null {
  const index = activeStepIndexAt(steps, t);
  if (index < 0) return null;
  const step = steps[index];
  const next = steps[index + 1];
  if (!next || distanceBetween(step.pos, next.pos) <= POSITION_EPSILON) {
    return { pos: step.pos, step, stepIndex: index };
  }
  const solved = pathFor(steps, unit);
  const pivot = solved.pivotSec[index] ?? 0;
  const elapsed = t - step.time;
  if (elapsed <= pivot) return { pos: step.pos, step, stepIndex: index };

  const duration = next.time - step.time - pivot;
  const u = duration > 0 ? Math.min(1, Math.max(0, (elapsed - pivot) / duration)) : 0;
  const segment = solved.segments[index];
  if (!segment) return { pos: step.pos, step, stepIndex: index };
  return { pos: cubicBezierPoint(segment.p0, segment.p1, segment.p2, segment.p3, u), step, stepIndex: index };
}

/**
 * Direction of travel (degrees, 0 = +x, 90 = +y/down) at encounter-time
 * `t`, numerically differentiated from the position curve — except while
 * pivoting, where the position isn't changing and the heading instead
 * sweeps from the solved arrival tangent to the departure one. That sweep
 * *is* the pivot; without it a tank would sit motionless through its
 * corner and then snap round.
 */
export function instanceHeadingDegAt(steps: readonly AuthoredStep[], unit: MotionStats, t: number): number {
  const index = activeStepIndexAt(steps, t);
  if (index < 0) return STATIONARY_HEADING_FALLBACK_DEG;
  const solved = pathFor(steps, unit);
  const pivot = solved.pivotSec[index] ?? 0;
  const elapsed = t - steps[index].time;
  if (pivot > 0 && elapsed <= pivot) {
    const from = solved.headingInDeg[index] ?? STATIONARY_HEADING_FALLBACK_DEG;
    const to = solved.headingOutDeg[index] ?? from;
    return from + signedAngleDelta(from, to) * Math.min(1, Math.max(0, elapsed / pivot));
  }

  const a = instanceStateAt(steps, unit, t);
  const b = instanceStateAt(steps, unit, t + HEADING_EPSILON_SEC);
  if (a && b) {
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    if (Math.hypot(dx, dy) >= 0.01) return (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  // Dwelling or past the last waypoint: keep pointing where the solve left it, unless it never travelled at all.
  const travels = solved.segments.some((seg) => seg.length > POSITION_EPSILON);
  return travels ? (solved.headingOutDeg[index] ?? STATIONARY_HEADING_FALLBACK_DEG) : STATIONARY_HEADING_FALLBACK_DEG;
}

interface TimedActionRef {
  time: number;
  actionId: string | null;
}

/**
 * Invincibility is **derived, not stored**: walk the placements in
 * chronological order applying each referenced Action's `setsInvincible`
 * (null carries the previous value forward), starting from `false`.
 * `entries` must already be ascending by time — both a step list and a
 * Part's own sorted placement track are.
 */
export function invincibleAt(entries: readonly TimedActionRef[], actions: readonly AuthoredAction[], t: number): boolean {
  let invincible = false;
  for (const entry of entries) {
    if (entry.time > t) break;
    const action = entry.actionId ? actions.find((a) => a.id === entry.actionId) : undefined;
    if (action && action.setsInvincible !== null) invincible = action.setsInvincible;
  }
  return invincible;
}

/** Resolves an absolute facing angle (degrees) for `action`, given where the facing thing is and where the player is. */
export function resolveFacingDeg(
  action: Pick<AuthoredAction, "facing" | "fixedFacingDeg">,
  anchor: Vec2,
  player: Vec2,
  movementHeadingDeg: number
): number {
  if (action.facing === "facePlayer") return (Math.atan2(player.y - anchor.y, player.x - anchor.x) * 180) / Math.PI;
  if (action.facing === "faceMovement") return movementHeadingDeg;
  return action.fixedFacingDeg;
}

/** The last authored moment in an instance's tracks — how the runner knows when an encounter has nothing left to start. */
export function lastAuthoredTime(steps: readonly AuthoredStep[], partActions: readonly TimedActionRef[]): number {
  let last = 0;
  for (const s of steps) last = Math.max(last, s.time);
  for (const p of partActions) last = Math.max(last, p.time);
  return last;
}
