import { describe, expect, it } from "vitest";
import { GAME_WIDTH } from "../../config";
import { levelOriginX, tileFrameAt, tileLocalSec, toLocal, toScreen } from "./frame";
import { IDENTITY_ORIENTATION, type TilePlacement } from "./levelLayout";
import { LEVEL_SCROLL_SPEED, TILE_UNIT, tileEngageSec } from "./scrollModel";

function placement(depth: number, column = 0): TilePlacement {
  return { tileId: "t", depth, column, orientation: IDENTITY_ORIENTATION };
}

describe("levelOriginX", () => {
  it("makes a one-column level exactly one screen wide, so an authored pixel is a game pixel", () => {
    expect(levelOriginX(1)).toBe(0);
    expect(TILE_UNIT).toBe(GAME_WIDTH);
  });

  it("centres a wider level, overflowing evenly on both sides", () => {
    expect(levelOriginX(3)).toBe((GAME_WIDTH - 3 * TILE_UNIT) / 2);
  });
});

describe("tileLocalSec", () => {
  it("is zero for the first tile at the start of the level", () => {
    expect(tileLocalSec(placement(0), 0)).toBe(0);
  });

  it("is negative for a tile that hasn't arrived yet", () => {
    expect(tileLocalSec(placement(2), 0)).toBeLessThan(0);
  });

  it("reads the same on every tile once that tile has engaged", () => {
    const depth = 3;
    expect(tileLocalSec(placement(depth), tileEngageSec(depth) + 1.5)).toBeCloseTo(1.5, 6);
  });
});

describe("tileFrameAt", () => {
  it("starts the first tile entirely above the screen, south edge on the top edge", () => {
    const frame = tileFrameAt(placement(0), 1, 1, 0);
    expect(frame.originY).toBe(-TILE_UNIT);
    expect(frame.originY + frame.heightPx).toBe(0);
    expect(frame.originX).toBe(0);
  });

  it("scrolls it down at the shared level speed", () => {
    const frame = tileFrameAt(placement(0), 1, 1, 2);
    expect(frame.originY).toBeCloseTo(-TILE_UNIT + 2 * LEVEL_SCROLL_SPEED, 6);
  });

  it("holds a later tile further above the screen until its turn", () => {
    expect(tileFrameAt(placement(1), 1, 1, 0).originY).toBeCloseTo(-2 * TILE_UNIT, 6);
  });

  it("puts a tile at depth d in exactly the same place at its own engage time as depth 0 was at zero", () => {
    const deep = tileFrameAt(placement(4), 1, 1, tileEngageSec(4));
    expect(deep.originY).toBeCloseTo(-TILE_UNIT, 6);
  });

  it("stacks consecutive tiles with no gap or overlap", () => {
    const first = tileFrameAt(placement(0), 1, 1, 1.3);
    const second = tileFrameAt(placement(1), 1, 1, 1.3);
    expect(second.originY + second.heightPx).toBeCloseTo(first.originY, 6);
  });

  it("offsets each column by one tile unit", () => {
    const frame = tileFrameAt(placement(0, 2), 1, 3, 0);
    expect(frame.originX).toBeCloseTo(levelOriginX(3) + 2 * TILE_UNIT, 6);
  });

  it("widens with the tile's footprint", () => {
    expect(tileFrameAt(placement(0), 3, 3, 0).widthPx).toBe(3 * TILE_UNIT);
  });
});

describe("toScreen / toLocal", () => {
  it("round-trips through a moving frame", () => {
    const frame = tileFrameAt(placement(1, 1), 2, 3, 2.5);
    const local = { x: 123, y: -45 };
    expect(toLocal(frame, toScreen(frame, local))).toEqual(local);
  });

  it("carries an authored position down the screen with its tile", () => {
    const local = { x: 360, y: 300 };
    const early = toScreen(tileFrameAt(placement(0), 1, 1, 0), local);
    const later = toScreen(tileFrameAt(placement(0), 1, 1, 1), local);
    expect(later.y - early.y).toBeCloseTo(LEVEL_SCROLL_SPEED, 6);
    expect(later.x).toBe(early.x);
  });
});
