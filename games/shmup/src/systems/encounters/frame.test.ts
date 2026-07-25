import { describe, expect, it } from "vitest";
import { GAME_WIDTH } from "../../config";
import { PLAYER_REF_FRACTION, TILE_UNIT, playerLineY, staticTileFrame, toLocal, toScreen } from "./frame";

describe("staticTileFrame", () => {
  it("makes a 1x1 tile exactly one screen wide, so an authored pixel is a game pixel", () => {
    const frame = staticTileFrame(1);
    expect(frame.widthPx).toBe(GAME_WIDTH);
    expect(frame.originX).toBe(0);
  });

  it("centres a wider tile horizontally", () => {
    const frame = staticTileFrame(3);
    expect(frame.widthPx).toBe(3 * TILE_UNIT);
    expect(frame.originX).toBe((GAME_WIDTH - 3 * TILE_UNIT) / 2);
  });

  it("pins the authored player-reference marker to where the ship actually sits", () => {
    const frame = staticTileFrame(1);
    const marker = toScreen(frame, { x: TILE_UNIT / 2, y: TILE_UNIT * PLAYER_REF_FRACTION });
    expect(marker.x).toBe(GAME_WIDTH / 2);
    expect(marker.y).toBeCloseTo(playerLineY(), 6);
  });

  it("puts an entrance authored above the tile on screen, not off the top of it", () => {
    const frame = staticTileFrame(1);
    // The editor's own default first step sits 0.6 tiles north of the tile.
    const entrance = toScreen(frame, { x: TILE_UNIT / 2, y: -TILE_UNIT * 0.6 });
    expect(entrance.y).toBeGreaterThan(0);
    expect(entrance.y).toBeLessThan(playerLineY());
  });
});

describe("toScreen / toLocal", () => {
  it("round-trips", () => {
    const frame = staticTileFrame(2);
    const local = { x: 123, y: -45 };
    expect(toLocal(frame, toScreen(frame, local))).toEqual(local);
  });
});
