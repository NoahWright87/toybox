import { describe, it, expect } from "vitest";
import { addPartAction, partActionsForPart, deletePartAction, seedPartActions, updatePartAction } from "./partActions";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { createBlankAction, createBlankPart, createBlankUnit, type UnitDef } from "./unitTypes";

function instance(): EncounterUnit {
  return createEncounterUnit("unit-test");
}

/** A Unit with `partCount` Parts, each carrying `actionsPerPart` Actions. */
function unitWithParts(partCount: number, actionsPerPart: number): UnitDef {
  const parts = Array.from({ length: partCount }, (_, i) => ({
    ...createBlankPart(i),
    actions: Array.from({ length: actionsPerPart }, (_, j) => createBlankAction(j)),
  }));
  return { ...createBlankUnit(0), parts };
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

describe("seedPartActions", () => {
  it("gives every Part a placement at spawn time, so a placed Unit arrives fully formed", () => {
    const unit = unitWithParts(3, 1);
    const seeded = seedPartActions(instance(), unit, 0);
    expect(seeded.partActions).toHaveLength(3);
    expect(new Set(seeded.partActions.map((p) => p.partId))).toEqual(new Set(unit.parts.map((p) => p.id)));
    expect(seeded.partActions.every((p) => p.time === 0)).toBe(true);
  });

  it("points each seeded placement at that Part's own first Action", () => {
    const unit = unitWithParts(2, 2);
    const seeded = seedPartActions(instance(), unit, 0);
    for (const part of unit.parts) {
      const placement = seeded.partActions.find((p) => p.partId === part.id);
      expect(placement?.actionId).toBe(part.actions[0].id);
    }
  });

  it("still seeds a dot for a Part with no Actions, rather than leaving it trackless", () => {
    const seeded = seedPartActions(instance(), unitWithParts(1, 0), 0);
    expect(seeded.partActions).toHaveLength(1);
    expect(seeded.partActions[0].actionId).toBeNull();
  });

  it("seeds at the instance's own spawn time, not a hardcoded zero", () => {
    const seeded = seedPartActions(instance(), unitWithParts(2, 1), 4.25);
    expect(seeded.partActions.every((p) => p.time === 4.25)).toBe(true);
  });

  it("is idempotent per Part — re-running never duplicates an existing track", () => {
    const unit = unitWithParts(2, 1);
    const once = seedPartActions(instance(), unit, 0);
    const twice = seedPartActions(once, unit, 3);
    expect(twice.partActions).toHaveLength(2);
    expect(twice).toBe(once); // nothing missing, so not even a new object
  });

  it("leaves a hand-authored placement alone and only fills in the Parts that have none", () => {
    const unit = unitWithParts(3, 1);
    const authored = addPartAction(instance(), unit.parts[1].id, unit.parts[1].actions[0].id, 7);
    const seeded = seedPartActions(authored, unit, 0);
    expect(seeded.partActions).toHaveLength(3);
    expect(partActionsForPart(seeded, unit.parts[1].id)).toHaveLength(1);
    expect(partActionsForPart(seeded, unit.parts[1].id)[0].time).toBe(7);
  });

  it("is a no-op when the Unit can't be resolved", () => {
    const inst = instance();
    expect(seedPartActions(inst, undefined, 0)).toBe(inst);
  });

  it("gives every seeded placement a distinct id", () => {
    const seeded = seedPartActions(instance(), unitWithParts(4, 1), 0);
    expect(new Set(seeded.partActions.map((p) => p.id)).size).toBe(4);
  });
});
