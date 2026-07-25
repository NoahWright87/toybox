import { describe, expect, it } from "vitest";
import { activeStepIndexAt, instanceHeadingDegAt, instanceStateAt, invincibleAt, lastAuthoredTime, resolveFacingDeg } from "./movement";
import type { AuthoredAction, AuthoredStep } from "./authoredTypes";

function step(id: string, x: number, y: number, time: number, actionId: string | null = null): AuthoredStep {
  return { id, pos: { x, y }, time, actionId, handleIn: null, handleOut: null };
}

function action(overrides: Partial<AuthoredAction> = {}): AuthoredAction {
  return {
    id: "a1",
    name: "Action",
    movementPercent: 100,
    facing: "fixed",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: null,
    ...overrides,
  };
}

describe("activeStepIndexAt", () => {
  const steps = [step("s0", 0, 0, 0), step("s1", 100, 0, 2), step("s2", 200, 0, 4)];

  it("reports 'not spawned yet' before the first step", () => {
    expect(activeStepIndexAt(steps, -0.5)).toBe(-1);
  });

  it("holds the last step once past the end", () => {
    expect(activeStepIndexAt(steps, 99)).toBe(2);
  });

  it("picks the latest step whose time has passed", () => {
    expect(activeStepIndexAt(steps, 2)).toBe(1);
    expect(activeStepIndexAt(steps, 3.9)).toBe(1);
  });
});

describe("instanceStateAt", () => {
  const steps = [step("s0", 0, 0, 0), step("s1", 120, 0, 2)];

  it("returns nothing before the instance spawns", () => {
    expect(instanceStateAt(steps, 1, -1)).toBeNull();
  });

  it("lands exactly on the destination at the end of the segment", () => {
    const state = instanceStateAt(steps, 1, 2);
    expect(state?.pos.x).toBeCloseTo(120, 6);
  });

  it("interpolates the curve in between", () => {
    const state = instanceStateAt(steps, 1, 1);
    expect(state?.pos.x).toBeGreaterThan(0);
    expect(state?.pos.x).toBeLessThan(120);
  });

  it("holds in place at a terminal step rather than continuing past its last waypoint", () => {
    const a = instanceStateAt(steps, 1, 5);
    const b = instanceStateAt(steps, 1, 50);
    expect(a?.pos).toEqual(b?.pos);
    expect(a?.pos.x).toBeCloseTo(120, 6);
  });

  it("holds in place while dwelling (a step at its predecessor's position)", () => {
    const dwell = [step("s0", 50, 50, 0), step("s1", 50, 50, 3)];
    expect(instanceStateAt(dwell, 1, 1.5)?.pos).toEqual({ x: 50, y: 50 });
  });
});

describe("instanceHeadingDegAt", () => {
  it("reads the direction of travel off the curve", () => {
    const steps = [step("s0", 0, 0, 0), step("s1", 0, 100, 2)];
    expect(instanceHeadingDegAt(steps, 1, 1)).toBeCloseTo(90, 1); // due south
  });

  it("falls back to a fixed stand-in when there is no travel to read", () => {
    const dwell = [step("s0", 10, 10, 0), step("s1", 10, 10, 2)];
    expect(instanceHeadingDegAt(dwell, 1, 1)).toBe(90);
  });
});

describe("invincibleAt", () => {
  const actions = [
    action({ id: "shield", setsInvincible: true }),
    action({ id: "drop", setsInvincible: false }),
    action({ id: "neutral", setsInvincible: null }),
  ];

  it("starts vulnerable", () => {
    expect(invincibleAt([step("s0", 0, 0, 0, "neutral")], actions, 0)).toBe(false);
  });

  it("carries the previous value forward through a null-setting Action", () => {
    const steps = [step("s0", 0, 0, 0, "shield"), step("s1", 0, 0, 1, "neutral")];
    expect(invincibleAt(steps, actions, 1.5)).toBe(true);
  });

  it("clears once an Action explicitly sets it false", () => {
    const steps = [step("s0", 0, 0, 0, "shield"), step("s1", 0, 0, 1, "drop")];
    expect(invincibleAt(steps, actions, 1.5)).toBe(false);
  });

  it("ignores placements that haven't happened yet", () => {
    const steps = [step("s0", 0, 0, 0, "neutral"), step("s1", 0, 0, 5, "shield")];
    expect(invincibleAt(steps, actions, 1)).toBe(false);
  });
});

describe("resolveFacingDeg", () => {
  it("uses the authored angle when fixed", () => {
    expect(resolveFacingDeg(action({ facing: "fixed", fixedFacingDeg: 42 }), { x: 0, y: 0 }, { x: 0, y: 100 }, 7)).toBe(42);
  });

  it("uses the direction of travel when facing movement", () => {
    expect(resolveFacingDeg(action({ facing: "faceMovement" }), { x: 0, y: 0 }, { x: 0, y: 100 }, 7)).toBe(7);
  });

  it("points at the player when facing the player", () => {
    expect(resolveFacingDeg(action({ facing: "facePlayer" }), { x: 0, y: 0 }, { x: 100, y: 0 }, 7)).toBeCloseTo(0, 6);
    expect(resolveFacingDeg(action({ facing: "facePlayer" }), { x: 0, y: 0 }, { x: 0, y: 100 }, 7)).toBeCloseTo(90, 6);
  });
});

describe("lastAuthoredTime", () => {
  it("takes the latest moment across both a unit's steps and its Part tracks", () => {
    const steps = [step("s0", 0, 0, 0), step("s1", 10, 0, 4)];
    expect(lastAuthoredTime(steps, [{ time: 9, actionId: "x" }])).toBe(9);
    expect(lastAuthoredTime(steps, [])).toBe(4);
  });
});
