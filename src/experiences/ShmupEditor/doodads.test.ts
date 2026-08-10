import { describe, expect, it } from "vitest";
import { backfillDoodads, createDefaultUnitLibrary, createDoodadUnits, type UnitDef } from "./unitTypes";

/**
 * The doodad batch (public/shmup-editor/doodads/) is seeded as ~93 inert
 * scenery Units. Two things are worth pinning: that "inert" actually holds
 * across the whole batch — one stray `contactDamage` turns a decorative rock
 * into an invisible damage source under every placement of it — and that the
 * backfill onto an already-saved library adds without disturbing, since it
 * runs against libraries full of Units the user authored themselves.
 */

const doodads = createDoodadUnits();

describe("seeded doodad Units", () => {
  it("seeds the whole batch", () => {
    expect(doodads.length).toBe(93);
  });

  it("is inert across every doodad — scenery, not an opponent", () => {
    for (const unit of doodads) {
      expect(unit.layer).toBe("doodad");
      expect(unit.speed).toBe(0);
      expect(unit.contactDamage).toBe(0);
      expect(unit.scoreValue).toBe(0);
      expect(unit.actions).toEqual([]);
      // Null default reads as "(none — holds position)" in the Step tab, which
      // for scenery is the whole point — see DOODAD_SPECS' comment on why this
      // is deliberately not the inert Move that seeded turrets get repaired off.
      expect(unit.defaultActionId).toBeNull();
      expect(unit.parts.every((p) => !p.hasHitbox && !p.hasHealth)).toBe(true);
    }
  });

  it("gives every doodad a distinct id, name and sprite", () => {
    expect(new Set(doodads.map((u) => u.id)).size).toBe(doodads.length);
    expect(new Set(doodads.map((u) => u.name)).size).toBe(doodads.length);
    expect(new Set(doodads.map((u) => u.spriteId)).size).toBe(doodads.length);
  });

  it("does not collide with any other seeded Unit", () => {
    const library = createDefaultUnitLibrary();
    expect(new Set(library.map((u) => u.id)).size).toBe(library.length);
    for (const doodad of doodads) {
      expect(library.some((u) => u.id === doodad.id)).toBe(true);
    }
  });
});

describe("backfillDoodads", () => {
  /** A library as saved before the doodad batch shipped: seeded enemies plus something the user made. */
  function libraryWithoutDoodads(): UnitDef[] {
    const doodadIds = new Set(doodads.map((u) => u.id));
    return createDefaultUnitLibrary().filter((u) => !doodadIds.has(u.id));
  }

  it("adds the batch to a library saved before it existed", () => {
    const before = libraryWithoutDoodads();
    const after = backfillDoodads(before);

    expect(after.length).toBe(before.length + doodads.length);
    for (const doodad of doodads) {
      expect(after.some((u) => u.id === doodad.id)).toBe(true);
    }
  });

  it("leaves the Units already in the library untouched, in order", () => {
    const before = libraryWithoutDoodads();
    const after = backfillDoodads(before);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("keeps a user-authored Unit, including one that shadows a doodad's name", () => {
    const mine: UnitDef = { ...doodads[0], id: "unit-mine-12345", name: "My Rock" };
    const after = backfillDoodads([mine]);

    expect(after[0]).toEqual(mine);
    expect(after.length).toBe(1 + doodads.length);
  });

  it("adds nothing to a library that already has the batch", () => {
    const full = createDefaultUnitLibrary();
    expect(backfillDoodads(full)).toEqual(full);
  });

  it("re-adds only the doodads that are missing", () => {
    const full = createDefaultUnitLibrary();
    const dropped = doodads[3].id;
    const after = backfillDoodads(full.filter((u) => u.id !== dropped));

    expect(after.length).toBe(full.length);
    expect(after.some((u) => u.id === dropped)).toBe(true);
  });
});
