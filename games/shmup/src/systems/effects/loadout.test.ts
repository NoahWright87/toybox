import { describe, it, expect } from "vitest";
import { resolveLoadout } from "./loadout";
import { MAX_WEAPON_SLOTS } from "./slots";
import { STAT_DEFS } from "../stats";
import type { LoadoutInput } from "./loadout";
import type { ItemDef, OwnedWeapon, WeaponDef } from "./types";

const FORKING_GUN: WeaponDef = {
  id: "forking-gun",
  name: "Forking Gun",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 500,
  scalesWith: ["damage", "fork"],
  mods: [
    { base: { kind: "flat", stat: "damage", amount: 2 }, perLevel: 1 },
    { base: { kind: "flat", stat: "fork", amount: 1 }, perLevel: 0 },
  ],
};

const RAILGUN: WeaponDef = {
  id: "railgun",
  name: "Railgun",
  firingArc: "forward",
  targetType: "ground",
  projectileSpeed: 900,
  scalesWith: ["damage", "pierce"],
  mods: [{ base: { kind: "flat", stat: "pierce", amount: 3 }, perLevel: 0 }],
};

const PIERCE_ITEM: ItemDef = {
  id: "tunneling-rounds",
  name: "Tunneling Rounds",
  mods: [{ kind: "flat", stat: "pierce", amount: 0.5 }],
  scalesWith: ["pierce"],
};

interface Case {
  name: string;
  given: LoadoutInput;
  then: {
    maxHp?: number;
    damage?: number;
    fork?: number;
    pierce?: number;
    hitFractions?: number[];
  };
}

const CASES: Case[] = [
  {
    name: "combines chassis base/mods, items, and weapon tiers into one StatBlock",
    given: {
      chassisBase: { maxHp: 150 },
      chassisMods: [{ kind: "flat", stat: "damage", amount: 1 }],
      items: [{ item: PIERCE_ITEM, count: 2 }],
      weapons: [{ weapon: FORKING_GUN, tier: 2 }],
    },
    then: {
      maxHp: 150,
      // damage: base + chassis flat(1) + weapon flat(2 + perLevel*tier = 2) = base + 3
      damage: STAT_DEFS.damage.base + 1 + (2 + 1 * 2),
      // fork: weapon flat 1 (no perLevel growth)
      fork: 1,
      // pierce: item flat 0.5 stacked twice (no maxStacks) = 1.0
      pierce: 1.0,
    },
  },
  {
    name: "derives projectile behavior from the same resolved stats (fork=1 -> 2 guaranteed-hit copies)",
    given: { weapons: [{ weapon: FORKING_GUN, tier: 0 }] },
    then: { fork: 1, hitFractions: [1, 1] },
  },
  {
    name: "a brand-new weapon needs no engine changes — pure data addition",
    given: { weapons: [{ weapon: RAILGUN, tier: 0 }] },
    then: { hitFractions: [1, 1, 1, 1] },
  },
];

describe("resolveLoadout — single resolution path", () => {
  it.each(CASES)("$name", ({ given, then }) => {
    const { stats, projectileBehavior } = resolveLoadout(given);
    if (then.maxHp !== undefined) expect(stats.maxHp).toBe(then.maxHp);
    if (then.damage !== undefined) expect(stats.damage).toBeCloseTo(then.damage, 10);
    if (then.fork !== undefined) expect(stats.fork).toBe(then.fork);
    if (then.pierce !== undefined) expect(stats.pierce).toBeCloseTo(then.pierce, 10);
    if (then.hitFractions !== undefined) {
      expect(projectileBehavior.hitFractions).toEqual(then.hitFractions);
    }
  });

  it("layers transient mods on top without mutating the persistent baseline", () => {
    const grazing = resolveLoadout({
      items: [{ item: PIERCE_ITEM, count: 1 }],
      transientMods: [{ kind: "percent", stat: "pierce", category: "grazing", amount: 1 }],
    });
    const baseline = resolveLoadout({ items: [{ item: PIERCE_ITEM, count: 1 }] });
    expect(baseline.stats.pierce).toBeCloseTo(0.5, 10);
    expect(grazing.stats.pierce).toBeCloseTo(1.0, 10);
  });
});

interface SlotCase {
  name: string;
  given: { weaponCount: number };
  then: { throws: boolean };
}

const SLOT_CASES: SlotCase[] = [
  {
    name: "accepts exactly the slot cap",
    given: { weaponCount: MAX_WEAPON_SLOTS },
    then: { throws: false },
  },
  {
    name: "rejects more weapons than the chassis has slots",
    given: { weaponCount: MAX_WEAPON_SLOTS + 1 },
    then: { throws: true },
  },
];

function ownedSlots(count: number): OwnedWeapon[] {
  return Array.from({ length: count }, () => ({ weapon: FORKING_GUN, tier: 0 }));
}

describe("resolveLoadout — 6 weapon-slot cap", () => {
  it.each(SLOT_CASES)("$name", ({ given, then }) => {
    const attempt = () => resolveLoadout({ weapons: ownedSlots(given.weaponCount) });
    if (then.throws) {
      expect(attempt).toThrow();
    } else {
      expect(attempt).not.toThrow();
    }
  });
});
