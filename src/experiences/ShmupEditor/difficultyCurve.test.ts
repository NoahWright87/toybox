import { describe, it, expect } from "vitest";
import { resolveCurve, type CurveDef } from "./difficultyCurve";

function curve(patch: Partial<CurveDef>): CurveDef {
  return { type: "flat", base: 0, rate: 0, cap: 0, thresholds: [], ...patch };
}

describe("resolveCurve", () => {
  it("flat ignores budget entirely", () => {
    const c = curve({ type: "flat", base: 5 });
    expect(resolveCurve(c, 0)).toBe(5);
    expect(resolveCurve(c, 100)).toBe(5);
  });

  it("linear scales base + rate * budget", () => {
    const c = curve({ type: "linear", base: 2, rate: 0.5 });
    expect(resolveCurve(c, 0)).toBe(2);
    expect(resolveCurve(c, 10)).toBe(7);
  });

  it("capped is linear up to a max, then flat", () => {
    const c = curve({ type: "capped", base: 1, rate: 1, cap: 5 });
    expect(resolveCurve(c, 0)).toBe(1);
    expect(resolveCurve(c, 3)).toBe(4);
    expect(resolveCurve(c, 10)).toBe(5);
  });

  it("stepped jumps at defined thresholds", () => {
    const c = curve({
      type: "stepped",
      base: 1,
      thresholds: [
        { budget: 50, value: 3 },
        { budget: 20, value: 2 },
      ],
    });
    expect(resolveCurve(c, 0)).toBe(1);
    expect(resolveCurve(c, 19)).toBe(1);
    expect(resolveCurve(c, 20)).toBe(2);
    expect(resolveCurve(c, 49)).toBe(2);
    expect(resolveCurve(c, 50)).toBe(3);
    expect(resolveCurve(c, 1000)).toBe(3);
  });

  it("stepped with no thresholds always returns base", () => {
    const c = curve({ type: "stepped", base: 7 });
    expect(resolveCurve(c, 500)).toBe(7);
  });
});
