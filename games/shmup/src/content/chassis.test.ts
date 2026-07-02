import { describe, it, expect } from "vitest";
import { DEFAULT_CHASSIS, chassisById } from "./chassis";
import { resolveLoadout } from "../systems/effects";
import { TUNING } from "../tuning";

describe("chassisById", () => {
  it("resolves the default chassis by id", () => {
    expect(chassisById("default")).toBe(DEFAULT_CHASSIS);
  });

  it("falls back to the default chassis for an unknown id, same convention as weaponById", () => {
    expect(chassisById("not-a-real-chassis")).toBe(DEFAULT_CHASSIS);
  });
});

describe("DEFAULT_CHASSIS — applied through resolveLoadout with zero engine changes", () => {
  it("carries the framework's default 6 weapon-slot cap", () => {
    expect(DEFAULT_CHASSIS.maxWeaponSlots).toBe(TUNING.weapons.maxWeaponSlots);
  });

  it("has no identity quirks — a clean baseline chassis", () => {
    expect(DEFAULT_CHASSIS.mods).toEqual([]);
    expect(DEFAULT_CHASSIS.statBase).toBeUndefined();
  });

  it("slots into resolveLoadout via the existing chassisBase/chassisMods/maxWeaponSlots fields", () => {
    const { stats } = resolveLoadout({
      chassisBase: DEFAULT_CHASSIS.statBase,
      chassisMods: DEFAULT_CHASSIS.mods,
      maxWeaponSlots: DEFAULT_CHASSIS.maxWeaponSlots,
    });
    // No quirks means the resolved stats equal the all-defaults baseline.
    expect(stats).toEqual(resolveLoadout({}).stats);
  });

  it("opts into a Focus hitbox-shrink perk on top of the universal base Focus action", () => {
    expect(DEFAULT_CHASSIS.focus.speedMult).toBe(TUNING.combat.focusSpeedMult);
    expect(DEFAULT_CHASSIS.focus.hitboxRadiusFocus).toBe(TUNING.combat.hitboxRadiusFocus);
    expect(DEFAULT_CHASSIS.hitboxRadiusNormal).toBe(TUNING.combat.hitboxRadiusNormal);
  });
});
