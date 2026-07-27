/**
 * Encounter data model for the Shmup Editor. An `EncounterDef` belongs to
 * a `TileDef` (types.ts's `encounters` field): "each tile can have
 * multiple encounters; a random one (weighted) is picked when the tile
 * spawns in a level." Each encounter places one or more `EncounterUnit`
 * instances, each referencing a `UnitDef` by id.
 *
 * **Steps and Part-action placements both reference an `ActionDef`
 * (unitTypes.ts) now — Actions are back.** A step used to carry its own
 * scattered `speedMultiplier`/`visible` fields directly; an attack used
 * to reference a `WeaponDef` by id. Both now just say *which Action*
 * governs this placement — the Action supplies movement%/facing/state/
 * optional-attack as one reusable, named bundle. See unitTypes.ts for the
 * full reasoning (facing subsuming aim, invincibility becoming derived
 * rather than stored, Weapon being folded into Action).
 *
 * **The graph is still gone — steps are still a flat ordered list.**
 * Nothing about Actions coming back changes that: every real case is
 * still a straight sequence. The first step is the entrance (its time
 * gates when the instance begins existing at all — can be > 0 for a
 * delayed/staggered spawn), the last is however it disappears; neither is
 * a special category, they're just first/last by time.
 *
 * **Movement *destination* stays on the step, not the Action** — see
 * unitTypes.ts's file header for why (an Action is reusable; a literal
 * map coordinate isn't). A step is still `{ pos, time, handleIn,
 * handleOut }`, shaping a cubic bezier curve to/from its neighbors
 * exactly as before; it just also carries `actionId` now, supplying how
 * fast/which way/whether-attacking for the segment leaving it. **Dwelling
 * in place is still just a step at the same `pos` as its predecessor.**
 *
 * Array index order is the authorial sequence order (steps are not
 * reordered by dragging — see `encounterSteps.ts`); `time` is mostly
 * *derived* from distance and the referenced Action's `movementPercent`
 * of the owning Unit's `speed` (`encounterTiming.ts`), so
 * `isFirstStep`/`isLastStep`/`deleteStepsFrom` operate on plain array
 * index throughout.
 *
 * **`EncounterAttack` is gone — replaced by `PartActionPlacement`,
 * a straight simplification of the same shape.** Still a separate,
 * parallel, unordered set of tracks per Part (not steps — a Part doesn't
 * move on its own yet, so its placements carry no position), still keyed
 * by the same shared encounter clock. What it drops: `weaponId` (an
 * Action *is* the reference now, and may or may not carry an attack —
 * see unitTypes.ts), `durationMs` (computed from the referenced Action's
 * own attack, not authored per-placement), and `aimAngleOverride` (aim is
 * just whichever way the Action's own `facing` resolves — no per-
 * placement override needed since Cloning the Action is how you'd author
 * a variant with a different fixed angle).
 *
 * **Each `EncounterUnit` instance also owns a `scaling: UnitScaling`**
 * (E3 #193, unitScaling.ts) — a per-instance panel, separate from its
 * step/Part-action authoring, for procedurally duplicating that exact
 * placed instance (same steps/Part-actions replayed per duplicate,
 * anchored to its own slot) as the difficulty budget allows.
 */
import { createDefaultScaling, type UnitScaling } from "./unitScaling";

export interface Vec2 {
  x: number;
  y: number;
}

// ── Steps ──────────────────────────────────────────────────────────────────

export interface EncounterStep {
  id: string;
  pos: Vec2;
  /** Seconds from encounter start — one shared clock across every unit instance in this encounter, not relative to this instance's own start. */
  time: number;
  /** Which of the owning Unit's own Actions (unitTypes.ts's UnitDef.actions, not any Part's) governs the segment leaving this step — movement%, facing, state, and optionally an attack fired from the base Unit itself. null = no Action chosen yet (inert: holds position, no facing/attack/state change) — encounterSteps.ts's addStep() can't resolve a sensible default itself (it deliberately has no idea what a UnitDef is), so this starts null until the caller (EncounterEditor.tsx, which does have the UnitDef) sets one. */
  actionId: string | null;
  /** Offset from `pos` for the outgoing bezier handle (toward the next step) — null = default straight-line-equivalent placement. See bezier.ts. Unused on the last step of a sequence (no outgoing segment). */
  handleOut: Vec2 | null;
  /** Offset from `pos` for the incoming bezier handle (from the previous step) — null = default straight-line-equivalent placement. See bezier.ts. Unused on the first step of a sequence (no incoming segment). */
  handleIn: Vec2 | null;
}

// ── Part-action placements ──────────────────────────────────────────────────

export interface PartActionPlacement {
  id: string;
  /** References a UnitPart.id on the owning EncounterUnit's UnitDef. */
  partId: string;
  /** Seconds from encounter start — same shared clock as steps. Always manually authored; unlike a step's time, there's no position/distance to derive it from (a Part doesn't move on its own yet — unitTypes.ts). */
  time: number;
  /** Which of that Part's own Actions runs here — supplies facing, optional attack (arc/count/spacing/spawn/repeat), and state, exactly like a step's actionId but for a Part's independent track instead of the base Unit's. null = no Action chosen yet. */
  actionId: string | null;
}

/** One Unit's placement + step sequence + per-Part Action-placement tracks + scaling config within a single encounter. */
export interface EncounterUnit {
  id: string;
  unitDefId: string;
  steps: EncounterStep[];
  partActions: PartActionPlacement[];
  /** Procedural duplication of this exact instance — see unitScaling.ts. */
  scaling: UnitScaling;
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
export function makePartActionPlacementId(): string {
  return `pa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
  return { id: makeEncounterUnitId(), unitDefId, steps: [], partActions: [], scaling: createDefaultScaling() };
}
