import { describe, it, expect } from "vitest";
import { addStep, updateStep } from "./encounterSteps";
import { recomputeStepTimes } from "./encounterTiming";
import { createEncounterUnit, type EncounterUnit } from "./encounterTypes";
import { createBlankUnit, type UnitDef } from "./unitTypes";
import { authorLayerOf, computePinTimeSec, displayShiftY, isScrollLocked, pinHorizonSec, pinShiftY, referenceShiftY, scrollOffsetY } from "./airFrame";
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

  it("leaves an air unit on the tile until it pins — the fly-in", () => {
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: 3, t: 0 })).toBe(0);
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: 3, t: 3 })).toBe(0);
  });

  it("drifts a pinned air unit up the tile as the terrain passes beneath it", () => {
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: 3, t: 5 })).toBeCloseTo(-2 * LEVEL_SCROLL_SPEED);
  });

  it("treats an air unit that never becomes visible as riding the tile forever, like the runtime does", () => {
    expect(displayShiftY({ mode: "ground", scrollLocked: false, pinSec: null, t: 9 })).toBe(0);
  });
});

describe("displayShiftY — air mode (viewport-locked)", () => {
  it("slides scroll-locked content down past the fixed camera", () => {
    expect(displayShiftY({ mode: "air", scrollLocked: true, pinSec: null, t: 4 })).toBeCloseTo(4 * LEVEL_SCROLL_SPEED);
  });

  it("still rides an air unit in with the tile before its pin", () => {
    expect(displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 1 })).toBeCloseTo(1 * LEVEL_SCROLL_SPEED);
    expect(displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 3 })).toBeCloseTo(3 * LEVEL_SCROLL_SPEED);
  });

  it("holds a pinned air unit perfectly still afterwards", () => {
    const atPin = displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 3 });
    expect(displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 5 })).toBeCloseTo(atPin);
    expect(displayShiftY({ mode: "air", scrollLocked: false, pinSec: 3, t: 11 })).toBeCloseTo(atPin);
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

describe("computePinTimeSec", () => {
  const horizon = pinHorizonSec(10);

  it("pins a unit authored above the tile only once the scroll brings it into the camera", () => {
    const u = unit({ layer: "air" });
    // A full tile-height above the tile's own north edge: genuinely off
    // screen at clock zero, which is the case pinning-at-spawn got wrong.
    const inst = parked(u.id, { x: TILE_UNIT / 2, y: -TILE_UNIT });
    const pin = computePinTimeSec(inst, u, 1, horizon);
    expect(pin).not.toBeNull();
    // Camera top is at tile-local `TILE_UNIT - LEVEL_SCROLL_SPEED*t`; it
    // reaches y = -TILE_UNIT at t = 2*TILE_UNIT/speed.
    expect(pin!).toBeCloseTo((2 * TILE_UNIT) / LEVEL_SCROLL_SPEED, 1);
  });

  it("pins immediately for a unit already inside the camera band at its spawn time", () => {
    const u = unit({ layer: "air" });
    const band = cameraLocalBand(0);
    const inst = parked(u.id, { x: TILE_UNIT / 2, y: (band.top + band.bottom) / 2 });
    expect(computePinTimeSec(inst, u, 1, horizon)).toBeCloseTo(0);
  });

  it("returns null for a unit the camera never reaches horizontally", () => {
    const u = unit({ layer: "air" });
    // The camera is always one screen wide however wide the tile is
    // (cameraLocalXBand), so on a 3-wide tile the outer columns are never
    // on screen — a unit parked out there never pins.
    const inst = parked(u.id, { x: 10, y: 0 });
    expect(computePinTimeSec(inst, u, 3, horizon)).toBeNull();
  });

  it("returns null when the Unit def can't be resolved, rather than guessing a frame", () => {
    const inst = parked("missing", { x: 0, y: 0 });
    expect(computePinTimeSec(inst, undefined, 1, horizon)).toBeNull();
  });

  it("returns null for an instance with no steps at all", () => {
    const u = unit({ layer: "air" });
    expect(computePinTimeSec(createEncounterUnit(u.id), u, 1, horizon)).toBeNull();
  });

  it("does not report the spawn delay's worth of off-screen time as a pin", () => {
    const u = unit({ layer: "air" });
    const inst = parked(u.id, { x: TILE_UNIT / 2, y: -TILE_UNIT }, 4);
    const pin = computePinTimeSec(inst, u, 1, horizon);
    // Its first step is at t=4, so it does not exist (and cannot pin)
    // before then — even though the camera band covered that y earlier.
    expect(pin!).toBeGreaterThanOrEqual(4);
  });

  it("follows a moving path, pinning where the path actually enters the camera", () => {
    const u = unit({ layer: "air", speed: 300 });
    let inst = addStep(createEncounterUnit(u.id), null, { x: TILE_UNIT / 2, y: -TILE_UNIT * 2 });
    inst = addStep(inst, null, { x: TILE_UNIT / 2, y: 0 });
    inst = recomputeStepTimes(inst, u);
    const pin = computePinTimeSec(inst, u, 1, horizon);
    expect(pin).not.toBeNull();
    // Flying south while the camera band climbs north closes the gap faster
    // than scroll alone would: it must pin before a parked unit at the same
    // starting height does.
    const parkedPin = computePinTimeSec(parked(u.id, { x: TILE_UNIT / 2, y: -TILE_UNIT * 2 }), u, 1, horizon);
    expect(pin!).toBeLessThan(parkedPin!);
  });
});

describe("pinHorizonSec", () => {
  it("looks well past the last authored step, so a unit that enters after its path ends still pins", () => {
    expect(pinHorizonSec(0)).toBeGreaterThan((TILE_UNIT * 2) / LEVEL_SCROLL_SPEED);
  });
});

describe("pinShiftY — the term geometry math uses, without the render-mode term", () => {
  it("is zero for anything scroll-locked, in either mode", () => {
    expect(pinShiftY(true, null, 6)).toBe(0);
    expect(pinShiftY(true, 2, 6)).toBe(0);
  });

  it("is zero for an air unit that never pins, and before it pins", () => {
    expect(pinShiftY(false, null, 6)).toBe(0);
    expect(pinShiftY(false, 4, 2)).toBeCloseTo(0);
  });

  it("cancels the scroll once pinned, so the unit holds screen position", () => {
    expect(pinShiftY(false, 4, 6)).toBeCloseTo(-2 * LEVEL_SCROLL_SPEED);
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
    // ...and before the pin it genuinely does change, since the unit is
    // riding the terrain toward a player that isn't.
    expect(gapAt(1)).not.toBeCloseTo(gapAt(2));
  });
});

describe("scrollOffsetY", () => {
  it("clamps negative times to zero — nothing has scrolled before the encounter starts", () => {
    expect(scrollOffsetY(-5)).toBe(0);
    expect(scrollOffsetY(2)).toBeCloseTo(2 * LEVEL_SCROLL_SPEED);
  });
});
