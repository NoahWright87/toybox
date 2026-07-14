import { describe, it, expect } from "vitest";
import { activeStepAt, addStep, deleteStepsFrom, isFirstStep, isLastStep, moveStep, updateStep } from "./encounterSteps";
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

  it("defaults the first step's time to 0 and no overrides", () => {
    const e = addStep(instance(), "a");
    expect(e.steps[0].time).toBe(0);
    expect(e.steps[0].speedMultiplier).toBe(1);
  });

  it("defaults each new step's time to after the previous step", () => {
    let e = addStep(instance(), "a");
    e = addStep(e, "b");
    e = addStep(e, "c");
    expect(e.steps[1].time).toBeGreaterThan(e.steps[0].time);
    expect(e.steps[2].time).toBeGreaterThan(e.steps[1].time);
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

  it("updateStep clamps a negative time to 0", () => {
    const e = addStep(instance(), "a");
    const updated = updateStep(e, e.steps[0].id, { time: -5 });
    expect(updated.steps[0].time).toBe(0);
  });

  it("updateStep does not reorder the array — array index order is the authorial order", () => {
    let e = addStep(instance(), "a"); // time 0
    e = addStep(e, "b"); // time 2
    e = addStep(e, "c"); // time 4
    const retimed = updateStep(e, e.steps[2].id, { time: 1 });
    expect(retimed.steps.map((s) => s.actionId)).toEqual(["a", "b", "c"]);
    expect(retimed.steps[2].time).toBe(1);
  });
});

describe("activeStepAt", () => {
  it("returns null before the instance's first step", () => {
    const e = addStep(instance(), "a"); // time 0
    expect(activeStepAt(e, -1)).toBeNull();
  });

  it("returns null for an instance with no steps", () => {
    expect(activeStepAt(instance(), 0)).toBeNull();
  });

  it("returns the latest step whose time has been reached", () => {
    let e = addStep(instance(), "a"); // time 0
    e = addStep(e, "b"); // time 2
    e = addStep(e, "c"); // time 4
    expect(activeStepAt(e, 0)?.actionId).toBe("a");
    expect(activeStepAt(e, 1.9)?.actionId).toBe("a");
    expect(activeStepAt(e, 2)?.actionId).toBe("b");
    expect(activeStepAt(e, 100)?.actionId).toBe("c");
  });
});
