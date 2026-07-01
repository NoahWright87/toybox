import { describe, it, expect } from "vitest";
import { advanceDeadline, mapLagFor } from "./deadline";
import { TUNING } from "../../tuning";

describe("advanceDeadline", () => {
  it("advances by deadlineAdvancePerNode at 0 Player Speed", () => {
    expect(advanceDeadline(0, 0)).toBeCloseTo(TUNING.map.deadlineAdvancePerNode, 10);
  });

  it("higher Player Speed reduces the advance (buys slack)", () => {
    const slow = advanceDeadline(0, 100) - 0;
    const fast = advanceDeadline(0, 1000) - 0;
    expect(fast).toBeLessThan(slow);
  });

  it("never advances below deadlineMinAdvance regardless of Player Speed", () => {
    expect(advanceDeadline(0, 1_000_000) - 0).toBeCloseTo(TUNING.map.deadlineMinAdvance, 10);
  });
});

describe("mapLagFor", () => {
  it("is 0 while the deadline hasn't passed the player's column", () => {
    expect(mapLagFor(2, 5)).toBe(0);
    expect(mapLagFor(5, 5)).toBe(0);
  });

  it("is the difference once the deadline has passed the player", () => {
    expect(mapLagFor(8, 5)).toBe(3);
  });
});
