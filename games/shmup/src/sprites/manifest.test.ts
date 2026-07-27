import { describe, it, expect } from "vitest";
import manifest from "./manifest.json";
import { CATEGORY_DEFAULT_SIZE, type SpriteCategory } from "./types";

const CATEGORIES = new Set<SpriteCategory>(Object.keys(CATEGORY_DEFAULT_SIZE) as SpriteCategory[]);
const SHAPES = new Set(["rect", "circle", "triangle"]);

describe("manifest.json", () => {
  it("has at least one entry per category", () => {
    const seen = new Set(Object.values(manifest).map((e) => e.category));
    for (const category of CATEGORIES) expect(seen.has(category)).toBe(true);
  });

  for (const [key, entry] of Object.entries(manifest)) {
    describe(key, () => {
      it("declares a known category", () => {
        expect(CATEGORIES.has(entry.category as SpriteCategory)).toBe(true);
      });

      it("has positive frame dimensions, frame count, and frame duration", () => {
        expect(entry.frameWidth).toBeGreaterThan(0);
        expect(entry.frameHeight).toBeGreaterThan(0);
        expect(entry.frameCount).toBeGreaterThanOrEqual(1);
        expect(entry.frameDuration).toBeGreaterThan(0);
      });

      it("has a path under its own category folder", () => {
        expect(entry.path.startsWith(`${entry.category}/`)).toBe(true);
      });

      it("declares a valid placeholder shape and color", () => {
        expect(SHAPES.has(entry.placeholder.shape)).toBe(true);
        expect(entry.placeholder.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  }
});
