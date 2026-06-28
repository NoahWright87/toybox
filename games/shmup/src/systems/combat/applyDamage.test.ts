import { describe, it, expect } from "vitest";
import { applyDamage, tickShieldRegen } from "./applyDamage";
import { TUNING } from "../../tuning";
import type { Defender } from "./types";

function defender(overrides: Partial<Defender> = {}): Defender {
  return { hp: 100, shield: 0, shieldRegenDelayRemaining: 0, ...overrides };
}

describe("applyDamage", () => {
  it("a dodge (roll below evasion) deals zero damage and doesn't touch hp/shield", () => {
    const d = defender({ hp: 50, shield: 20 });
    const result = applyDamage(d, 30, 0, 0.5, () => 0.1);
    expect(result.dodged).toBe(true);
    expect(result.shieldDamage).toBe(0);
    expect(result.hpDamage).toBe(0);
    expect(d.hp).toBe(50);
    expect(d.shield).toBe(20);
  });

  it("shield absorbs at full value, ignoring armor, before HP is touched", () => {
    const d = defender({ hp: 100, shield: 20 });
    const result = applyDamage(d, 30, 0.9, 0, () => 0.99);
    expect(result.dodged).toBe(false);
    expect(result.shieldDamage).toBe(20);
    expect(d.shield).toBe(0);
    // overflow = 10, armor 0.9 mitigates it down to 1
    expect(result.hpDamage).toBeCloseTo(1, 10);
    expect(d.hp).toBeCloseTo(99, 10);
  });

  it("armor only mitigates the overflow past shield, never the shielded portion", () => {
    const d = defender({ hp: 100, shield: 100 });
    const result = applyDamage(d, 30, 0.9, 0, () => 0.99);
    expect(result.shieldDamage).toBe(30);
    expect(result.hpDamage).toBe(0);
    expect(d.hp).toBe(100);
  });

  it("with no shield, armor mitigates the full hit", () => {
    const d = defender({ hp: 100, shield: 0 });
    const result = applyDamage(d, 50, 0.5, 0, () => 0.99);
    expect(result.shieldDamage).toBe(0);
    expect(result.hpDamage).toBeCloseTo(25, 10);
    expect(d.hp).toBeCloseTo(75, 10);
  });

  it("hp is floored at 0 and marks defeated", () => {
    const d = defender({ hp: 10, shield: 0 });
    const result = applyDamage(d, 1000, 0, 0, () => 0.99);
    expect(d.hp).toBe(0);
    expect(result.defeated).toBe(true);
  });

  it("a non-dodged hit resets the shield regen delay", () => {
    const d = defender({ hp: 100, shield: 50, shieldRegenDelayRemaining: 0 });
    applyDamage(d, 10, 0, 0, () => 0.99);
    expect(d.shieldRegenDelayRemaining).toBe(TUNING.combat.shieldRegenDelay);
  });
});

describe("tickShieldRegen", () => {
  it("does not regen while the delay is still counting down", () => {
    const d = defender({ shield: 0, shieldRegenDelayRemaining: 2 });
    tickShieldRegen(d, 100, 1);
    expect(d.shield).toBe(0);
    expect(d.shieldRegenDelayRemaining).toBe(1);
  });

  it("regens as a fraction of maxShield/s once the delay elapses", () => {
    const d = defender({ shield: 0, shieldRegenDelayRemaining: 0 });
    tickShieldRegen(d, 100, 1);
    expect(d.shield).toBeCloseTo(100 * TUNING.combat.shieldRegenFracPerSecond, 10);
  });

  it("never regens past maxShield", () => {
    const d = defender({ shield: 95, shieldRegenDelayRemaining: 0 });
    tickShieldRegen(d, 100, 10);
    expect(d.shield).toBe(100);
  });
});
