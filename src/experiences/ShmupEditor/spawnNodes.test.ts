import { describe, it, expect } from "vitest";
import { addSpawnNode, deleteSpawnNode, updateSpawnNode } from "./spawnNodes";
import { createBlankEncounter } from "./encounterTypes";

function encounter() {
  return createBlankEncounter(0);
}

describe("addSpawnNode", () => {
  it("appends a node anchored/referencing what's given", () => {
    const e = addSpawnNode(encounter(), { x: 10, y: 20 }, "unit-1");
    expect(e.spawnNodes).toHaveLength(1);
    expect(e.spawnNodes[0].origin.anchor).toEqual({ x: 10, y: 20 });
    expect(e.spawnNodes[0].unitDefId).toBe("unit-1");
  });

  it("assigns unique ids to successive nodes", () => {
    let e = addSpawnNode(encounter(), { x: 0, y: 0 }, null);
    e = addSpawnNode(e, { x: 0, y: 0 }, null);
    expect(e.spawnNodes[0].id).not.toBe(e.spawnNodes[1].id);
  });
});

describe("updateSpawnNode", () => {
  it("patches arbitrary fields", () => {
    let e = addSpawnNode(encounter(), { x: 0, y: 0 }, null);
    const id = e.spawnNodes[0].id;
    e = updateSpawnNode(e, id, { name: "Ambush", mirror: true, minCount: 3 });
    expect(e.spawnNodes[0]).toMatchObject({ name: "Ambush", mirror: true, minCount: 3 });
  });

  it("leaves other nodes untouched", () => {
    let e = addSpawnNode(encounter(), { x: 0, y: 0 }, null);
    e = addSpawnNode(e, { x: 5, y: 5 }, null);
    const targetId = e.spawnNodes[0].id;
    e = updateSpawnNode(e, targetId, { name: "Renamed" });
    expect(e.spawnNodes[0].name).toBe("Renamed");
    expect(e.spawnNodes[1].name).not.toBe("Renamed");
  });
});

describe("deleteSpawnNode", () => {
  it("removes only the targeted node, no cascade", () => {
    let e = addSpawnNode(encounter(), { x: 0, y: 0 }, null);
    e = addSpawnNode(e, { x: 1, y: 1 }, null);
    e = addSpawnNode(e, { x: 2, y: 2 }, null);
    const idToDelete = e.spawnNodes[0].id;
    e = deleteSpawnNode(e, idToDelete);
    expect(e.spawnNodes).toHaveLength(2);
    expect(e.spawnNodes.find((n) => n.id === idToDelete)).toBeUndefined();
  });
});
