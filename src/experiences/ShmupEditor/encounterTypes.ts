/**
 * Encounter data model for the Shmup Editor (specs/shmup-editor.todo.md,
 * E2 #192 — reworked per the "Design Handoff v2" doc, then again for the
 * timeline scrubber pass). An `EncounterDef` belongs to a `TileDef`
 * (types.ts's `encounters` field): "each tile can have multiple
 * encounters; a random one (weighted) is picked when the tile spawns in a
 * level." Each encounter places one or more `EncounterUnit` instances,
 * each referencing a `UnitDef` by id.
 *
 * **The graph is gone — it's a flat ordered list of steps.** Nothing in
 * practice ever needed node/edge graph structure: every real case was a
 * straight sequence. A step is `{ position, time, action }`; the *action*
 * (movement/attack/animation) is looked up on the referencing Unit by id
 * (see unitTypes.ts's `ActionDef`) rather than authored inline — an
 * encounter selects and sequences behavior, it doesn't author it. The
 * first step is the entrance (its time gates when the instance begins
 * existing at all — can be > 0 for a delayed/staggered spawn), the last is
 * however it disappears; neither is a special category, they're just
 * first/last by time.
 *
 * **Trigger kinds are gone — every step just has a `time`.** The old
 * `Trigger` union (always/unitPosition/playerPosition/time) added a layer
 * of indirection that a real timeline scrubber makes pointless: "always"
 * meant "whatever time the previous action happens to end," which a
 * scrubber can just show you directly, and `playerPosition` was never
 * actually previewable (it depends on where the live player is, which
 * doesn't exist at authoring time) — the same reasoning that already
 * killed proximity-based triggers earlier in this feature's history.
 * `time` is **one shared clock for the whole encounter** — all unit
 * instances' steps are timed against the same origin, not relative to each
 * instance's own start — so multiple units can be choreographed against
 * each other (two turrets alternating fire, a wave arriving 3s after the
 * first) instead of each running on an island.
 *
 * Every instance's `steps` array is kept sorted by `time` ascending as an
 * invariant (`encounterSteps.ts`'s `updateStep` re-sorts after every
 * patch) — "first/last in the array" and "first/last chronologically"
 * are the same thing, so `isFirstStep`/`isLastStep`/`deleteStepsFrom`
 * didn't need to change shape, just gained that invariant.
 */

export interface Vec2 {
  x: number;
  y: number;
}

// ── Steps ──────────────────────────────────────────────────────────────────

export interface EncounterStep {
  id: string;
  pos: Vec2;
  /** References an ActionDef.id on the owning EncounterUnit's UnitDef. */
  actionId: string;
  /** Seconds from encounter start — one shared clock across every unit instance in this encounter, not relative to this instance's own start. */
  time: number;
  /** Narrow per-placement override of the referenced action's fixed firing angle — null = use the action's own value. Spatial, not behavioral, so it's the one exception to "encounters select, they don't author." */
  aimAngleOverride: number | null;
  /** Narrow per-placement speed multiplier on the referenced action's movement (1 = unchanged). Same spatial/pacing exception as aimAngleOverride. */
  speedMultiplier: number;
}

/** One Unit's placement + step sequence within a single encounter. */
export interface EncounterUnit {
  id: string;
  unitDefId: string;
  steps: EncounterStep[];
}

export interface EncounterDef {
  id: string;
  name: string;
  /** Relative weight when a tile has multiple encounters and one is picked at random (default 1). */
  weight: number;
  units: EncounterUnit[];
  createdAt: number;
  modifiedAt: number;
}

export function makeEncounterId(): string {
  return `enc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function makeEncounterUnitId(): string {
  return `eu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function makeStepId(): string {
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankEncounter(existingCount: number): EncounterDef {
  const now = Date.now();
  return {
    id: makeEncounterId(),
    name: `Encounter ${existingCount + 1}`,
    weight: 1,
    units: [],
    createdAt: now,
    modifiedAt: now,
  };
}

export function createEncounterUnit(unitDefId: string): EncounterUnit {
  return { id: makeEncounterUnitId(), unitDefId, steps: [] };
}
