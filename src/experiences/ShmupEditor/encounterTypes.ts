/**
 * Encounter data model for the Shmup Editor (specs/shmup-editor.todo.md,
 * E2 #192 — reworked several times: the "Design Handoff v2" doc, the
 * timeline scrubber pass, then the bezier-curve movement pass). An
 * `EncounterDef` belongs to a `TileDef` (types.ts's `encounters` field):
 * "each tile can have multiple encounters; a random one (weighted) is
 * picked when the tile spawns in a level." Each encounter places one or
 * more `EncounterUnit` instances, each referencing a `UnitDef` by id.
 *
 * **The graph is gone — it's a flat ordered list of steps.** Nothing in
 * practice ever needed node/edge graph structure: every real case was a
 * straight sequence. A step is `{ position, time, visible, handles }` — no
 * Action reference at all (see unitTypes.ts for why the Action buffet was
 * cut entirely: its only functional field, `visible`, lives directly on
 * the step now). The first step is the entrance (its time gates when the
 * instance begins existing at all — can be > 0 for a delayed/staggered
 * spawn), the last is however it disappears; neither is a special
 * category, they're just first/last by time.
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
 * **Movement between two steps is a cubic bezier curve, not a choice of
 * movement kind.** `handleIn`/`handleOut` (below) shape the curve leaving/
 * arriving at a step; see `bezier.ts` for the math and `unitTypes.ts` for
 * why movement kinds (straightLine/wave/spiral) went away for Units in
 * favor of this. **Dwelling in place is just a step at the same `pos` as
 * its predecessor** — no flag for it, a zero-length segment has nothing to
 * curve along.
 *
 * Array index order is the authorial sequence order (steps are not
 * reordered by dragging — see `encounterSteps.ts`); `time` is mostly
 * *derived* from distance and the owning Unit's speed
 * (`encounterTiming.ts`), so `isFirstStep`/`isLastStep`/`deleteStepsFrom`
 * operate on plain array index throughout.
 *
 * **Attacks are a separate, parallel set of tracks — not steps.** Per
 * "Design Handoff v2" §5.5 and unitTypes.ts's Part/Weapon model, an
 * `EncounterAttack` places one of the owning Unit's Weapons (via its
 * `partId`/`weaponId`) at a `time` on the same shared clock steps use, with
 * no position of its own — it fires from wherever that instance's bezier
 * path (plus the Part's `offset`) puts it at that moment
 * (`movementPreview.ts`'s `computeInstancePreview` already computes this).
 * This is what makes independent per-part attack tracks fall out for free
 * (a battleship's three turrets are three Parts, each with its own
 * `EncounterAttack` placements on independent schedules) without needing
 * attacks to compete with the step sequence's "only the last step gets a
 * +" ordering rule — an attack can be placed anywhere on the timeline,
 * `encounterAttacks.ts` is unordered array CRUD, no chronology invariant.
 *
 * **Spawn nodes are a second, procedural way an encounter populates
 * enemies (E3 #193, spawnTypes.ts) — not a new "variant" concept.** The
 * encounter this file's `EncounterDef` describes already IS the "tile
 * variant" from levels-and-tiles.spec.todo.md §1 (see `weight`, above: "a
 * random one (weighted) is picked when the tile spawns"). A spawn node
 * lives inside one encounter, alongside its hand-placed `units`, and
 * describes a whole *group* — origin/distribution/direction/mirror/
 * timing/scaling referencing a single UnitDef — instead of an individually
 * authored bezier step sequence per enemy. See spawnTypes.ts for the full
 * data model and reasoning.
 */
import type { SpawnNodeDef } from "./spawnTypes";

export interface Vec2 {
  x: number;
  y: number;
}

// ── Steps ──────────────────────────────────────────────────────────────────

export interface EncounterStep {
  id: string;
  pos: Vec2;
  /** false = hidden + hitbox disabled — what "Disappear"/teleport-out/pop-down are made of, composing with a later differently-positioned visible step to produce teleporting. */
  visible: boolean;
  /** Seconds from encounter start — one shared clock across every unit instance in this encounter, not relative to this instance's own start. */
  time: number;
  /** Narrow per-placement speed multiplier on the owning Unit's `speed` for the segment leaving this step (1 = unchanged) — the one exception to "encounters select, they don't author." Aim-angle override lives on EncounterAttack now, not here — attacks aren't tied to steps anymore. */
  speedMultiplier: number;
  /** Offset from `pos` for the outgoing bezier handle (toward the next step) — null = default straight-line-equivalent placement. See bezier.ts. Unused on the last step of a sequence (no outgoing segment). */
  handleOut: Vec2 | null;
  /** Offset from `pos` for the incoming bezier handle (from the previous step) — null = default straight-line-equivalent placement. See bezier.ts. Unused on the first step of a sequence (no incoming segment). */
  handleIn: Vec2 | null;
}

// ── Attacks ────────────────────────────────────────────────────────────────

export interface EncounterAttack {
  id: string;
  /** References a UnitPart.id on the owning EncounterUnit's UnitDef. */
  partId: string;
  /** References a WeaponDef.id within that Part's weapon buffet. */
  weaponId: string;
  /** Seconds from encounter start — same shared clock as steps. Always manually authored; unlike a step's time, there's no position/distance to derive it from. */
  time: number;
  /** How long this attack keeps firing at its weapon's fireIntervalMs cadence after `time`; 0 = a single burst only. */
  durationMs: number;
  /** Per-placement override of the weapon's fixedAngleDeg, in degrees — null = use the weapon's own value. Written by dragging the aim handle on canvas; only meaningful when the referenced weapon's aimMode is "fixed". */
  aimAngleOverride: number | null;
}

/** One Unit's placement + step sequence + attack-track placements within a single encounter. */
export interface EncounterUnit {
  id: string;
  unitDefId: string;
  steps: EncounterStep[];
  attacks: EncounterAttack[];
}

export interface EncounterDef {
  id: string;
  name: string;
  /** Relative weight when a tile has multiple encounters and one is picked at random (default 1). */
  weight: number;
  units: EncounterUnit[];
  /** Procedural group-spawn configurations — see spawnTypes.ts. A second, independent way this encounter populates enemies, alongside `units`' hand-placed instances. */
  spawnNodes: SpawnNodeDef[];
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
export function makeAttackId(): string {
  return `atk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankEncounter(existingCount: number): EncounterDef {
  const now = Date.now();
  return {
    id: makeEncounterId(),
    name: `Encounter ${existingCount + 1}`,
    weight: 1,
    units: [],
    spawnNodes: [],
    createdAt: now,
    modifiedAt: now,
  };
}

export function createEncounterUnit(unitDefId: string): EncounterUnit {
  return { id: makeEncounterUnitId(), unitDefId, steps: [], attacks: [] };
}
