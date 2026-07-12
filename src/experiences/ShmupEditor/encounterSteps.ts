/**
 * Pure step-list CRUD for one Unit instance's placement within an encounter
 * (specs/shmup-editor.todo.md, E2 #192). Replaces the earlier node/edge
 * graph CRUD (`encounterGraph.ts`) — since the graph turned out to always
 * be a flat sequence in practice, this is now just array operations, no
 * traversal/cascade logic needed. Kept independent of any rendering/React
 * code so it can be unit tested directly.
 *
 * **Invariant: `steps` is always sorted by `time` ascending.** `updateStep`
 * re-sorts after every patch (not just ones that touch `time` — sorting an
 * already-sorted array is a cheap no-op), so array order and chronological
 * order never diverge. This is what lets `isFirstStep`/`isLastStep`/
 * `deleteStepsFrom` keep working on plain array index after the timeline
 * scrubber pass added an explicit `time` field — "first in the array" and
 * "first in time" are guaranteed to be the same step.
 */
import { makeStepId, type EncounterStep, type EncounterUnit, type Vec2 } from "./encounterTypes";

const DEFAULT_NEXT_OFFSET: Vec2 = { x: 130, y: 0 };
/** Default gap (seconds) between a newly appended step and the one before it. */
const DEFAULT_STEP_DURATION = 2;

/** Appends a new step referencing `actionId`, defaulting its position to an offset from the last step (or the given `pos` if this is the first step) and its time to `DEFAULT_STEP_DURATION` after the last step (or 0). */
export function addStep(instance: EncounterUnit, actionId: string, pos?: Vec2): EncounterUnit {
  const last = instance.steps[instance.steps.length - 1];
  const stepPos = pos ?? (last ? { x: last.pos.x + DEFAULT_NEXT_OFFSET.x, y: last.pos.y + DEFAULT_NEXT_OFFSET.y } : { x: 0, y: 0 });
  const time = last ? last.time + DEFAULT_STEP_DURATION : 0;
  const step: EncounterStep = { id: makeStepId(), pos: stepPos, actionId, time, aimAngleOverride: null, speedMultiplier: 1 };
  return { ...instance, steps: [...instance.steps, step] };
}

/** Patches arbitrary fields on one step, clamping `time` to >= 0 and re-sorting to maintain the sorted-by-time invariant (a no-op resort when `time` wasn't touched). */
export function updateStep(instance: EncounterUnit, stepId: string, patch: Partial<EncounterStep>): EncounterUnit {
  const clean = patch.time !== undefined ? { ...patch, time: Math.max(0, patch.time) } : patch;
  const steps = instance.steps.map((s) => (s.id === stepId ? { ...s, ...clean } : s));
  steps.sort((a, b) => a.time - b.time);
  return { ...instance, steps };
}

export function moveStep(instance: EncounterUnit, stepId: string, pos: Vec2): EncounterUnit {
  return { ...instance, steps: instance.steps.map((s) => (s.id === stepId ? { ...s, pos } : s)) };
}

export function isFirstStep(instance: EncounterUnit, stepId: string): boolean {
  return instance.steps[0]?.id === stepId;
}

export function isLastStep(instance: EncounterUnit, stepId: string): boolean {
  return instance.steps[instance.steps.length - 1]?.id === stepId;
}

/**
 * Truncates the step list from `stepId` onward (inclusive) — deleting a
 * step also deletes everything chronologically after it, since there's no
 * UI gesture to re-attach a later step to an earlier one once the chain
 * between them is broken. Deleting the first step empties the instance
 * entirely; the caller (EncounterEditor) is responsible for removing an
 * instance with zero steps from the encounter, since a step-less stub
 * instance has no purpose (mirrors the old "deleting the entrance removes
 * the whole instance" rule, now just "empty steps array means the same
 * thing").
 */
export function deleteStepsFrom(instance: EncounterUnit, stepId: string): EncounterUnit {
  const idx = instance.steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return instance;
  return { ...instance, steps: instance.steps.slice(0, idx) };
}

/**
 * The step active at encounter-time `t` — the latest step whose `time` is
 * <= t, or null if `t` is before this instance's first step (it hasn't
 * spawned yet) or the instance has no steps at all. Steps are kept sorted
 * by time (see file header), so a single forward scan suffices.
 */
export function activeStepAt(instance: EncounterUnit, t: number): EncounterStep | null {
  let active: EncounterStep | null = null;
  for (const step of instance.steps) {
    if (step.time <= t) active = step;
    else break;
  }
  return active;
}
