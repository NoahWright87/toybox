import { describe, it, expect } from "vitest";
import { reflexBulletSpeedMult, reflexMoveSpeedMult } from "./reflexes";
import { TUNING } from "../../tuning";

describe("reflexBulletSpeedMult / reflexMoveSpeedMult", () => {
  it("zero reflexes leaves speed untouched", () => {
    expect(reflexBulletSpeedMult(0)).toBe(1);
    expect(reflexMoveSpeedMult(0)).toBe(1);
  });

  it("approaches but never reaches the bullet slow cap as reflexes grows", () => {
    const mult = reflexBulletSpeedMult(1_000_000);
    expect(mult).toBeGreaterThan(1 - TUNING.combat.reflexBulletSlowCap);
    expect(mult).toBeCloseTo(1 - TUNING.combat.reflexBulletSlowCap, 3);
  });

  it("approaches but never reaches the move slow cap as reflexes grows", () => {
    const mult = reflexMoveSpeedMult(1_000_000);
    expect(mult).toBeGreaterThan(1 - TUNING.combat.reflexMoveSlowCap);
    expect(mult).toBeCloseTo(1 - TUNING.combat.reflexMoveSlowCap, 3);
  });

  it("the two channels use independent K constants and so can diverge", () => {
    const reflexes = TUNING.combat.reflexMoveK;
    // At reflexes == reflexMoveK, the move channel is at half its cap.
    expect(reflexMoveSpeedMult(reflexes)).toBeCloseTo(1 - TUNING.combat.reflexMoveSlowCap / 2, 10);
  });
});
