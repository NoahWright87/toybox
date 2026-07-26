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
  tileLifespanSec,
} from "./scrollModel";

describe("the anchoring", () => {
  it("puts the tile entirely off the top of the screen at its own time zero", () => {
    // South edge flush with the screen top, north edge a full tile above it —
    // so nothing authored on the tile is visible when it engages, and an
    // enemy authored above the tile is further off still.
    expect(tileLocalToScreenY(TILE_UNIT, 0)).toBe(0);
    expect(tileLocalToScreenY(0, 0)).toBe(-TILE_UNIT);
    expect(tileLocalToScreenY(-300, 0)).toBeLessThan(-TILE_UNIT);
  });

  it("brings the whole tile into view only after a tile-height of scrolling", () => {
    expect(tileLocalToScreenY(0, secondsPerTile())).toBeCloseTo(0, 6);
  });

  it("scrolls down — a fixed point on the tile moves toward the bottom of the screen", () => {
    expect(tileLocalToScreenY(0, 1) - tileLocalToScreenY(0, 0)).toBeCloseTo(LEVEL_SCROLL_SPEED, 6);
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

  it("lasts a tile height PLUS a screen height of travel — the window an authored encounter gets", () => {
    expect(tileLifespanSec()).toBeCloseTo((TILE_UNIT + GAME_HEIGHT) / LEVEL_SCROLL_SPEED, 6);
    expect(tileLifespanSec()).toBeGreaterThan(secondsPerTile());
  });

  it("reports a tile gone exactly when its north edge clears the bottom", () => {
    expect(tileFullyOffScreen(0)).toBe(false);
    expect(tileFullyOffScreen(tileLifespanSec() - 0.01)).toBe(false);
    expect(tileFullyOffScreen(tileLifespanSec())).toBe(true);
  });

  it("overlaps consecutive tiles, so more than one is visible at a time", () => {
    expect(tileLifespanSec()).toBeGreaterThan(tileEngageSec(1));
  });

  it("abuts consecutive tiles seamlessly — the next tile's south edge arrives as this one's north edge does", () => {
    const handover = tileEngageSec(1);
    expect(tileLocalToScreenY(0, handover)).toBeCloseTo(tileLocalToScreenY(TILE_UNIT, 0), 6);
  });
});

describe("the camera band", () => {
  it("starts entirely below the tile — nothing on it is on screen yet", () => {
    expect(cameraLocalBand(0)).toEqual({ top: TILE_UNIT, bottom: TILE_UNIT + GAME_HEIGHT });
  });

  it("climbs the tile as the tile scrolls past", () => {
    expect(cameraLocalBand(1).top).toBeCloseTo(TILE_UNIT - LEVEL_SCROLL_SPEED, 6);
    expect(cameraLocalBand(2).top).toBeLessThan(cameraLocalBand(1).top);
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
    expect(playerTileLocalY(0)).toBe(playerScreenY() + TILE_UNIT);
    expect(playerTileLocalY(0)).toBeGreaterThan(TILE_UNIT);
    expect(playerTileLocalY(4)).toBeLessThan(playerTileLocalY(0));
  });

  it("crosses the whole tile before the tile leaves the screen", () => {
    // If the ship left the tile behind before it scrolled off, content
    // authored near the tile's north edge could never be reached.
    const passesNorthEdge = (playerScreenY() + TILE_UNIT) / LEVEL_SCROLL_SPEED;
    expect(passesNorthEdge).toBeLessThan(tileLifespanSec());
  });
});
