import { describe, expect, it } from "vitest";
import { createDefaultUnitLibrary, repairSeededSimpleEnemies, type UnitDef } from "./unitTypes";

/**
 * `repairSeededSimpleEnemies` exists because the seeded simple enemies used to
 * ship with (a) an actionless "Main" Part, which permanently disabled the
 * encounter editor's 🔫+ control, and (b) an inert Move Action as the default
 * for stationary units, so a placed Turret did nothing at all. It runs on every
 * `loadUnits` instead of a SAVE_VERSION bump precisely so user-authored Units
 * survive — these tests pin both the repair and that restraint.
 */

function libraryUnit(name: string): UnitDef {
  const unit = createDefaultUnitLibrary().find((u) => u.name === name);
  if (!unit) throw new Error(`no seeded unit named ${name}`);
  return unit;
}

/** A unit as it was *stored* before the fix: attack in the buffet, Part empty. */
function asStoredBeforeFix(unit: UnitDef): UnitDef {
  const move = unit.actions.find((a) => a.attack === null);
  return {
    ...unit,
    defaultActionId: move?.id ?? null,
    parts: unit.parts.map((p) => ({ ...p, actions: [] })),
  };
}

describe("repairSeededSimpleEnemies", () => {
  it("gives a seeded enemy's Part the attack Action so 🔫+ becomes usable", () => {
    const stale = asStoredBeforeFix(libraryUnit("Turret"));
    expect(stale.parts.every((p) => p.actions.length === 0)).toBe(true);

    const [fixed] = repairSeededSimpleEnemies([stale]);
    expect(fixed.parts.some((p) => p.actions.length > 0)).toBe(true);
    expect(fixed.parts[0].actions[0].attack).not.toBeNull();
  });

  it("repoints a stationary unit's inert default Action at its attack", () => {
    const stale = asStoredBeforeFix(libraryUnit("Turret"));
    const [fixed] = repairSeededSimpleEnemies([stale]);

    const chosen = fixed.actions.find((a) => a.id === fixed.defaultActionId);
    expect(chosen?.attack).not.toBeNull();
    expect(chosen?.name).toBe("Attack");
  });

  it("leaves a mobile unit defaulting to Move", () => {
    const stale = asStoredBeforeFix(libraryUnit("Transport Truck"));
    const [fixed] = repairSeededSimpleEnemies([stale]);

    const chosen = fixed.actions.find((a) => a.id === fixed.defaultActionId);
    expect(chosen?.name).toBe("Move");
  });

  it("never touches a user-authored Unit", () => {
    const mine: UnitDef = {
      ...libraryUnit("Turret"),
      id: "unit-mine-12345",
      name: "My Turret",
      parts: libraryUnit("Turret").parts.map((p) => ({ ...p, actions: [] })),
      defaultActionId: null,
    };
    const [after] = repairSeededSimpleEnemies([mine]);
    expect(after).toEqual(mine);
  });

  it("respects a deliberate hold-position default on a seeded turret", () => {
    // defaultActionId null reads as "(none — holds position)" in the Step tab —
    // a legitimate authoring choice. Since this repair runs on every loadUnits,
    // overwriting it would make that choice impossible to keep, so only an inert
    // *Move* default gets redirected.
    const stale = { ...asStoredBeforeFix(libraryUnit("Turret")), defaultActionId: null };
    const [after] = repairSeededSimpleEnemies([stale]);
    expect(after.defaultActionId).toBeNull();
    // ...but the Part repair still applies, so 🔫+ works either way.
    expect(after.parts.some((p) => p.actions.length > 0)).toBe(true);
  });

  it("is idempotent — a freshly seeded library is already correct", () => {
    const fresh = createDefaultUnitLibrary();
    expect(repairSeededSimpleEnemies(fresh)).toEqual(fresh);
  });
});
