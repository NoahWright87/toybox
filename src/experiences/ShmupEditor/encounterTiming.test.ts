import { describe, it, expect } from "vitest";
import { addStep, moveStep, updateStep } from "./encounterSteps";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { isStepTimeDerived, recomputeStepTimes, segmentDuration, speedMultiplierForDuration } from "./encounterTiming";
import { createBlankUnit, defaultStraightLine, defaultWave, type UnitDef } from "./unitTypes";

function unitWithActions(...actions: Partial<UnitDef["actions"][number]>[]): UnitDef {
  const u = createBlankUnit(0);
  u.actions = actions.map((a, i) => ({ ...u.actions[0], id: `action-${i}`, ...a }));
  return u;
}

describe("segmentDuration", () => {
  it("straightLine with no accel: distance / speed", () => {
    const d = segmentDuration({ ...defaultStraightLine(), speed: 100, accel: 0 }, 1, 400);
    expect(d).toBeCloseTo(4);
  });

  it("speedMultiplier scales duration inversely", () => {
    const d = segmentDuration({ ...defaultStraightLine(), speed: 100, accel: 0 }, 2, 400);
    expect(d).toBeCloseTo(2);
  });

  it("wave/spiral use base speed, ignoring oscillation", () => {
    const d = segmentDuration({ ...defaultWave(), speed: 50, amplitude: 999, frequency: 5 }, 1, 100);
    expect(d).toBeCloseTo(2);
  });

  it("straightLine with positive accel reaches the distance sooner than the no-accel case", () => {
    const flat = segmentDuration({ ...defaultStraightLine(), speed: 100, accel: 0 }, 1, 400);
    const accelerating = segmentDuration({ ...defaultStraightLine(), speed: 100, accel: 50 }, 1, 400);
    expect(accelerating).toBeLessThan(flat);
  });

  it("never returns less than the minimum step duration", () => {
    const d = segmentDuration({ ...defaultStraightLine(), speed: 100000, accel: 0 }, 1, 0.001);
    expect(d).toBeGreaterThanOrEqual(0.1);
  });

  it("falls back to a default duration when accel would decelerate to a stop short of the target", () => {
    // speed 10, accel -100: stops almost immediately, nowhere near 1000px away.
    const d = segmentDuration({ ...defaultStraightLine(), speed: 10, accel: -100 }, 1, 1000);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });
});

describe("speedMultiplierForDuration", () => {
  it("is the exact inverse of segmentDuration for the no-accel case", () => {
    const movement = { ...defaultStraightLine(), speed: 100, accel: 0 };
    const multiplier = speedMultiplierForDuration(movement, 400, 2);
    expect(segmentDuration(movement, multiplier, 400)).toBeCloseTo(2, 4);
  });

  it("clamps to a sane range instead of returning 0 or Infinity", () => {
    const movement = { ...defaultStraightLine(), speed: 100, accel: 0 };
    expect(speedMultiplierForDuration(movement, 400, 100000)).toBeGreaterThan(0);
    expect(speedMultiplierForDuration(movement, 400, 0.0001)).toBeLessThan(Infinity);
  });
});

describe("isStepTimeDerived", () => {
  it("the first step is never derived", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0 } });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    expect(isStepTimeDerived(inst, inst.steps[0].id, unit)).toBe(false);
  });

  it("a step is derived when its predecessor's action moves", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 100, y: 0 });
    expect(isStepTimeDerived(inst, inst.steps[1].id, unit)).toBe(true);
  });

  it("a step is manual when its predecessor's action is stationary", () => {
    const unit = unitWithActions({ movement: null }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 100, y: 0 });
    expect(isStepTimeDerived(inst, inst.steps[1].id, unit)).toBe(false);
  });
});

describe("recomputeStepTimes", () => {
  it("derives a moving step's successor time from distance and speed", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 400, y: 0 });
    const recomputed = recomputeStepTimes(inst, unit);
    expect(recomputed.steps[1].time).toBeCloseTo(4); // 400px / 100px/s
  });

  it("moving the waypoint closer shrinks the derived time", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 400, y: 0 });
    inst = moveStep(inst, inst.steps[1].id, { x: 100, y: 0 }); // 4x closer
    const recomputed = recomputeStepTimes(inst, unit);
    expect(recomputed.steps[1].time).toBeCloseTo(1);
  });

  it("leaves a manually-timed step (dwell predecessor) alone", () => {
    const unit = unitWithActions({ movement: null }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 400, y: 0 });
    inst = updateStep(inst, inst.steps[1].id, { time: 9 });
    const recomputed = recomputeStepTimes(inst, unit);
    expect(recomputed.steps[1].time).toBe(9);
  });

  it("floors a manual step's time to after its predecessor even if authored earlier", () => {
    const unit = unitWithActions({ movement: null }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { time: 5 });
    inst = addStep(inst, "action-1", { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[1].id, { time: 1 }); // earlier than predecessor
    const recomputed = recomputeStepTimes(inst, unit);
    expect(recomputed.steps[1].time).toBeGreaterThan(recomputed.steps[0].time);
  });

  it("cascades through multiple derived steps in one pass", () => {
    const unit = unitWithActions(
      { movement: { ...defaultStraightLine(), speed: 100, accel: 0 } },
      { movement: { ...defaultStraightLine(), speed: 50, accel: 0 } },
      { movement: null }
    );
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 200, y: 0 }); // 200px @ 100px/s = 2s
    inst = addStep(inst, "action-2", { x: 300, y: 0 }); // +100px @ 50px/s = 2s
    const recomputed = recomputeStepTimes(inst, unit);
    expect(recomputed.steps[1].time).toBeCloseTo(2);
    expect(recomputed.steps[2].time).toBeCloseTo(4);
  });

  it("respects a per-step speedMultiplier override", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { speedMultiplier: 2 });
    inst = addStep(inst, "action-1", { x: 400, y: 0 });
    const recomputed = recomputeStepTimes(inst, unit);
    expect(recomputed.steps[1].time).toBeCloseTo(2); // 400px @ 100px/s*2 = 2s
  });
});
