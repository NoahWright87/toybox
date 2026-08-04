import { describe, it, expect } from "vitest";
import { addStep, updateStep } from "./encounterSteps";
import { recomputeStepTimes } from "./encounterTiming";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { createBlankUnit, type UnitDef } from "./unitTypes";
import { airPinSec, authorLayerOf, displayShiftY, isScrollLocked, pinShiftY, referenceShiftY, scrollOffsetY } from "./airFrame";
import { computeCameraBoundsRect } from "./hitboxPreview";
import { LEVEL_SCROLL_SPEED, TILE_UNIT, cameraLocalBand, cameraLocalXBand, playerTileLocalY } from "../../../games/shmup/src/systems/encounters/scrollModel";

function unit(overrides: Partial<UnitDef> = {}): UnitDef {
  return { ...createBlankUnit(0), ...overrides };
}

/** A one-step instance parked at `pos` — the simplest thing that can pin (a Turret's whole authored path is one step at time 0). */
function parked(unitDefId: string, pos: { x: number; y: number }, time = 0): EncounterUnit {
  let inst = addStep(createEncounterUnit(unitDefId), null, pos);
  inst = updateStep(inst, inst.steps[0].id, { time });
  return inst;
}

describe("authorLayerOf / isScrollLocked", () => {
  it("puts doodad in ground's frame, because doodad is scroll-locked exactly like ground", () => {
    expect(authorLayerOf("ground")).toBe("ground");
    expect(authorLayerOf("doodad")).toBe("ground");
    expect(authorLayerOf("air")).toBe("air");
  });

  it("matches the runtime's own rule — air is the only layer that decouples", () => {
    expect(isScrollLocked("ground")).toBe(true);
    expect(isScrollLocked("doodad")).toBe(true);
    expect(isScrollLocked("air")).toBe(false);
  });
});

describe("displayShiftY — ground mode (tile-local, the pre-existing behavior)", () => {
  it("leaves scroll-locked content exactly where it was authored", () => {
    expect(displayShiftY({ mode: "ground", scrollLocked: true, pinSec: null, t: 0 })).toBe(0);
    expect(displayShiftY({ mode: "ground", scrollLocked: true, pinSec: null, t: 7 })).toBe(0);
  });

  it("moves an air unit relative to the terrain at a steady rate, crossing its authored spot at the pin", () => {
    // It is never attached to the terrain, so in the terrain's own frame it is
    // always moving — no fly-in phase where it rides along.
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: 3, t: 3 })).toBeCloseTo(0);
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: 3, t: 0 })).toBeCloseTo(3 * LEVEL_SCROLL_SPEED);
  });

  it("drifts a pinned air unit up the tile as the terrain passes beneath it", () => {
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: 3, t: 5 })).toBeCloseTo(-2 * LEVEL_SCROLL_SPEED);
  });

  it("leaves an air unit with no pin at all on the tile, rather than guessing a frame for it", () => {
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: null, t: 9 })).toBe(0);
  });
});

describe("displayShiftY — air mode (viewport-locked)", () => {
  it("slides scroll-locked content down past the fixed camera", () => {
    expect(displayShiftY({ mode: "air", scrollLocked: true, pinSec: null, t: 4 })).toBeCloseTo(4 * LEVEL_SCROLL_SPEED);
  });

  it("holds an air unit perfectly still — at every scrub time, before its spawn as well as after", () => {
    // This is the whole point of the rule: an authored air route renders in
    // exactly one place, so what you draw is where it flies.
    const atPin = displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 3 });
    for (const t of [0, 1, 2.99, 3.01, 5, 11]) {
      expect(displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t })).toBeCloseTo(atPin);
    }
  });

  it("is positionally continuous across the pin — nothing jumps on the frame it decouples", () => {
    const justBefore = displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 2.99 });
    const justAfter = displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 3.01 });
    expect(Math.abs(justAfter - justBefore)).toBeLessThan(LEVEL_SCROLL_SPEED * 0.02);
  });
});

describe("referenceShiftY", () => {
  it("holds the camera box and player marker completely still in air mode", () => {
    const footprint = 1;
    const rects = [0, 2, 5, 9].map((t) => {
      const r = computeCameraBoundsRect(footprint, t);
      return { ...r, y: r.y + referenceShiftY("air", t) };
    });
    for (const r of rects) {
      expect(r.y).toBeCloseTo(TILE_UNIT);
      expect(r.x).toBeCloseTo(cameraLocalXBand(footprint).left);
    }
  });

  it("leaves the camera box climbing the tile in ground mode", () => {
    const a = computeCameraBoundsRect(1, 0).y + referenceShiftY("ground", 0);
    const b = computeCameraBoundsRect(1, 4).y + referenceShiftY("ground", 4);
    expect(b).toBeLessThan(a);
  });
});

