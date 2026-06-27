import { describe, it, expect } from "vitest";
import { resolveLoadout } from "./loadout";
import { MAX_WEAPON_SLOTS } from "./slots";
import { STAT_DEFS } from "../stats";
import type { LoadoutInput } from "./loadout";
import type { ItemDef, OwnedWeapon, WeaponDef } from "./types";

const TUNNELER: WeaponDef = {
  id: "tunneler",
  name: "Tunneler",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 500,
  scalesWith: ["damage", "pierce"],
  mods: [
    { base: { kind: "flat", stat: "damage", amount: 2 }, perLevel: 1 },
    { base: { kind: "flat", stat: "pierce", amount: 1.5 }, perLevel: 0 },
  ],
  // No pierceDecay authored — falls back to TUNING.weapons.defaultPierceDecay.
};

const FLAK_CANNON: WeaponDef = {
  id: "flak-cannon",
  name: "Flak Cannon",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 400,
  scalesWith: ["damage", "pierce"],
  mods: [{ base: { kind: "flat", stat: "damage", amount: 1 }, perLevel: 1 }],
  // High pierceDecay leans into forking off the shared pierce pool.
  pierceDecay: 0.9,
};

const RAILGUN: WeaponDef = {
  id: "railgun",
  name: "Railgun",
  firingArc: "forward",
  targetType: "ground",
  projectileSpeed: 900,
  scalesWith: ["damage", "pierce"],
  mods: [{ base: { kind: "flat", stat: "pierce", amount: 1.5 }, perLevel: 0 }],
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
    pierce?: number;
    behaviorCount?: number;
    behaviorFlatLineCounts?: number[];
    firstBehaviorTail?: number[];
  };
}

const CASES: Case[] = [
  {
    name: "combines chassis base/mods, items, and weapon tiers into one StatBlock",
    given: {
      chassisBase: { maxHp: 150 },
      chassisMods: [{ kind: "flat", stat: "damage", amount: 1 }],
      items: [{ item: PIERCE_ITEM, count: 2 }],
      weapons: [{ weapon: TUNNELER, tier: 2 }],
    },
    then: {
      maxHp: 150,
      // damage: base + chassis flat(1) + weapon flat(2 + perLevel*tier = 4) = base + 5
      damage: STAT_DEFS.damage.base + 1 + (2 + 1 * 2),
      // pierce: item flat 0.5 stacked twice (no maxStacks) + weapon flat 1.5 = 2.5
      pierce: 2.5,
    },
  },
  {
    name: "a brand-new weapon needs no engine changes — pure data addition",
    given: { weapons: [{ weapon: RAILGUN, tier: 0 }] },
    then: { pierce: 1.5, behaviorCount: 1, firstBehaviorTail: [1, 0.25, 0.0625, 0.015625] },
  },
  {
    name: "one projectileBehavior per equipped weapon, each decomposing the same shared pierce with its own pierceDecay",
    given: { weapons: [{ weapon: TUNNELER, tier: 0 }, { weapon: FLAK_CANNON, tier: 0 }] },
    then: {
      pierce: 1.5,
      behaviorCount: 2,
      // TUNNELER falls back to the default 50% pierceDecay.
      firstBehaviorTail: [1, 0.25, 0.0625, 0.015625],
      behaviorFlatLineCounts: [1, 1],
    },
  },
];

describe("resolveLoadout — single resolution path", () => {
  it.each(CASES)("$name", ({ given, then }) => {
    const { stats, projectileBehaviors } = resolveLoadout(given);
    if (then.maxHp !== undefined) expect(stats.maxHp).toBe(then.maxHp);
    if (then.damage !== undefined) expect(stats.damage).toBeCloseTo(then.damage, 10);
    if (then.pierce !== undefined) expect(stats.pierce).toBeCloseTo(then.pierce, 10);
    if (then.behaviorCount !== undefined) expect(projectileBehaviors.length).toBe(then.behaviorCount);
    if (then.firstBehaviorTail !== undefined) {
      expect(projectileBehaviors[0].tailHitFractions).toEqual(then.firstBehaviorTail);
    }
    if (then.behaviorFlatLineCounts !== undefined) {
      expect(projectileBehaviors.map((b) => b.flatLineCount)).toEqual(then.behaviorFlatLineCounts);
    }
  });

  it("a higher per-weapon pierceDecay forks more of the same shared pierce than a lower one", () => {
    const { projectileBehaviors } = resolveLoadout({
      weapons: [{ weapon: TUNNELER, tier: 0 }, { weapon: FLAK_CANNON, tier: 0 }],
    });
    const [tunnelerTail, flakTail] = projectileBehaviors;
    // Same shared pierce (1.5), but FLAK_CANNON's 90% decay leaves a fatter
    // overflow per fork than TUNNELER's default 50% decay.
    expect(flakTail.tailHitFractions[1]).toBeGreaterThan(tunnelerTail.tailHitFractions[1]);
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
  return Array.from({ length: count }, () => ({ weapon: TUNNELER, tier: 0 }));
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
