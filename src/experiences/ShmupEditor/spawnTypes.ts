/**
 * Spawn node data model (specs/shmup-editor.todo.md, E3 #193 —
 * specs/games/shmup/spawn-and-warnings.spec.todo.md §2). A spawn node lives
 * inside an `EncounterDef` (encounterTypes.ts's `spawnNodes` field) — the
 * encounter it lives on already IS the "tile variant" concept from
 * levels-and-tiles.spec.todo.md §1 ("a tile definition can declare
 * multiple mutually-exclusive spawn variants... the generator picks one at
 * placement time, optionally weighted" — exactly what EncounterDef.weight
 * already does). A spawn node is a second, *procedural* way an encounter
 * can populate enemies, alongside EncounterUnit's hand-placed individual
 * instances: instead of authoring one bezier step sequence per enemy, a
 * spawn node describes a whole *group* — where it originates, how many
 * individuals, how they're laid out, and how that count/power scales with
 * the difficulty budget — referencing a single UnitDef the group spawns
 * copies of.
 *
 * **What a spawn node does NOT author**: individual step sequences for the
 * enemies it spawns. Per shmup-editor.md's Related section, how a
 * procedurally-spawned individual moves once it exists (there's no
 * per-instance bezier path to reference, unlike an EncounterUnit) is an
 * open question left to the game-runtime implementation, the same way
 * "how a Weapon-spawned bullet Unit moves without an authored step list"
 * already is — not something this editor's design needs to resolve.
 *
 * **Scaling** uses spawn-and-warnings.spec.todo.md §1's shared
 * curve-type system (difficultyCurve.ts) scoped narrowly to what §2
 * explicitly assigns a spawn node: `minCount`/`maxCount`/`powerSplit`, plus
 * a `countCurve` governing how an incoming difficulty budget resolves to an
 * actual spawn count within [minCount, maxCount] — "spawn count" is one of
 * the curve-attachable params §1 names by name. Retrofitting curves onto
 * individual Unit/Weapon stat fields (HP, fire rate, damage...) stays
 * deferred, same as E2 deferred its own scaling system — see
 * shmup-editor.todo.md.
 */
import { createFlatCurve, resolveCurve, type CurveDef } from "./difficultyCurve";
import type { Vec2 } from "./encounterTypes";

export type SpawnOriginType = "point" | "region" | "shape";
export type SpawnShapeKind = "v" | "arc" | "line" | "grid";
export type SpawnDistribution = "random" | "ordered";
export type SpawnCountMode = "fixed" | "untilTileEnds";

export interface SpawnOrigin {
  type: SpawnOriginType;
  /** World-space anchor, same coordinate space as EncounterStep.pos — for `point`, the exact spawn location; for `region`, the scatter box's center; for `shape`, the template's center. */
  anchor: Vec2;
  /** region only — full box width/height, px. */
  regionWidth: number;
  regionHeight: number;
  /** shape only. */
  shapeKind: SpawnShapeKind;
  /** shape only — normalized boundary span the shape's individuals fill, 0-100 (percent of the owning tile's footprint width), e.g. 25/75 for a V spanning the middle half of the tile. Spacing between individuals is derived from count filling this span, not authored per-count (spec §2). */
  spanStart: number;
  spanEnd: number;
}

export function createDefaultOrigin(anchor: Vec2): SpawnOrigin {
  return { type: "point", anchor, regionWidth: 120, regionHeight: 120, shapeKind: "v", spanStart: 25, spanEnd: 75 };
}

export interface SpawnNodeDef {
  id: string;
  name: string;
  /** References a UnitDef by id — every individual this node spawns runs a copy of the same Unit. Null = not yet configured. */
  unitDefId: string | null;
  origin: SpawnOrigin;
  /** Free field, but typically implied by origin type: random for `region`, ordered for `shape` (spec §2) — meaningless for `point` (every individual shares one origin). */
  distribution: SpawnDistribution;
  /** Rotation applied to the origin (mainly the shape template — a V oriented north vs. northwest), degrees. */
  direction: number;
  /** Reflects the whole origin (post-rotation) across the tile's own center axis, spawning a second full copy of the group. Composes with any origin type. */
  mirror: boolean;
  /** Delay before the first spawn in this group, ms. */
  delayMs: number;
  /** Time between individual spawns within the group, ms — 0 = simultaneous, >0 = a staggered queue. */
  intervalMs: number;
  /** "fixed" = the resolved spawn count (see resolveSpawnCount below) is the group's whole total. "untilTileEnds" = keep spawning individuals every intervalMs for as long as the tile is active; minCount/maxCount/countCurve are not a total in this mode (open question for the runtime — same "not fully wired at authoring time" carve-out as a few other approximations documented in shmup-editor.md). */
  countMode: SpawnCountMode;
  /** Difficulty-budget allocation (spawn-and-warnings.spec.todo.md §1) bounding countCurve's resolved value. */
  minCount: number;
  maxCount: number;
  /** 0-100 — how much of this node's allocated budget buys more count (0) vs. more power/tier per existing individual (100). `powerSplit = 0` is "count only" (a swarm); `powerSplit = 100` with `maxCount = 1` is "power only" (a miniboss that never duplicates). */
  powerSplit: number;
  /** How an incoming difficulty budget resolves to a spawn count within [minCount, maxCount]. */
  countCurve: CurveDef;
}

export function makeSpawnNodeId(): string {
  return `spawn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createSpawnNode(existingCount: number, anchor: Vec2, unitDefId: string | null): SpawnNodeDef {
  return {
    id: makeSpawnNodeId(),
    name: `Spawn ${existingCount + 1}`,
    unitDefId,
    origin: createDefaultOrigin(anchor),
    distribution: "random",
    direction: 0,
    mirror: false,
    delayMs: 0,
    intervalMs: 0,
    countMode: "fixed",
    minCount: 1,
    maxCount: 1,
    powerSplit: 0,
    countCurve: createFlatCurve(1),
  };
}

/** The actual spawn count at a given difficulty budget: countCurve's raw output, clamped into [minCount, maxCount] and rounded to a whole individual. */
export function resolveSpawnCount(node: SpawnNodeDef, budget: number): number {
  const raw = resolveCurve(node.countCurve, budget);
  const clamped = Math.min(node.maxCount, Math.max(node.minCount, raw));
  return Math.max(0, Math.round(clamped));
}

/**
 * A representative "how much stronger" preview multiplier for whatever
 * budget isn't spent buying more count — deliberately simple (a plain
 * multiplier, not wired into any real Unit stat) for the same reason
 * WeaponPreview.tsx's bullet-pattern preview is "representative... not a
 * physics match for the eventual game runtime": there's no shared runtime
 * yet to match, and no per-param curve system on Unit/Weapon stats to feed
 * this into (see file header). `powerSplit=0` always returns 1 (no power
 * boost, all budget goes to count); `powerSplit=100` returns the full
 * budget's worth as a boost, uncapped.
 */
export function resolvePowerMultiplier(node: SpawnNodeDef, budget: number): number {
  return 1 + (budget / 100) * (node.powerSplit / 100);
}
