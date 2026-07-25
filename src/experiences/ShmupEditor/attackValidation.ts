/**
 * Non-blocking min-duration check for a Part-track placement
 * (design-handoff v3 §8.2: "The editor should prevent placing a node
 * earlier than the minimum duration of the preceding node allows").
 * Deliberately a warning, not a clamp/block — `computeAttackDurationMs`
 * is only ever an estimate (it returns `null` for an indefinite-repeat
 * attack), and an author may have a real reason to want two bursts to
 * overlap. See `shmup-editor.todo.md`'s framing: "an authoring-quality-
 * of-life check, not a data-integrity one."
 */
import { computeAttackDurationMs } from "./hitboxPreview";
import { partActionsForPart } from "./partActions";
import type { EncounterUnit, PartActionPlacement } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

/** null = no warning (no preceding placement on this track, or it finishes in time). */
export function minDurationWarning(instance: EncounterUnit, unit: UnitDef | undefined, placement: PartActionPlacement): string | null {
  const part = unit?.parts.find((p) => p.id === placement.partId);
  if (!part) return null;

  const track = partActionsForPart(instance, placement.partId);
  const priorPlacements = track.filter((p) => p.id !== placement.id && p.time < placement.time);
  const prev = priorPlacements[priorPlacements.length - 1];
  if (!prev) return null;

  const prevAction = part.actions.find((a) => a.id === prev.actionId);
  if (!prevAction?.attack) return null;

  const durationMs = computeAttackDurationMs(prevAction.attack);
  if (durationMs === null) return `Overlaps "${prevAction.name}", which fires indefinitely.`;

  const earliestAllowed = prev.time + durationMs / 1000;
  if (placement.time >= earliestAllowed) return null;
  return `Lands ${(earliestAllowed - placement.time).toFixed(2)}s before "${prevAction.name}" finishes.`;
}
