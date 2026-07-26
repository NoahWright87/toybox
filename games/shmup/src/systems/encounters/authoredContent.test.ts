import { describe, expect, it } from "vitest";
import {
  AUTHORED_TILES_VERSION,
  AUTHORED_UNITS_VERSION,
  authoredToGeneratorTile,
  parseAuthoredTiles,
  parseAuthoredUnits,
  playableTiles,
} from "./authoredContent";
import type { AuthoredEncounter, AuthoredTile, AuthoredUnitDef } from "./authoredTypes";

function unit(overrides: Partial<AuthoredUnitDef> = {}): AuthoredUnitDef {
  return {
    id: "unit-1",
    name: "Jet",
    spriteId: "jet-fighter",
    customSprite: null,
    hp: 25,
    contactDamage: 3,
    scoreValue: 220,
    speed: 220,
    turnRate: 1.4,
    size: 16,
    layer: "air",
    defaultActionId: null,
    actions: [],
    parts: [],
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

function encounter(overrides: Partial<AuthoredEncounter> = {}): AuthoredEncounter {
  return { id: "enc-1", name: "Opening", weight: 1, units: [], createdAt: 0, modifiedAt: 0, ...overrides };
}

function tile(overrides: Partial<AuthoredTile> = {}): AuthoredTile {
  return {
    id: "tile-1",
    name: "Grass",
    footprint: 1,
    north: [{ tag: "grass", hardwall: false }],
    south: [{ tag: "grass", hardwall: false }],
    east: { tag: "", hardwall: true },
    west: { tag: "", hardwall: true },
    isConnector: false,
    weight: 1,
    imageId: "grass",
    customImage: null,
    encounters: [],
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

describe("parseAuthoredTiles", () => {
  it("reads a current-version payload", () => {
    const raw = JSON.stringify({ version: AUTHORED_TILES_VERSION, tiles: [tile()] });
    expect(parseAuthoredTiles(raw)).toHaveLength(1);
  });

  it("reads nothing from an older save rather than half-reading a shape that has since changed", () => {
    const raw = JSON.stringify({ version: AUTHORED_TILES_VERSION - 1, tiles: [tile()] });
    expect(parseAuthoredTiles(raw)).toEqual([]);
  });

  it("survives an empty file and malformed JSON — both mean 'nothing authored here'", () => {
    expect(parseAuthoredTiles(undefined)).toEqual([]);
    expect(parseAuthoredTiles("")).toEqual([]);
    expect(parseAuthoredTiles("{not json")).toEqual([]);
  });

  it("drops only the mangled record, since these files are meant to be hand-edited", () => {
    const raw = JSON.stringify({
      version: AUTHORED_TILES_VERSION,
      tiles: [tile({ id: "good" }), { id: "bad", name: "Half a tile" }],
    });
    expect(parseAuthoredTiles(raw).map((t) => t.id)).toEqual(["good"]);
  });

  it("rejects a tile whose edge slots don't match its footprint", () => {
    const raw = JSON.stringify({ version: AUTHORED_TILES_VERSION, tiles: [tile({ footprint: 2 })] });
    expect(parseAuthoredTiles(raw)).toEqual([]);
  });

  it("resets a malformed encounter list instead of discarding the whole tile", () => {
    const raw = JSON.stringify({
      version: AUTHORED_TILES_VERSION,
      tiles: [{ ...tile(), encounters: [{ nonsense: true }] }],
    });
    const [parsed] = parseAuthoredTiles(raw);
    expect(parsed.encounters).toEqual([]);
  });
});

describe("parseAuthoredUnits", () => {
  it("reads a current-version payload", () => {
    const raw = JSON.stringify({ version: AUTHORED_UNITS_VERSION, units: [unit()] });
    expect(parseAuthoredUnits(raw)).toHaveLength(1);
  });

  it("drops a Unit with a malformed Action rather than trusting it at runtime", () => {
    const raw = JSON.stringify({
      version: AUTHORED_UNITS_VERSION,
      units: [unit({ id: "ok" }), unit({ id: "broken", actions: [{ id: "a" } as never] })],
    });
    expect(parseAuthoredUnits(raw).map((u) => u.id)).toEqual(["ok"]);
  });

  it("rejects an unknown collision group on a spawned projectile", () => {
    const bad = unit({
      actions: [
        {
          id: "a",
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
            spawnUnitId: "unit-bullet",
            spawnScale: 1,
            spawnGroup: "aliens" as never,
          },
        },
      ],
    });
    expect(parseAuthoredUnits(JSON.stringify({ version: AUTHORED_UNITS_VERSION, units: [bad] }))).toEqual([]);
  });
});

describe("playableTiles", () => {
  it("offers only tiles that actually have something to play", () => {
    const content = { tiles: [tile({ id: "empty" }), tile({ id: "full", encounters: [encounter()] })], units: [] };
    expect(playableTiles(content).map((t) => t.id)).toEqual(["full"]);
  });
});

describe("authoredToGeneratorTile", () => {
  it("projects edges down to the generator's tag-only shape", () => {
    const generatorTile = authoredToGeneratorTile(tile());
    expect(generatorTile).toEqual({
      id: "tile-1",
      footprint: 1,
      north: ["grass"],
      south: ["grass"],
      east: "hardwall",
      west: "hardwall",
      weight: 1,
    });
  });

  it("lets a hardwall win over whatever text is left in the tag field", () => {
    const generatorTile = authoredToGeneratorTile(tile({ east: { tag: "grass", hardwall: true } }));
    expect(generatorTile.east).toBe("hardwall");
  });

  it("carries a wildcard through as-is — a connector's 'matches anything' is the tag, not the flag", () => {
    const generatorTile = authoredToGeneratorTile(
      tile({ isConnector: true, south: [{ tag: "*", hardwall: false }] })
    );
    expect(generatorTile.south).toEqual(["*"]);
  });
});
