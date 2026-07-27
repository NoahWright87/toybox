import { describe, it, expect } from "vitest";
import { addStep, moveStep, updateStep } from "./encounterSteps";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { isStepTimeDerived, MIN_STEP_DURATION, recomputeStepTimes, segmentArcLength, segmentDuration } from "./encounterTiming";
import { createBlankAction, createBlankUnit, type ActionDef, type UnitDef } from "./unitTypes";

function unit(overrides: Partial<UnitDef> = {}): UnitDef {
  return { ...createBlankUnit(0), ...overrides };
}

function action(overrides: Partial<ActionDef> = {}): ActionDef {
  return { ...createBlankAction(0), ...overrides };
}

describe("segmentDuration", () => {
  it("is arcLength / speed at 100% movement", () => {
    expect(segmentDuration(400, 100, 100)).toBeCloseTo(4);
  });

  it("movementPercent scales duration inversely", () => {
    expect(segmentDuration(400, 100, 50)).toBeCloseTo(8);
  });

  it("never returns less than the minimum step duration", () => {
    expect(segmentDuration(0.001, 100000, 100)).toBeGreaterThanOrEqual(MIN_STEP_DURATION);
  });

  it("floors an unreasonably low movementPercent instead of dividing toward Infinity", () => {
    expect(segmentDuration(400, 100, 0)).toBeLessThan(Infinity);
    expect(segmentDuration(400, 100, -5)).toBeLessThan(Infinity);
  });
});

describe("segmentArcLength", () => {
  it("equals the straight-line distance when both handles are null (default straight-line-equivalent curve)", () => {
    const u = unit({ turnRate: 1 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 300, y: 0 });
    expect(segmentArcLength(inst.steps[0], inst.steps[1], u)).toBeCloseTo(300, 1);
  });

  it("is longer than the straight-line distance once a handle bulges the curve", () => {
    const u = unit({ turnRate: 1 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 300, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { handleOut: { x: 100, y: 150 } });
    expect(segmentArcLength(inst.steps[0], inst.steps[1], u)).toBeGreaterThan(300);
  });

  it("a lower turnRate clamps the handle and shortens the resulting arc length", () => {
    let inst: EncounterUnit = createEncounterUnit("u");
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 300, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { handleOut: { x: 100, y: 500 } });
    const loose = segmentArcLength(inst.steps[0], inst.steps[1], unit({ turnRate: 2 }));
    const stiff = segmentArcLength(inst.steps[0], inst.steps[1], unit({ turnRate: 0.1 }));
    expect(stiff).toBeLessThan(loose);
  });
});

describe("isStepTimeDerived", () => {
  it("the first step is never derived", () => {
    let inst: EncounterUnit = createEncounterUnit("u");
    inst = addStep(inst, null, { x: 0, y: 0 });
    expect(isStepTimeDerived(inst, inst.steps[0].id, unit())).toBe(false);
  });

  it("a step at a different position than its predecessor is derived", () => {
    let inst: EncounterUnit = createEncounterUnit("u");
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 100, y: 0 });
    expect(isStepTimeDerived(inst, inst.steps[1].id, unit())).toBe(true);
  });

  it("a step at the same position as its predecessor (dwelling) is manual", () => {
    let inst: EncounterUnit = createEncounterUnit("u");
    inst = addStep(inst, null, { x: 50, y: 50 });
    inst = addStep(inst, null, { x: 50, y: 50 });
    expect(isStepTimeDerived(inst, inst.steps[1].id, unit())).toBe(false);
  });

  it("is false when the unit def is missing", () => {
    let inst: EncounterUnit = createEncounterUnit("u");
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 100, y: 0 });
    expect(isStepTimeDerived(inst, inst.steps[1].id, undefined)).toBe(false);
  });
});

describe("recomputeStepTimes", () => {
  it("derives a moving step's time from arc length and unit speed (unresolved actionId defaults to full speed)", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    const recomputed = recomputeStepTimes(inst, u);
    expect(recomputed.steps[1].time).toBeCloseTo(4); // 400px / 100px/s
  });

  it("moving the waypoint closer shrinks the derived time", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    inst = moveStep(inst, inst.steps[1].id, { x: 100, y: 0 }); // 4x closer
    const recomputed = recomputeStepTimes(inst, u);
    expect(recomputed.steps[1].time).toBeCloseTo(1);
  });

  it("leaves a dwelling (same-position) step's manually-set time alone", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[1].id, { time: 9 });
    const recomputed = recomputeStepTimes(inst, u);
    expect(recomputed.steps[1].time).toBe(9);
  });

  it("floors a manual (dwelling) step's time to after its predecessor even if authored earlier", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { time: 5 });
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[1].id, { time: 1 }); // earlier than predecessor
    const recomputed = recomputeStepTimes(inst, u);
    expect(recomputed.steps[1].time).toBeGreaterThan(recomputed.steps[0].time);
  });

  it("cascades through multiple derived steps in one pass", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 200, y: 0 }); // 200px @ 100px/s = 2s
    inst = addStep(inst, null, { x: 300, y: 0 }); // +100px @ 100px/s = 1s
    const recomputed = recomputeStepTimes(inst, u);
    expect(recomputed.steps[1].time).toBeCloseTo(2);
    expect(recomputed.steps[2].time).toBeCloseTo(3);
  });

  it("respects the predecessor's referenced Action's movementPercent", () => {
    const halfSpeed = action({ movementPercent: 50 });
    const u = unit({ speed: 100, actions: [halfSpeed] });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, halfSpeed.id, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    const recomputed = recomputeStepTimes(inst, u);
    expect(recomputed.steps[1].time).toBeCloseTo(8); // 400px @ 100px/s*0.5 = 8s
  });

  it("is a no-op when the unit def is missing", () => {
    let inst: EncounterUnit = createEncounterUnit("u");
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    expect(recomputeStepTimes(inst, undefined)).toBe(inst);
  });
});
