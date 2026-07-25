import { describe, expect, it } from "vitest";
import {
  CUSTOM_ART_ID,
  EDITOR_ASSET_BASE,
  NONE_ART_ID,
  editorSpriteTextureKey,
  editorSpriteUrl,
  editorTileImageUrl,
  editorTileTextureKey,
  knownSpriteIds,
  knownTileImageIds,
} from "./editorArt";

describe("editorSpriteUrl", () => {
  it("resolves a built-in id to the main app's asset path", () => {
    expect(editorSpriteUrl("heli", null)).toBe("/shmup-editor/enemies/heli.png");
  });

  it("resolves the sub-foldered multi-part vehicles, the one place the ids aren't a plain filename", () => {
    expect(editorSpriteUrl("battleship-hull", null)).toBe("/shmup-editor/enemies/battleship/hull.png");
    expect(editorSpriteUrl("train-gun-car-turret", null)).toBe("/shmup-editor/enemies/train/gun-car-turret.png");
  });

  it("hands back a custom upload's own data URL", () => {
    expect(editorSpriteUrl(CUSTOM_ART_ID, "data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("has nothing to load for 'none', an unknown id, or a custom reference with no upload attached", () => {
    expect(editorSpriteUrl(NONE_ART_ID, null)).toBeUndefined();
    expect(editorSpriteUrl("not-a-real-sprite", null)).toBeUndefined();
    expect(editorSpriteUrl(CUSTOM_ART_ID, null)).toBeUndefined();
  });
});

describe("editorTileImageUrl", () => {
  it("resolves a built-in tile image", () => {
    expect(editorTileImageUrl("grass-road-curve", null)).toBe("/shmup-editor/tiles/grass-road-curve.png");
  });

  it("has nothing to load for an unknown id", () => {
    expect(editorTileImageUrl("not-a-real-tile", null)).toBeUndefined();
  });
});

describe("texture keys", () => {
  it("namespaces built-ins by sprite id, so one texture is shared by every Unit using it", () => {
    expect(editorSpriteTextureKey("heli", "unit-a")).toBe(editorSpriteTextureKey("heli", "unit-b"));
  });

  it("namespaces custom uploads by their owning record, since each is its own image", () => {
    expect(editorSpriteTextureKey(CUSTOM_ART_ID, "unit-a")).not.toBe(editorSpriteTextureKey(CUSTOM_ART_ID, "unit-b"));
  });

  it("keeps tile art in its own namespace so a tile id can never shadow a sprite id", () => {
    expect(editorTileTextureKey("grass", "tile-1")).not.toBe(editorSpriteTextureKey("grass", "tile-1"));
  });
});

describe("the mirrored art tables", () => {
  // These mirror src/experiences/ShmupEditor/{enemySprites,tileImages}.ts by
  // convention (the two packages share no code). Nothing here can prove the
  // two are in sync, but it can prove this side is well-formed.
  it("point every entry at the editor's asset base", () => {
    for (const id of knownSpriteIds()) expect(editorSpriteUrl(id, null)).toMatch(new RegExp(`^${EDITOR_ASSET_BASE}`));
    for (const id of knownTileImageIds()) expect(editorTileImageUrl(id, null)).toMatch(new RegExp(`^${EDITOR_ASSET_BASE}`));
  });

  it("never claim the reserved 'none'/'custom' ids as real art", () => {
    for (const id of [...knownSpriteIds(), ...knownTileImageIds()]) {
      expect(id).not.toBe(NONE_ART_ID);
      expect(id).not.toBe(CUSTOM_ART_ID);
    }
  });

  it("resolve every id they claim", () => {
    for (const id of knownSpriteIds()) expect(editorSpriteUrl(id, null)).toBeDefined();
    for (const id of knownTileImageIds()) expect(editorTileImageUrl(id, null)).toBeDefined();
  });
});
