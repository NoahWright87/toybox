import { describe, it, expect } from "vitest";
import { addPartAction, partActionsForPart, deletePartAction, updatePartAction } from "./partActions";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";

function instance(): EncounterUnit {
  return createEncounterUnit("unit-test");
}

describe("addPartAction", () => {
  it("appends a placement with the given part/action/time", () => {
    const e = addPartAction(instance(), "part-1", "action-1", 3.5);
    expect(e.partActions).toHaveLength(1);
    expect(e.partActions[0]).toMatchObject({ partId: "part-1", actionId: "action-1", time: 3.5 });
  });

  it("does not require any steps to exist first", () => {
    const e = addPartAction(instance(), "part-1", "action-1", 0);
    expect(e.steps).toHaveLength(0);
    expect(e.partActions).toHaveLength(1);
  });

  it("assigns unique ids to successive placements", () => {
    let e = addPartAction(instance(), "part-1", "action-1", 0);
    e = addPartAction(e, "part-1", "action-1", 1);
    expect(e.partActions[0].id).not.toBe(e.partActions[1].id);
  });

  it("accepts a null actionId (Part has no Actions authored yet)", () => {
    const e = addPartAction(instance(), "part-1", null, 0);
    expect(e.partActions[0].actionId).toBeNull();
  });
});

describe("updatePartAction", () => {
  it("patches arbitrary fields", () => {
    let e = addPartAction(instance(), "part-1", "action-1", 1);
    const id = e.partActions[0].id;
    e = updatePartAction(e, id, { actionId: "action-2" });
    expect(e.partActions[0].actionId).toBe("action-2");
  });

  it("floors a negative time patch at 0", () => {
    let e = addPartAction(instance(), "part-1", "action-1", 1);
    const id = e.partActions[0].id;
    e = updatePartAction(e, id, { time: -5 });
    expect(e.partActions[0].time).toBe(0);
  });

  it("leaves other placements untouched", () => {
    let e = addPartAction(instance(), "part-1", "action-1", 1);
    e = addPartAction(e, "part-2", "action-2", 2);
    const targetId = e.partActions[0].id;
    e = updatePartAction(e, targetId, { time: 9 });
    expect(e.partActions[0].time).toBe(9);
    expect(e.partActions[1].time).toBe(2);
  });
});

describe("deletePartAction", () => {
  it("removes only the targeted placement", () => {
    let e = addPartAction(instance(), "part-1", "action-1", 1);
    e = addPartAction(e, "part-1", "action-1", 2);
    const idToDelete = e.partActions[0].id;
    e = deletePartAction(e, idToDelete);
    expect(e.partActions).toHaveLength(1);
    expect(e.partActions[0].time).toBe(2);
  });

  it("never cascades to other placements (unlike deleteStepsFrom)", () => {
    let e = addPartAction(instance(), "part-1", "action-1", 1);
    e = addPartAction(e, "part-1", "action-1", 2);
    e = addPartAction(e, "part-1", "action-1", 3);
    e = deletePartAction(e, e.partActions[0].id);
    expect(e.partActions).toHaveLength(2);
  });
});

describe("partActionsForPart", () => {
  it("filters to only the requested part, sorted by time", () => {
    let e = addPartAction(instance(), "part-1", "action-1", 5);
    e = addPartAction(e, "part-2", "action-2", 1);
    e = addPartAction(e, "part-1", "action-1", 2);
    const part1 = partActionsForPart(e, "part-1");
    expect(part1.map((a) => a.time)).toEqual([2, 5]);
  });

  it("returns an empty array for a part with no placements", () => {
    const e = addPartAction(instance(), "part-1", "action-1", 1);
    expect(partActionsForPart(e, "part-2")).toEqual([]);
  });
});
