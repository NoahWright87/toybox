/**
 * Encounter data model for the Shmup Editor (specs/shmup-editor.todo.md,
 * E2 #192 — reworked per the "Design Handoff v2" doc). An `EncounterDef`
 * belongs to a `TileDef` (types.ts's `encounters` field): "each tile can
 * have multiple encounters; a random one (weighted) is picked when the
 * tile spawns in a level." Each encounter places one or more
 * `EncounterUnit` instances, each referencing a `UnitDef` by id.
 *
 * **The graph is gone — it's a flat ordered list of steps.** Nothing in
 * practice ever needed node/edge graph structure: every real case was a
 * straight sequence. A step is `{ position, trigger, action }`; the
 * *action* (movement/attack/animation) is looked up on the referencing
 * Unit by id (see unitTypes.ts's `ActionDef`) rather than authored inline
 * — an encounter selects and sequences behavior, it doesn't author it.
 * The first step is the entrance (its trigger gates when the instance
 * begins existing at all), the last is however it disappears — neither is
 * a special category, they're just first/last in the list.
 */

export interface Vec2 {
  x: number;
  y: number;
}

// ── Triggers (shared vocabulary, gates spawn on the first step or advancement on any later step) ──

export type TriggerKind = "always" | "unitPosition" | "playerPosition" | "time";

export interface Trigger {
  kind: TriggerKind;
  /**
   * Meaning depends on kind: unitPosition/playerPosition = 0-100, percent
   * of the way down the tile/screen; time = seconds since the previous
   * step's action became active (or since tile-visible, for the first
   * step). Unused for "always" (fires immediately).
   */
  value: number;
}

export function defaultTrigger(): Trigger {
  return { kind: "always", value: 0 };
}

// ── Steps ──────────────────────────────────────────────────────────────────

export interface EncounterStep {
  id: string;
  pos: Vec2;
  /** References an ActionDef.id on the owning EncounterUnit's UnitDef. */
  actionId: string;
  trigger: Trigger;
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
