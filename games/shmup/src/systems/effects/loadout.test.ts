import { describe, it, expect } from "vitest";
import { resolveLoadout } from "./loadout";
import { MAX_WEAPON_SLOTS } from "./slots";
import { STAT_DEFS } from "../stats";
import type { ItemDef, OwnedItem, OwnedWeapon, WeaponDef } from "./types";

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

const PIERCE_ITEM: ItemDef = {
  id: "tunneling-rounds",
  name: "Tunneling Rounds",
  mods: [{ kind: "flat", stat: "pierce", amount: 0.5 }],
  scalesWith: ["pierce"],
};

describe("resolveLoadout — single resolution path", () => {
  it("combines chassis base/mods, items, and weapon tiers into one StatBlock", () => {
    const owned: OwnedWeapon = { weapon: FORKING_GUN, tier: 2 };
    const item: OwnedItem = { item: PIERCE_ITEM, count: 2 };

    const { stats } = resolveLoadout({
      chassisBase: { maxHp: 150 },
      chassisMods: [{ kind: "flat", stat: "damage", amount: 1 }],
      items: [item],
      weapons: [owned],
    });

    expect(stats.maxHp).toBe(150);
    // damage: base + chassis flat(1) + weapon flat(2 + perLevel*tier = 2) = base + 3
    expect(stats.damage).toBeCloseTo(STAT_DEFS.damage.base + 1 + (2 + 1 * 2), 10);
    // fork: weapon flat 1 (no perLevel growth)
    expect(stats.fork).toBe(1);
    // pierce: item flat 0.5 stacked twice (no maxStacks) = 1.0
    expect(stats.pierce).toBeCloseTo(1.0, 10);
  });

  it("derives projectile behavior from the same resolved stats", () => {
    const { stats, projectileBehavior } = resolveLoadout({
      weapons: [{ weapon: FORKING_GUN, tier: 0 }],
    });
    expect(stats.fork).toBe(1);
    // fork=1 -> 2 independent copies of a single guaranteed hit each.
    expect(projectileBehavior.hitFractions).toEqual([1, 1]);
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

  it("is a pure data addition: a brand-new weapon needs no engine changes", () => {
    const railgun: WeaponDef = {
      id: "railgun",
      name: "Railgun",
      firingArc: "forward",
      targetType: "ground",
      projectileSpeed: 900,
      scalesWith: ["damage", "pierce"],
      mods: [{ base: { kind: "flat", stat: "pierce", amount: 3 }, perLevel: 0 }],
    };
    const { projectileBehavior } = resolveLoadout({ weapons: [{ weapon: railgun, tier: 0 }] });
    expect(projectileBehavior.hitFractions).toEqual([1, 1, 1, 1]);
  });
});

describe("resolveLoadout — 6 weapon-slot cap", () => {
  function ownedSlots(count: number): OwnedWeapon[] {
    return Array.from({ length: count }, () => ({ weapon: FORKING_GUN, tier: 0 }));
  }

  it("accepts exactly the slot cap", () => {
    expect(() => resolveLoadout({ weapons: ownedSlots(MAX_WEAPON_SLOTS) })).not.toThrow();
  });

  it("rejects more weapons than the chassis has slots", () => {
    expect(() => resolveLoadout({ weapons: ownedSlots(MAX_WEAPON_SLOTS + 1) })).toThrow();
  });
});
