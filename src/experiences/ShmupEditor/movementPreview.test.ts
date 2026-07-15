import { describe, it, expect } from "vitest";
import { addStep, updateStep } from "./encounterSteps";
import { recomputeStepTimes } from "./encounterTiming";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { computeInstancePreview } from "./movementPreview";
import { createBlankUnit, type UnitDef } from "./unitTypes";

function unit(overrides: Partial<UnitDef> = {}): UnitDef {
  return { ...createBlankUnit(0), ...overrides };
}

describe("computeInstancePreview", () => {
  it("returns null before the instance has spawned", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { time: 5 });
    expect(computeInstancePreview(inst, u, 0)).toBeNull();
  });

  it("returns null when the unit def is missing", () => {
    let inst: EncounterUnit = createEncounterUnit("missing");
    inst = addStep(inst, { x: 0, y: 0 });
    expect(computeInstancePreview(inst, undefined, 0)).toBeNull();
  });

  it("a dwelling step (same position as predecessor) holds in place", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 10, y: 20 });
    inst = addStep(inst, { x: 10, y: 20 });
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, 100);
    expect(preview?.pos).toEqual({ x: 10, y: 20 });
  });

  it("a lone step with no next waypoint holds at its own position", () => {
    const u = unit({ speed: 300 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 5, y: 5 });
    inst = recomputeStepTimes(inst, u);
    const soonAfter = computeInstancePreview(inst, u, 0.5);
    const wayPast = computeInstancePreview(inst, u, 500);
    expect(soonAfter?.pos).toEqual({ x: 5, y: 5 });
    expect(wayPast?.pos).toEqual({ x: 5, y: 5 });
  });

  it("the last step holds at its own position instead of continuing motion", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 0, y: 0 });
    inst = addStep(inst, { x: 100, y: 0 });
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, inst.steps[1].time + 5);
    expect(preview?.pos).toEqual({ x: 100, y: 0 });
  });

  it("moves along a straight-line-equivalent curve (null handles) at the midpoint", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 0, y: 0 });
    inst = addStep(inst, { x: 400, y: 0 });
    inst = recomputeStepTimes(inst, u); // duration = 4s
    const preview = computeInstancePreview(inst, u, 2); // halfway through time
    expect(preview?.pos.x).toBeCloseTo(200);
    expect(preview?.pos.y).toBeCloseTo(0);
  });

  it("arrives essentially exactly at the destination when u reaches 1", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 0, y: 0 });
    inst = addStep(inst, { x: 400, y: 300 });
    inst = updateStep(inst, inst.steps[0].id, { handleOut: { x: 50, y: 200 } }); // a real curve, not a straight line
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, inst.steps[1].time);
    expect(preview?.pos.x).toBeCloseTo(400, 0);
    expect(preview?.pos.y).toBeCloseTo(300, 0);
  });

  it("bulges off the straight line when a handle is set", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 0, y: 0 });
    inst = addStep(inst, { x: 400, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { handleOut: { x: 100, y: 200 } });
    inst = recomputeStepTimes(inst, u);
    const early = computeInstancePreview(inst, u, inst.steps[1].time * 0.25);
    expect(early?.pos.y).toBeGreaterThan(0); // pulled up off the straight line toward the handle
  });

  it("resolves the correct (later) step, not just the first, including its own visible flag", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 0, y: 0 });
    inst = addStep(inst, { x: 50, y: 50 });
    inst = updateStep(inst, inst.steps[1].id, { visible: false });
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, inst.steps[1].time);
    expect(preview?.step.id).toBe(inst.steps[1].id);
    expect(preview?.step.visible).toBe(false);
    expect(preview?.pos).toEqual({ x: 50, y: 50 });
  });

  it("speedMultiplier makes the segment complete in less wall-clock time (position at the derived arrival time is exact regardless of multiplier)", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { speedMultiplier: 2 });
    inst = addStep(inst, { x: 400, y: 0 });
    inst = recomputeStepTimes(inst, u);
    expect(inst.steps[1].time).toBeCloseTo(2); // 400px @ 200px/s effective
    const preview = computeInstancePreview(inst, u, 1); // halfway through the 2s duration
    expect(preview?.pos.x).toBeCloseTo(200);
  });
});
