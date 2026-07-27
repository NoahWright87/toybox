import { describe, it, expect } from "vitest";
import { polarityDamageMultiplier, absorbsBullet } from "./polarity";
import type { ChassisPolarityDef } from "../chassis";

const IKARUGA_POLARITY: ChassisPolarityDef = {
  initial: "red",
  damageMultiplierSame: 0,
  damageMultiplierOpposite: 1,
  absorbHypeBase: 10,
};

describe("polarityDamageMultiplier", () => {
  it("returns 1 (no gating) when the chassis has no polarity mechanic", () => {
    expect(polarityDamageMultiplier(undefined, "red", "red")).toBe(1);
    expect(polarityDamageMultiplier(undefined, "red", "blue")).toBe(1);
  });

  it("returns 1 when the shot itself carries no polarity, even with a polarity chassis equipped", () => {
    expect(polarityDamageMultiplier(IKARUGA_POLARITY, null, "red")).toBe(1);
  });

  it("applies damageMultiplierSame against a same-polarity target", () => {
    expect(polarityDamageMultiplier(IKARUGA_POLARITY, "red", "red")).toBe(0);
  });

  it("applies damageMultiplierOpposite against an opposite-polarity target", () => {
    expect(polarityDamageMultiplier(IKARUGA_POLARITY, "red", "blue")).toBe(1);
  });
});

describe("absorbsBullet", () => {
  it("never absorbs when the chassis has no polarity mechanic", () => {
    expect(absorbsBullet(undefined, "red", "red")).toBe(false);
  });

  it("absorbs a same-polarity bullet", () => {
    expect(absorbsBullet(IKARUGA_POLARITY, "red", "red")).toBe(true);
  });

  it("does not absorb an opposite-polarity bullet", () => {
    expect(absorbsBullet(IKARUGA_POLARITY, "red", "blue")).toBe(false);
  });
});
