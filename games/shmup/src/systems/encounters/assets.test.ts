import { describe, expect, it } from "vitest";
import { collectEncounterUnitTextures, collectLevelTextures } from "./assets";
import { IDENTITY_ORIENTATION, type LevelLayout } from "./levelLayout";
import type { AuthoredAction, AuthoredContent, AuthoredEncounter, AuthoredTile, AuthoredUnitDef } from "./authoredTypes";

function unit(id: string, spriteId: string, actions: AuthoredAction[] = []): AuthoredUnitDef {
  return {
    id,
    name: id,
    spriteId,
    customSprite: null,
    hp: 10,
    contactDamage: 1,
    scoreValue: 10,
    speed: 100,
    turnRate: 1,
    size: 16,
    layer: "air",
    defaultActionId: null,
    actions,
    parts: [],
    createdAt: 0,
    modifiedAt: 0,
  };
}

function firingAction(spawnUnitId: string): AuthoredAction {
  return {
    id: `fire-${spawnUnitId}`,
    name: "Fire",
    movementPercent: 0,
    facing: "fixed",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: {
      arcStartDeg: 0,
      arcEndDeg: 0,
      count: 1,
      spacing: "even",
      perShotDelayMs: 0,
      sweepSpeedDeg: 0,
      pingPong: false,
      burstIntervalMs: 1000,
      telegraphMs: 0,
      repeatCount: null,
      spawnUnitId,
      spawnScale: 1,
      spawnGroup: "enemyProjectile",
    },
  };
}

function encounter(id: string, unitDefId: string): AuthoredEncounter {
  return {
    id,
    name: id,
    weight: 1,
    createdAt: 0,
    modifiedAt: 0,
    units: [
      {
        id: `eu-${id}`,
        unitDefId,
        steps: [{ id: "s0", pos: { x: 0, y: 0 }, time: 0, actionId: null, handleIn: null, handleOut: null }],
        partActions: [],
        scaling: {
          maxCount: 1,
          minCostPerInstance: 1,
          spawnDelayMs: 0,
          shape: "curve",
          curvePoints: [],
          curveEnd: { x: 0, y: 0 },
          vTip: { x: 0, y: 0 },
          vWidth: 0,
          gridWidth: 0,
          gridDepth: 0,
          ringCenterOffset: { x: 0, y: 0 },
          ringRadius: 0,
          pingPong: false,
          pingPongOverride: null,
        },
      },
    ],
  };
}

function tile(id: string, imageId: string, encounters: AuthoredEncounter[]): AuthoredTile {
  return {
    id,
    name: id,
    footprint: 1,
    north: [{ tag: "x", hardwall: false }],
    south: [{ tag: "x", hardwall: false }],
    east: { tag: "", hardwall: true },
    west: { tag: "", hardwall: true },
    isConnector: false,
    weight: 1,
    imageId,
    customImage: null,
    encounters,
    createdAt: 0,
    modifiedAt: 0,
  };
}

function layoutOf(...tileIds: string[]): LevelLayout {
  return {
    placements: tileIds.map((tileId, depth) => ({ tileId, depth, column: 0, orientation: IDENTITY_ORIENTATION })),
    columns: 1,
  };
}

describe("collectLevelTextures", () => {
  it("queues a tile's art even when that tile has no encounters at all", () => {
    // The regression this guards: an encounter-less tile is ordinary
    // terrain and must still be drawn. Collecting tile art inside the
    // per-encounter walk skipped it entirely, and it rendered as a hole.
    const content: AuthoredContent = { tiles: [tile("bare", "lava", [])], units: [] };
    const keys = collectLevelTextures(content, layoutOf("bare")).map((r) => r.key);
    expect(keys).toContain("authored:tile:lava");
  });

  it("queues art for every placed tile, encounters or not", () => {
    const content: AuthoredContent = {
      tiles: [tile("a", "grass", [encounter("e1", "u1")]), tile("b", "lava", [])],
      units: [unit("u1", "heli")],
    };
    const keys = collectLevelTextures(content, layoutOf("a", "b")).map((r) => r.key);
    expect(keys).toContain("authored:tile:grass");
    expect(keys).toContain("authored:tile:lava");
    expect(keys).toContain("authored:heli");
  });

  it("covers every Encounter a tile could roll, not just one", () => {
    const content: AuthoredContent = {
      tiles: [tile("a", "grass", [encounter("e1", "u1"), encounter("e2", "u2")])],
      units: [unit("u1", "heli"), unit("u2", "turret")],
    };
    const keys = collectLevelTextures(content, layoutOf("a")).map((r) => r.key);
    expect(keys).toContain("authored:heli");
    expect(keys).toContain("authored:turret");
  });

  it("narrows to a pinned Encounter's units, but still takes the tile's art", () => {
    const content: AuthoredContent = {
      tiles: [tile("a", "grass", [encounter("e1", "u1"), encounter("e2", "u2")])],
      units: [unit("u1", "heli"), unit("u2", "turret")],
    };
    const keys = collectLevelTextures(content, layoutOf("a"), "e1").map((r) => r.key);
    expect(keys).toContain("authored:tile:grass");
    expect(keys).toContain("authored:heli");
    expect(keys).not.toContain("authored:turret");
  });

  it("follows spawned projectiles transitively", () => {
    const content: AuthoredContent = {
      tiles: [tile("a", "grass", [encounter("e1", "shooter")])],
      units: [unit("shooter", "turret", [firingAction("splitter")]), unit("splitter", "proj-cluster-shell", [firingAction("pellet")]), unit("pellet", "proj-bullet-tiny")],
    };
    const keys = collectLevelTextures(content, layoutOf("a")).map((r) => r.key);
    expect(keys).toContain("authored:proj-cluster-shell");
    expect(keys).toContain("authored:proj-bullet-tiny");
  });

  it("terminates on a Unit whose attack spawns itself", () => {
    const content: AuthoredContent = {
      tiles: [tile("a", "grass", [encounter("e1", "loop")])],
      units: [unit("loop", "heli", [firingAction("loop")])],
    };
    expect(collectLevelTextures(content, layoutOf("a")).map((r) => r.key)).toContain("authored:heli");
  });

  it("skips a placement whose tile no longer exists rather than throwing", () => {
    const content: AuthoredContent = { tiles: [], units: [] };
    expect(collectLevelTextures(content, layoutOf("gone"))).toEqual([]);
  });

  it("never emits the same key twice", () => {
    const content: AuthoredContent = {
      tiles: [tile("a", "grass", [encounter("e1", "u1")]), tile("b", "grass", [encounter("e2", "u1")])],
      units: [unit("u1", "heli")],
    };
    const keys = collectLevelTextures(content, layoutOf("a", "b")).map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("collectEncounterUnitTextures", () => {
  it("collects units only — tile art is a separate concern", () => {
    const content: AuthoredContent = { tiles: [tile("a", "grass", [])], units: [unit("u1", "heli")] };
    const keys = collectEncounterUnitTextures(content, encounter("e1", "u1")).map((r) => r.key);
    expect(keys).toEqual(["authored:heli"]);
  });
});
