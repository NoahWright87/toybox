import { describe, it, expect } from "vitest";
import { formatModifierAmount, formatStatValue } from "./format";
import { STAT_DEFS } from "./statDefs";
import type { StatModifier } from "./types";

describe("formatStatValue", () => {
  it("formats percent/multiplier/px/flat units", () => {
    expect(formatStatValue(STAT_DEFS.evasion, 0.25)).toBe("25%");
    expect(formatStatValue(STAT_DEFS.damage, 1.5)).toBe("1.50×");
    expect(formatStatValue(STAT_DEFS.magnetRadius, 60)).toBe("60px");
    expect(formatStatValue(STAT_DEFS.maxHp, 100)).toBe("100");
    expect(formatStatValue(STAT_DEFS.hpRegen, 2.5)).toBe("2.5");
  });
});

describe("formatModifierAmount", () => {
  interface Case {
    name: string;
    mod: StatModifier;
    expected: string;
  }

  const CASES: Case[] = [
    {
      name: "a percent-kind modifier is always shown as a percentage, even on a multiplier-unit stat",
      mod: { kind: "percent", stat: "attackSpeed", amount: 0.15 },
      expected: "15%",
    },
    {
      name: "a flat modifier on a multiplier-unit stat (base 1) is a plain unitless number, not a x value",
      mod: { kind: "flat", stat: "damage", amount: 4 },
      expected: "4",
    },
    {
      name: "a flat modifier on a non-hyperbolic percent-unit stat (base already 0-1) reads as percentage points",
      mod: { kind: "flat", stat: "creditScore", amount: 0.05 },
      expected: "5%",
    },
    {
      name: "a flat modifier on a flat-unit stat is a plain number",
      mod: { kind: "flat", stat: "maxHp", amount: 15 },
      expected: "15",
    },
    {
      name: "a flat modifier on a px-unit stat keeps the px suffix",
      mod: { kind: "flat", stat: "playerSpeed", amount: 20 },
      expected: "20px",
    },
    {
      name: "a flat modifier on a hyperbolic stat (Armor) is a plain number, NOT scaled by 100 (raw isn't a 0-1 fraction)",
      mod: { kind: "flat", stat: "armor", amount: 8 },
      expected: "8",
    },
    {
      name: "a flat modifier on a hyperbolic stat (Evasion) is a plain number too",
      mod: { kind: "flat", stat: "evasion", amount: 0.06 },
      expected: "0.06",
    },
  ];

  it.each(CASES)("$name", ({ mod, expected }) => {
    expect(formatModifierAmount(mod)).toBe(expected);
  });
});
