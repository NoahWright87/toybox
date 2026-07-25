import { describe, it, expect } from "vitest";
import { minDurationWarning } from "./attackValidation";
import { addPartAction } from "./partActions";
import { createEncounterUnit, type PartActionPlacement } from "./encounterTypes";
import { createBlankAttack, createDefaultPart, type ActionDef, type UnitDef, type UnitPart } from "./unitTypes";

function finiteAttackAction(id: string): ActionDef {
  return {
    id,
    name: "Burst",
    movementPercent: 0,
    facing: "fixed",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    // telegraph 0, 1 burst, 3 shots @ 100ms apart -> 200ms duration
    attack: { ...createBlankAttack(), telegraphMs: 0, repeatCount: 1, burstIntervalMs: 1000, count: 3, perShotDelayMs: 100 },
  };
}

function indefiniteAttackAction(id: string): ActionDef {
  return {
    id,
    name: "Suppress",
    movementPercent: 0,
    facing: "fixed",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: { ...createBlankAttack(), repeatCount: null },
  };
}

function part(actions: ActionDef[]): UnitPart {
  return { ...createDefaultPart(), id: "part-1", actions };
}

function unit(p: UnitPart): UnitDef {
  return {
    id: "unit-1", name: "Test", spriteId: "none", customSprite: null,
    hp: 10, contactDamage: 1, scoreValue: 0, speed: 100, turnRate: 1, size: 16,
    layer: "ground", defaultActionId: null, actions: [], parts: [p],
    createdAt: 0, modifiedAt: 0,
  };
}

function placement(partId: string, actionId: string | null, time: number): PartActionPlacement {
  return { id: `pl-${time}-${actionId}`, partId, actionId, time };
}

describe("minDurationWarning", () => {
  it("returns null when there's no preceding placement on the track", () => {
    const p = part([finiteAttackAction("a1")]);
    const u = unit(p);
    let instance = createEncounterUnit(u.id);
    instance = addPartAction(instance, p.id, "a1", 0);
    const placed = instance.partActions[0];
    expect(minDurationWarning(instance, u, placed)).toBeNull();
  });

  it("warns when the current placement lands before the preceding finite attack finishes", () => {
    const p = part([finiteAttackAction("a1")]);
    const u = unit(p);
    let instance = createEncounterUnit(u.id);
    instance = addPartAction(instance, p.id, "a1", 0); // finishes at 0.2s
    instance = addPartAction(instance, p.id, "a1", 0.1); // too early
    const current = instance.partActions[1];
    const warning = minDurationWarning(instance, u, current);
    expect(warning).toContain("Burst");
    expect(warning).toContain("0.10s");
  });

  it("returns null once the current placement lands after the preceding attack finishes", () => {
    const p = part([finiteAttackAction("a1")]);
    const u = unit(p);
    let instance = createEncounterUnit(u.id);
    instance = addPartAction(instance, p.id, "a1", 0); // finishes at 0.2s
    instance = addPartAction(instance, p.id, "a1", 0.2);
    const current = instance.partActions[1];
    expect(minDurationWarning(instance, u, current)).toBeNull();
  });

  it("warns about an indefinite-repeat preceding attack regardless of how far after it the next one lands", () => {
    const p = part([indefiniteAttackAction("a1")]);
    const u = unit(p);
    let instance = createEncounterUnit(u.id);
    instance = addPartAction(instance, p.id, "a1", 0);
    instance = addPartAction(instance, p.id, "a1", 50);
    const current = instance.partActions[1];
    expect(minDurationWarning(instance, u, current)).toContain("indefinitely");
  });

  it("only compares against the nearest preceding placement, not an earlier one", () => {
    const p = part([finiteAttackAction("a1")]);
    const u = unit(p);
    let instance = createEncounterUnit(u.id);
    instance = addPartAction(instance, p.id, "a1", 0); // finishes 0.2s
    instance = addPartAction(instance, p.id, "a1", 1); // finishes 1.2s, well clear of the first
    instance = addPartAction(instance, p.id, "a1", 1.05); // too early relative to the *second*, fine relative to the first
    const current = instance.partActions[2];
    expect(minDurationWarning(instance, u, current)).toContain("Burst");
  });

  it("ignores placements on other Part tracks", () => {
    const p1 = part([finiteAttackAction("a1")]);
    const p2: UnitPart = { ...createDefaultPart(), id: "part-2", actions: [finiteAttackAction("a2")] };
    const u: UnitDef = { ...unit(p1), parts: [p1, p2] };
    let instance = createEncounterUnit(u.id);
    instance = addPartAction(instance, p1.id, "a1", 0);
    instance = addPartAction(instance, p2.id, "a2", 0.1);
    const current = instance.partActions[1];
    expect(minDurationWarning(instance, u, current)).toBeNull();
  });

  it("returns null for a placement whose part doesn't resolve", () => {
    const p = part([finiteAttackAction("a1")]);
    const u = unit(p);
    const instance = createEncounterUnit(u.id);
    const orphan = placement("part-missing", null, 0);
    expect(minDurationWarning(instance, u, orphan)).toBeNull();
  });
});
