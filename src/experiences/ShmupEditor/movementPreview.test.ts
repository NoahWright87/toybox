import { describe, it, expect } from "vitest";
import { addStep, updateStep } from "./encounterSteps";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { computeInstancePreview } from "./movementPreview";
import { createBlankUnit, defaultSpiral, defaultStraightLine, defaultWave, type UnitDef } from "./unitTypes";

function unitWithActions(...actions: Partial<UnitDef["actions"][number]>[]): UnitDef {
  const u = createBlankUnit(0);
  u.actions = actions.map((a, i) => ({ ...u.actions[0], id: `action-${i}`, ...a }));
  return u;
}

describe("computeInstancePreview", () => {
  it("returns null before the instance has spawned", () => {
    const unit = unitWithActions({ movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 }); // time 0
    inst = updateStep(inst, inst.steps[0].id, { time: 5 });
    expect(computeInstancePreview(inst, unit, 0)).toBeNull();
  });

  it("returns null when the unit def is missing", () => {
    let inst: EncounterUnit = createEncounterUnit("missing");
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    expect(computeInstancePreview(inst, undefined, 0)).toBeNull();
  });

  it("stationary action (movement: null) stays at its step's pos", () => {
    const unit = unitWithActions({ movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 10, y: 20 });
    const preview = computeInstancePreview(inst, unit, 3);
    expect(preview?.pos).toEqual({ x: 10, y: 20 });
  });

  it("straightLine moves toward the next step's waypoint at the configured speed", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0, turnRate: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 }); // time 0
    inst = addStep(inst, "action-1", { x: 0, y: 1000 }); // time 2, straight down
    const preview = computeInstancePreview(inst, unit, 1); // elapsed 1s since step 0
    expect(preview?.pos.x).toBeCloseTo(0);
    expect(preview?.pos.y).toBeCloseTo(100); // speed 100 * 1s, heading (0,1)
  });

  it("a lone step with no neighbors defaults to heading straight down", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 50, accel: 0, turnRate: 0 } });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 5, y: 5 });
    const preview = computeInstancePreview(inst, unit, 2);
    expect(preview?.pos).toEqual({ x: 5, y: 105 }); // 50*2 = 100 down from y=5
  });

  it("the last step continues the heading from the previous step", () => {
    const unit = unitWithActions(
      { movement: { ...defaultStraightLine(), speed: 100, accel: 0, turnRate: 0 } },
      { movement: { ...defaultStraightLine(), speed: 50, accel: 0, turnRate: 0 } }
    );
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 }); // time 0
    inst = addStep(inst, "action-1", { x: 100, y: 0 }); // time 2, heading (1,0) from step 0->1
    const preview = computeInstancePreview(inst, unit, 3); // 1s into the last step
    expect(preview?.pos.x).toBeCloseTo(150); // 100 + 50*1, continuing heading (1,0)
    expect(preview?.pos.y).toBeCloseTo(0);
  });

  it("wave oscillates perpendicular to the base heading", () => {
    const unit = unitWithActions({ movement: { ...defaultWave(), speed: 0, amplitude: 10, frequency: 1, phase: 0.25, waveform: "smooth" } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 }); // time 0
    inst = addStep(inst, "action-1", { x: 0, y: 100 }); // time 2, heading (0,1) -> perpendicular (-1,0)
    // phase 0.25 means sin(2*pi*0.25) = sin(pi/2) = 1 at elapsed=0
    const preview = computeInstancePreview(inst, unit, 0);
    expect(preview?.pos.x).toBeCloseTo(-10);
    expect(preview?.pos.y).toBeCloseTo(0);
  });

  it("spiral orbits around a moving center", () => {
    const unit = unitWithActions({ movement: { ...defaultSpiral(), speed: 0, radius: 20, angularSpeed: 90, radiusGrowth: 0 } });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    // angularSpeed 90 deg/sec, elapsed 1s -> 90 degrees -> cos(90)=0, sin(90)=1
    const preview = computeInstancePreview(inst, unit, 1);
    expect(preview?.pos.x).toBeCloseTo(0, 4);
    expect(preview?.pos.y).toBeCloseTo(20, 4);
  });

  it("resolves the correct action for a later step, not just the first", () => {
    const unit = unitWithActions({ movement: null }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 }); // time 0
    inst = addStep(inst, "action-1", { x: 50, y: 50 }); // time 2
    const preview = computeInstancePreview(inst, unit, 2.5);
    expect(preview?.action.id).toBe("action-1");
    expect(preview?.pos).toEqual({ x: 50, y: 50 });
  });
});