describe("airPinSec", () => {
  it("pins an air instance at its own spawn moment, not when the scroll happens to reveal it", () => {
    const u = unit({ layer: "air" });
    expect(airPinSec(parked(u.id, { x: TILE_UNIT / 2, y: -TILE_UNIT }, 4), "air")).toBe(4);
    expect(airPinSec(parked(u.id, { x: TILE_UNIT / 2, y: 0 }), "air")).toBe(0);
  });

  it("pins regardless of where the route sits, including entirely off screen", () => {
    const u = unit({ layer: "air" });
    // The old rule returned null here (the camera never reaches this column on
    // a 3-wide tile) and the route rode the terrain forever as a result.
    expect(airPinSec(parked(u.id, { x: 10, y: -TILE_UNIT * 3 }, 2), "air")).toBe(2);
  });

  it("never pins a scroll-locked layer — ground and doodad ride the tile by definition", () => {
    const u = unit({ layer: "ground" });
    expect(airPinSec(parked(u.id, { x: 0, y: 0 }), "ground")).toBeNull();
    expect(airPinSec(parked(u.id, { x: 0, y: 0 }), "doodad")).toBeNull();
  });

  it("returns null when the layer can't be resolved, or the instance has no steps", () => {
    const u = unit({ layer: "air" });
    expect(airPinSec(parked(u.id, { x: 0, y: 0 }), undefined)).toBeNull();
    expect(airPinSec(createEncounterUnit(u.id), "air")).toBeNull();
  });
});

describe("pinShiftY — the term geometry math uses, without the render-mode term", () => {
  it("is zero for anything scroll-locked, in either mode", () => {
    expect(pinShiftY(true, null, 6)).toBe(0);
    expect(pinShiftY(true, 2, 6)).toBe(0);
  });

  it("is zero for an air unit with no pin at all", () => {
    expect(pinShiftY(false, null, 6)).toBe(0);
  });

  it("cancels the scroll exactly, so a pinned unit holds screen position", () => {
    expect(pinShiftY(false, 4, 6)).toBeCloseTo(-2 * LEVEL_SCROLL_SPEED);
  });

  it("keeps cancelling it *before* the pin too, so the drawn route never slides", () => {
    // Deliberately un-clamped: an air route is rigid in screen space at every
    // scrub time, including before its own spawn. Clamping here is what used to
    // make a route drift while you scrubbed toward it.
    expect(pinShiftY(false, 4, 2)).toBeCloseTo(2 * LEVEL_SCROLL_SPEED);
    for (const t of [0, 1, 4, 9]) {
      expect(pinShiftY(false, 4, t) + referenceShiftY("air", t)).toBeCloseTo(4 * LEVEL_SCROLL_SPEED);
    }
  });

  it("is mode-independent — the same effective tile-local position either way", () => {
    for (const t of [0, 3, 5, 9]) {
      const pin = pinShiftY(false, 4, t);
      expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: 4, t })).toBeCloseTo(pin + referenceShiftY("ground", t));
      expect(displayShiftY({ mode: "air", scrollLocked: false, pinSec: 4, t })).toBeCloseTo(pin + referenceShiftY("air", t));
    }
  });

  it("keeps a pinned air unit and the player marker a constant distance apart, which is what facePlayer aim depends on", () => {
    const authoredY = 400;
    const pin = 3;
    // Effective tile-local y of the unit, against the player's own tile-local
    // y. Once pinned, both hold the same screen position, so the gap between
    // them must stop changing — if it didn't, a pinned gunship would slowly
    // swing its aim for no authored reason. This is the property that breaks
    // if the render-mode term gets double-counted into the geometry.
    const gapAt = (t: number) => authoredY + pinShiftY(false, pin, t) - playerTileLocalY(t);
    expect(gapAt(5)).toBeCloseTo(gapAt(9));
    // ...and it holds from the very start now, since an air unit is pinned for
    // its whole life rather than riding the terrain in first.
    expect(gapAt(1)).toBeCloseTo(gapAt(9));
  });
});

describe("scrollOffsetY", () => {
  it("clamps negative times to zero — nothing has scrolled before the encounter starts", () => {
    expect(scrollOffsetY(-5)).toBe(0);
    expect(scrollOffsetY(2)).toBeCloseTo(2 * LEVEL_SCROLL_SPEED);
  });
});
