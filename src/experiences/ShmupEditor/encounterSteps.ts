/**
 * Pure step-list CRUD for one Unit instance's placement within an encounter
 * (specs/shmup-editor.todo.md, E2 #192). Replaces the earlier node/edge
 * graph CRUD (`encounterGraph.ts`) — since the graph turned out to always
 * be a flat sequence in practice, this is now just array operations, no
 * traversal/cascade logic needed. Kept independent of any rendering/React
 * code so it can be unit tested directly.
 */
import { makeStepId, defaultTrigger, type EncounterStep, type EncounterUnit, type Vec2 } from "./encounterTypes";

const DEFAULT_NEXT_OFFSET: Vec2 = { x: 130, y: 0 };

/** Appends a new step referencing `actionId`, defaulting its position to an offset from the last step (or the given `pos` if this is the first step). */
export function addStep(instance: EncounterUnit, actionId: string, pos?: Vec2): EncounterUnit {
  const last = instance.steps[instance.steps.length - 1];
  const stepPos = pos ?? (last ? { x: last.pos.x + DEFAULT_NEXT_OFFSET.x, y: last.pos.y + DEFAULT_NEXT_OFFSET.y } : { x: 0, y: 0 });
  const step: EncounterStep = { id: makeStepId(), pos: stepPos, actionId, trigger: defaultTrigger(), aimAngleOverride: null, speedMultiplier: 1 };
  return { ...instance, steps: [...instance.steps, step] };
}

export function updateStep(instance: EncounterUnit, stepId: string, patch: Partial<EncounterStep>): EncounterUnit {
  return { ...instance, steps: instance.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) };
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
 * step also deletes everything after it, since there's no UI gesture to
 * re-attach a later step to an earlier one once the chain between them is
 * broken. Deleting the first step empties the instance entirely; the
 * caller (EncounterEditor) is responsible for removing an instance with
 * zero steps from the encounter, since a graph-less stub instance has no
 * purpose (mirrors the old "deleting the entrance removes the whole
 * instance" rule, now just "empty steps array means the same thing").
 */
export function deleteStepsFrom(instance: EncounterUnit, stepId: string): EncounterUnit {
  const idx = instance.steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return instance;
  return { ...instance, steps: instance.steps.slice(0, idx) };
}
