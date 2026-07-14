import { describe, it, expect } from "vitest";
import { addAttack, attacksForPart, deleteAttack, updateAttack } from "./encounterAttacks";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";

function instance(): EncounterUnit {
  return createEncounterUnit("unit-test");
}

describe("addAttack", () => {
  it("appends an attack with the given part/weapon/time", () => {
    const e = addAttack(instance(), "part-1", "weapon-1", 3.5);
    expect(e.attacks).toHaveLength(1);
    expect(e.attacks[0]).toMatchObject({ partId: "part-1", weaponId: "weapon-1", time: 3.5, durationMs: 0, aimAngleOverride: null });
  });

  it("does not require any steps to exist first", () => {
    const e = addAttack(instance(), "part-1", "weapon-1", 0);
    expect(e.steps).toHaveLength(0);
    expect(e.attacks).toHaveLength(1);
  });

  it("assigns unique ids to successive attacks", () => {
    let e = addAttack(instance(), "part-1", "weapon-1", 0);
    e = addAttack(e, "part-1", "weapon-1", 1);
    expect(e.attacks[0].id).not.toBe(e.attacks[1].id);
  });
});

describe("updateAttack", () => {
  it("patches arbitrary fields", () => {
    let e = addAttack(instance(), "part-1", "weapon-1", 1);
    const id = e.attacks[0].id;
    e = updateAttack(e, id, { aimAngleOverride: 45, durationMs: 2000 });
    expect(e.attacks[0].aimAngleOverride).toBe(45);
    expect(e.attacks[0].durationMs).toBe(2000);
  });

  it("floors a negative time patch at 0", () => {
    let e = addAttack(instance(), "part-1", "weapon-1", 1);
    const id = e.attacks[0].id;
    e = updateAttack(e, id, { time: -5 });
    expect(e.attacks[0].time).toBe(0);
  });

  it("leaves other attacks untouched", () => {
    let e = addAttack(instance(), "part-1", "weapon-1", 1);
    e = addAttack(e, "part-2", "weapon-2", 2);
    const targetId = e.attacks[0].id;
    e = updateAttack(e, targetId, { time: 9 });
    expect(e.attacks[0].time).toBe(9);
    expect(e.attacks[1].time).toBe(2);
  });
});

describe("deleteAttack", () => {
  it("removes only the targeted attack", () => {
    let e = addAttack(instance(), "part-1", "weapon-1", 1);
    e = addAttack(e, "part-1", "weapon-1", 2);
    const idToDelete = e.attacks[0].id;
    e = deleteAttack(e, idToDelete);
    expect(e.attacks).toHaveLength(1);
    expect(e.attacks[0].time).toBe(2);
  });

  it("never cascades to other attacks (unlike deleteStepsFrom)", () => {
    let e = addAttack(instance(), "part-1", "weapon-1", 1);
    e = addAttack(e, "part-1", "weapon-1", 2);
    e = addAttack(e, "part-1", "weapon-1", 3);
    e = deleteAttack(e, e.attacks[0].id);
    expect(e.attacks).toHaveLength(2);
  });
});

describe("attacksForPart", () => {
  it("filters to only the requested part, sorted by time", () => {
    let e = addAttack(instance(), "part-1", "weapon-1", 5);
    e = addAttack(e, "part-2", "weapon-2", 1);
    e = addAttack(e, "part-1", "weapon-1", 2);
    const part1 = attacksForPart(e, "part-1");
    expect(part1.map((a) => a.time)).toEqual([2, 5]);
  });

  it("returns an empty array for a part with no attacks", () => {
    const e = addAttack(instance(), "part-1", "weapon-1", 1);
    expect(attacksForPart(e, "part-2")).toEqual([]);
  });
});
