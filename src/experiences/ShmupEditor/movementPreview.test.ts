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

  it("a lone step with no next waypoint holds at its own position, even with a moving Action", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 50, accel: 0, turnRate: 0 } });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 5, y: 5 });
    const preview = computeInstancePreview(inst, unit, 2);
    expect(preview?.pos).toEqual({ x: 5, y: 5 }); // no destination to head toward, so it never moves
  });

  it("the last step holds at its own position instead of continuing the previous heading", () => {
    const unit = unitWithActions(
      { movement: { ...defaultStraightLine(), speed: 100, accel: 0, turnRate: 0 } },
      { movement: { ...defaultStraightLine(), speed: 50, accel: 0, turnRate: 0 } }
    );
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 }); // time 0
    inst = addStep(inst, "action-1", { x: 100, y: 0 }); // time 2, heading (1,0) from step 0->1
    const preview = computeInstancePreview(inst, unit, 3); // 1s into the last step
    expect(preview?.pos).toEqual({ x: 100, y: 0 }); // frozen at its own waypoint, no further travel
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
    const unit = unitWithActions({ movement: { ...defaultSpiral(), speed: 0, radius: 20, angularSpeed: 90, radiusGrowth: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 1000, y: 1000 }); // just needs to exist so this isn't a terminal (frozen) step
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

  it("holds at the next waypoint instead of overshooting when the authored gap is longer than the natural travel time", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 }); // time 0
    inst = addStep(inst, "action-1", { x: 100, y: 0 }); // default time 2, but 100px @ 100px/s only takes 1s
    // Well past the natural 1s arrival, still within the authored 2s gap.
    const preview = computeInstancePreview(inst, unit, 1.9);
    expect(preview?.pos.x).toBeCloseTo(100); // held at the waypoint, not overshot to 190
    expect(preview?.pos.y).toBeCloseTo(0);
  });

  it("a fast unit never travels arbitrarily far past its last waypoint, no matter how far the scrub goes", () => {
    // This is the exact bug report: a fast lone/terminal unit kept traveling
    // long after "reaching" its final node — now it just never moves past it.
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 300, accel: 0 } });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    const soonAfter = computeInstancePreview(inst, unit, 0.5);
    const wayPast = computeInstancePreview(inst, unit, 500);
    expect(soonAfter?.pos).toEqual({ x: 0, y: 0 });
    expect(wayPast?.pos).toEqual({ x: 0, y: 0 });
  });

  it("speedMultiplier dilates elapsed time (2x runs the movement twice as far in the same wall-clock time)", () => {
    const unit = unitWithActions({ movement: { ...defaultStraightLine(), speed: 100, accel: 0 } }, { movement: null });
    let inst: EncounterUnit = createEncounterUnit(unit.id);
    inst = addStep(inst, "action-0", { x: 0, y: 0 });
    inst = addStep(inst, "action-1", { x: 0, y: 1000 }); // far enough away that neither run overshoots
    const at1x = computeInstancePreview(inst, unit, 1);

    const doubled = updateStep(inst, inst.steps[0].id, { speedMultiplier: 2 });
    const at2x = computeInstancePreview(doubled, unit, 1);

    expect(at2x?.pos.y).toBeCloseTo((at1x?.pos.y ?? 0) * 2);
  });
});
