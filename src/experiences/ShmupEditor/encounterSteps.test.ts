import { describe, it, expect } from "vitest";
import { addStep, deleteStepsFrom, isFirstStep, isLastStep, moveStep, updateStep } from "./encounterSteps";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";

function instance(): EncounterUnit {
  return createEncounterUnit("unit-test");
}

describe("addStep", () => {
  it("adds a single step to a blank instance", () => {
    const e = addStep(instance(), "action-idle", { x: 5, y: 5 });
    expect(e.steps).toHaveLength(1);
    expect(e.steps[0].actionId).toBe("action-idle");
    expect(e.steps[0].pos).toEqual({ x: 5, y: 5 });
  });

  it("defaults a step's position to an offset from the previous step", () => {
    let e = addStep(instance(), "a", { x: 10, y: 20 });
    e = addStep(e, "b");
    expect(e.steps).toHaveLength(2);
    expect(e.steps[1].pos).not.toEqual(e.steps[0].pos);
  });

  it("defaults the first step's position to origin when none is given", () => {
    const e = addStep(instance(), "a");
    expect(e.steps[0].pos).toEqual({ x: 0, y: 0 });
  });

  it("gives every new step a default 'always' trigger and no overrides", () => {
    const e = addStep(instance(), "a");
    expect(e.steps[0].trigger).toEqual({ kind: "always", value: 0 });
    expect(e.steps[0].aimAngleOverride).toBeNull();
    expect(e.steps[0].speedMultiplier).toBe(1);
  });
});

describe("isFirstStep / isLastStep", () => {
  it("identifies first and last across a 3-step chain", () => {
    let e = addStep(instance(), "a");
    e = addStep(e, "b");
    e = addStep(e, "c");
    expect(isFirstStep(e, e.steps[0].id)).toBe(true);
    expect(isFirstStep(e, e.steps[1].id)).toBe(false);
    expect(isLastStep(e, e.steps[2].id)).toBe(true);
    expect(isLastStep(e, e.steps[1].id)).toBe(false);
  });

  it("treats a lone step as both first and last", () => {
    const e = addStep(instance(), "a");
    expect(isFirstStep(e, e.steps[0].id)).toBe(true);
    expect(isLastStep(e, e.steps[0].id)).toBe(true);
  });
});

describe("deleteStepsFrom", () => {
  it("deleting a middle step removes it and everything after it", () => {
    let e = addStep(instance(), "a");
    e = addStep(e, "b");
    e = addStep(e, "c");
    const [first, second] = e.steps;
    const after = deleteStepsFrom(e, second.id);
    expect(after.steps.map((s) => s.id)).toEqual([first.id]);
  });

  it("deleting the first step empties the instance", () => {
    let e = addStep(instance(), "a");
    e = addStep(e, "b");
    const after = deleteStepsFrom(e, e.steps[0].id);
    expect(after.steps).toEqual([]);
  });

  it("is a no-op for a nonexistent step id", () => {
    const e = addStep(instance(), "a");
    expect(deleteStepsFrom(e, "nope")).toBe(e);
  });
});

describe("moveStep / updateStep", () => {
  it("moveStep updates only the target step's position", () => {
    let e = addStep(instance(), "a", { x: 0, y: 0 });
    e = addStep(e, "b");
    const moved = moveStep(e, e.steps[0].id, { x: 42, y: 7 });
    expect(moved.steps[0].pos).toEqual({ x: 42, y: 7 });
    expect(moved.steps[1].pos).toEqual(e.steps[1].pos);
  });

  it("updateStep patches arbitrary fields on the target step only", () => {
    let e = addStep(instance(), "a");
    e = addStep(e, "b");
    const updated = updateStep(e, e.steps[1].id, { actionId: "c", speedMultiplier: 0.5 });
    expect(updated.steps[1].actionId).toBe("c");
    expect(updated.steps[1].speedMultiplier).toBe(0.5);
    expect(updated.steps[0].actionId).toBe("a");
  });
});
