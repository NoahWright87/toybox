import { describe, it, expect } from "vitest";
import { rollCrit, resolveHit } from "./resolveHit";

interface CritCase {
  name: string;
  given: { critChance: number; critDamage: number; roll: number };
  then: { numCrits: number; critFactor: number };
}

const CRIT_CASES: CritCase[] = [
  {
    name: "below 100% chance with a high roll never crits",
    given: { critChance: 0.5, critDamage: 0.5, roll: 0.9 },
    then: { numCrits: 0, critFactor: 1 },
  },
  {
    name: "below 100% chance with a low roll crits once",
    given: { critChance: 0.5, critDamage: 0.5, roll: 0.1 },
    then: { numCrits: 1, critFactor: 1.5 },
  },
  {
    name: "100% chance is a guaranteed single crit",
    given: { critChance: 1, critDamage: 1, roll: 0.99 },
    then: { numCrits: 1, critFactor: 2 },
  },
  {
    name: "250% chance guarantees 2 crits, +50% chance of a 3rd (low roll hits the 3rd)",
    given: { critChance: 2.5, critDamage: 1, roll: 0.1 },
    then: { numCrits: 3, critFactor: 8 },
  },
  {
    name: "250% chance guarantees 2 crits, the 3rd is NOT guaranteed (high roll misses it)",
    given: { critChance: 2.5, critDamage: 1, roll: 0.9 },
    then: { numCrits: 2, critFactor: 4 },
  },
];

describe("rollCrit", () => {
  it.each(CRIT_CASES)("$name", ({ given, then }) => {
    const result = rollCrit(given.critChance, given.critDamage, () => given.roll);
    expect(result.numCrits).toBe(then.numCrits);
    expect(result.critFactor).toBeCloseTo(then.critFactor, 10);
  });
});

describe("resolveHit", () => {
  it("multiplies stats.damage by the crit factor", () => {
    const hit = resolveHit({ damage: 10, critChance: 1, critDamage: 1 }, () => 0.5);
    expect(hit).toBeCloseTo(20, 10);
  });

  it("a guaranteed-zero crit chance returns exactly stats.damage", () => {
    const hit = resolveHit({ damage: 7, critChance: 0, critDamage: 5 }, () => 0.5);
    expect(hit).toBeCloseTo(7, 10);
  });
});
