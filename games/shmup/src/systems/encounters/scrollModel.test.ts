import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH } from "../../config";
import {
  LEVEL_SCROLL_SPEED,
  TILE_UNIT,
  cameraLocalBand,
  cameraLocalXBand,
  playerScreenY,
  playerTileLocalY,
  screenToTileLocalY,
  secondsPerTile,
  tileEngageSec,
  tileFullyOffScreen,
  tileLocalToScreenY,
  tileVisibleSec,
} from "./scrollModel";

describe("the anchoring", () => {
  it("puts a tile's north edge exactly on the top of the screen at its own time zero", () => {
    expect(tileLocalToScreenY(0, 0)).toBe(0);
  });

  it("scrolls down — a fixed point on the tile moves toward the bottom of the screen", () => {
    expect(tileLocalToScreenY(0, 1)).toBeCloseTo(LEVEL_SCROLL_SPEED, 6);
    expect(tileLocalToScreenY(0, 2)).toBeGreaterThan(tileLocalToScreenY(0, 1));
  });

  it("round-trips through the inverse", () => {
    expect(screenToTileLocalY(tileLocalToScreenY(345, 1.7), 1.7)).toBeCloseTo(345, 6);
  });

  it("is depth-independent, which is what makes one tile and a level of eight identical", () => {
    // A tile at depth 5 engages later, but once engaged reads exactly the same.
    const t = tileEngageSec(5);
    expect(tileLocalToScreenY(100, t - tileEngageSec(5))).toBe(tileLocalToScreenY(100, 0));
  });
});

describe("tile timing", () => {
  it("hands over to the next tile after one tile's worth of scrolling", () => {
    expect(secondsPerTile()).toBeCloseTo(TILE_UNIT / LEVEL_SCROLL_SPEED, 6);
    expect(tileEngageSec(1)).toBeCloseTo(secondsPerTile(), 6);
    expect(tileEngageSec(0)).toBe(0);
  });

  it("keeps a tile on screen for a whole screen height of travel, not just its own height", () => {
    // This, not secondsPerTile, is the window an authored encounter gets.
    expect(tileVisibleSec()).toBeCloseTo(GAME_HEIGHT / LEVEL_SCROLL_SPEED, 6);
    expect(tileVisibleSec()).toBeGreaterThan(secondsPerTile());
  });

  it("reports a tile gone exactly when its north edge clears the bottom", () => {
    expect(tileFullyOffScreen(0)).toBe(false);
    expect(tileFullyOffScreen(tileVisibleSec() - 0.01)).toBe(false);
    expect(tileFullyOffScreen(tileVisibleSec())).toBe(true);
  });

  it("overlaps consecutive tiles, so more than one is visible at a time", () => {
    expect(tileVisibleSec()).toBeGreaterThan(tileEngageSec(1));
  });
});

describe("the camera band", () => {
  it("starts on the tile and climbs it as the tile scrolls past", () => {
    expect(cameraLocalBand(0)).toEqual({ top: 0, bottom: GAME_HEIGHT });
    expect(cameraLocalBand(1).top).toBeCloseTo(-LEVEL_SCROLL_SPEED, 6);
  });

  it("is one screen wide however wide the tile is", () => {
    expect(cameraLocalXBand(1)).toEqual({ left: 0, right: GAME_WIDTH });
    const wide = cameraLocalXBand(3);
    expect(wide.right - wide.left).toBe(GAME_WIDTH);
    expect(wide.left).toBeCloseTo((3 * TILE_UNIT - GAME_WIDTH) / 2, 6);
  });
});

describe("the player's place on the tile", () => {
  it("starts below the tile and climbs through it", () => {
    expect(playerTileLocalY(0)).toBe(playerScreenY());
    expect(playerTileLocalY(0)).toBeGreaterThan(TILE_UNIT);
    expect(playerTileLocalY(4)).toBeLessThan(playerTileLocalY(0));
  });

  it("crosses the whole tile before the tile leaves the screen", () => {
    // If the ship left the tile behind before it scrolled off, content
    // authored near the tile's north edge could never be reached.
    const passesNorthEdge = playerScreenY() / LEVEL_SCROLL_SPEED;
    expect(passesNorthEdge).toBeLessThan(tileVisibleSec());
  });
});
