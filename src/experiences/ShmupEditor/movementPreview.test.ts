import { describe, it, expect } from "vitest";
import { addStep, updateStep } from "./encounterSteps";
import { recomputeStepTimes } from "./encounterTiming";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { computeInstanceHeadingDeg, computeInstancePreview } from "./movementPreview";
import { createBlankAction, createBlankUnit, type ActionDef, type UnitDef } from "./unitTypes";

function unit(overrides: Partial<UnitDef> = {}): UnitDef {
  return { ...createBlankUnit(0), ...overrides };
}

function action(overrides: Partial<ActionDef> = {}): ActionDef {
  return { ...createBlankAction(0), ...overrides };
}

describe("computeInstancePreview", () => {
  it("returns null before the instance has spawned", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { time: 5 });
    expect(computeInstancePreview(inst, u, 0)).toBeNull();
  });

  it("returns null when the unit def is missing", () => {
    let inst: EncounterUnit = createEncounterUnit("missing");
    inst = addStep(inst, null, { x: 0, y: 0 });
    expect(computeInstancePreview(inst, undefined, 0)).toBeNull();
  });

  it("a dwelling step (same position as predecessor) holds in place", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 10, y: 20 });
    inst = addStep(inst, null, { x: 10, y: 20 });
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, 100);
    expect(preview?.pos).toEqual({ x: 10, y: 20 });
  });

  it("a lone step with no next waypoint holds at its own position", () => {
    const u = unit({ speed: 300 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 5, y: 5 });
    inst = recomputeStepTimes(inst, u);
    const soonAfter = computeInstancePreview(inst, u, 0.5);
    const wayPast = computeInstancePreview(inst, u, 500);
    expect(soonAfter?.pos).toEqual({ x: 5, y: 5 });
    expect(wayPast?.pos).toEqual({ x: 5, y: 5 });
  });

  it("the last step holds at its own position instead of continuing motion", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 100, y: 0 });
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, inst.steps[1].time + 5);
    expect(preview?.pos).toEqual({ x: 100, y: 0 });
  });

  it("moves along a straight-line-equivalent curve (null handles) at the midpoint", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    inst = recomputeStepTimes(inst, u); // duration = 4s
    const preview = computeInstancePreview(inst, u, 2); // halfway through time
    expect(preview?.pos.x).toBeCloseTo(200);
    expect(preview?.pos.y).toBeCloseTo(0);
  });

  it("arrives essentially exactly at the destination when u reaches 1", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 300 });
    inst = updateStep(inst, inst.steps[0].id, { handleOut: { x: 50, y: 200 } }); // a real curve, not a straight line
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, inst.steps[1].time);
    expect(preview?.pos.x).toBeCloseTo(400, 0);
    expect(preview?.pos.y).toBeCloseTo(300, 0);
  });

  it("bulges off the straight line when a handle is set", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    inst = updateStep(inst, inst.steps[0].id, { handleOut: { x: 100, y: 200 } });
    inst = recomputeStepTimes(inst, u);
    const early = computeInstancePreview(inst, u, inst.steps[1].time * 0.25);
    expect(early?.pos.y).toBeGreaterThan(0); // pulled up off the straight line toward the handle
  });

  it("resolves the correct (later) step, not just the first", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 50, y: 50 });
    inst = recomputeStepTimes(inst, u);
    const preview = computeInstancePreview(inst, u, inst.steps[1].time);
    expect(preview?.step.id).toBe(inst.steps[1].id);
    expect(preview?.pos).toEqual({ x: 50, y: 50 });
  });

  it("derives invincible from the referenced Action's setsInvincible, carrying forward through a later null", () => {
    const goInvincible = action({ setsInvincible: true });
    const noChange = action({ setsInvincible: null });
    const u = unit({ actions: [goInvincible, noChange] });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, goInvincible.id, { x: 0, y: 0 });
    inst = addStep(inst, noChange.id, { x: 0, y: 0 }); // dwelling — same position
    inst = recomputeStepTimes(inst, u);
    expect(computeInstancePreview(inst, u, 0)?.invincible).toBe(true);
    expect(computeInstancePreview(inst, u, inst.steps[1].time)?.invincible).toBe(true); // null carries the prior true forward
  });

  it("defaults to not invincible (false) before any Action sets it", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    expect(computeInstancePreview(inst, u, 0)?.invincible).toBe(false);
  });

  it("movementPercent scaling still resolves via the referenced Action (position at the derived arrival time is exact regardless of Movement %)", () => {
    const halfSpeed = action({ movementPercent: 50 });
    const u = unit({ speed: 100, actions: [halfSpeed] });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, halfSpeed.id, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    inst = recomputeStepTimes(inst, u);
    expect(inst.steps[1].time).toBeCloseTo(8); // 400px @ 50px/s effective
    const preview = computeInstancePreview(inst, u, 4); // halfway through the 8s duration
    expect(preview?.pos.x).toBeCloseTo(200);
  });
});

describe("computeInstanceHeadingDeg", () => {
  it("points along the direction of travel (0deg = +x/right)", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 400, y: 0 });
    inst = recomputeStepTimes(inst, u);
    expect(computeInstanceHeadingDeg(inst, u, 2)).toBeCloseTo(0, 0);
  });

  it("points downward (90deg) when moving straight down", () => {
    const u = unit({ speed: 100 });
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 0, y: 0 });
    inst = addStep(inst, null, { x: 0, y: 400 });
    inst = recomputeStepTimes(inst, u);
    expect(computeInstanceHeadingDeg(inst, u, 2)).toBeCloseTo(90, 0);
  });

  it("falls back to the stationary default while dwelling", () => {
    const u = unit();
    let inst: EncounterUnit = createEncounterUnit(u.id);
    inst = addStep(inst, null, { x: 10, y: 10 });
    inst = addStep(inst, null, { x: 10, y: 10 });
    inst = recomputeStepTimes(inst, u);
    expect(computeInstanceHeadingDeg(inst, u, 100)).toBe(90);
  });
});
