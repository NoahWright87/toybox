import { describe, expect, it } from "vitest";
import { DEPTH, PART_DEPTH_OFFSET, authoredLayerDepth } from "./depth";

/**
 * These pin *relationships*, not numbers — the exact values are free to move,
 * the ordering is not. The bug that prompted the table was silent precisely
 * because nothing checked it: every pooled entity defaulted to depth 0 while
 * authored units set 1/2/4, so player fire rendered behind the scenery it was
 * flying over and nothing failed.
 */
describe("render stack ordering", () => {
  it("keeps the field behind everything that plays on it", () => {
    expect(DEPTH.backdrop).toBeLessThan(DEPTH.tileArt);
    expect(DEPTH.tileArt).toBeLessThan(DEPTH.stars);
    expect(DEPTH.stars).toBeLessThan(DEPTH.doodad);
  });

  it("stacks scenery under ground under air", () => {
    expect(DEPTH.doodad).toBeLessThan(DEPTH.groundUnit);
    expect(DEPTH.groundUnit).toBeLessThan(DEPTH.airUnit);
  });

  it("draws player fire over every unit, scenery included — the reported bug", () => {
    for (const unit of [DEPTH.doodad, DEPTH.groundUnit, DEPTH.airUnit, DEPTH.enemy]) {
      expect(DEPTH.playerBullet).toBeGreaterThan(unit);
    }
  });

  it("draws incoming fire over player fire and over every unit", () => {
    expect(DEPTH.enemyProjectile).toBeGreaterThan(DEPTH.playerBullet);
    for (const unit of [DEPTH.doodad, DEPTH.groundUnit, DEPTH.airUnit, DEPTH.enemy]) {
      expect(DEPTH.enemyProjectile).toBeGreaterThan(unit);
    }
  });

  it("keeps coins readable over terrain without hiding a bullet", () => {
    expect(DEPTH.coin).toBeGreaterThan(DEPTH.airUnit);
    expect(DEPTH.coin).toBeLessThan(DEPTH.playerBullet);
  });

  it("puts the player above the field, and the HUD above that", () => {
    expect(DEPTH.player).toBeGreaterThan(DEPTH.enemyProjectile);
    expect(DEPTH.hud).toBeGreaterThan(DEPTH.player);
    expect(DEPTH.floatingText).toBeGreaterThan(DEPTH.hud);
  });

  it("leaves room for a Part above its hull without reaching the next layer", () => {
    // A ground hull's Part must not render at or above the air layer, or a
    // turret would sort over aircraft passing above it.
    expect(DEPTH.groundUnit + PART_DEPTH_OFFSET).toBeLessThan(DEPTH.airUnit);
    // ...and an air hull's Part must still stay under the projectile layers.
    expect(DEPTH.airUnit + PART_DEPTH_OFFSET).toBeLessThan(DEPTH.playerBullet);
  });
});

describe("authoredLayerDepth", () => {
  it("maps each authored layer to its own depth", () => {
    expect(authoredLayerDepth("doodad")).toBe(DEPTH.doodad);
    expect(authoredLayerDepth("ground")).toBe(DEPTH.groundUnit);
    expect(authoredLayerDepth("air")).toBe(DEPTH.airUnit);
  });

  it("falls back to ground for an unrecognized layer", () => {
    expect(authoredLayerDepth("something-new")).toBe(DEPTH.groundUnit);
  });
});
