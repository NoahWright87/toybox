/**
 * The tile-local -> screen mapping. Authored encounter positions are all
 * **tile-local**: the tile's own north-west corner is (0, 0), +x runs east,
 * +y runs south, and one footprint column is `TILE_UNIT` across. This is
 * the one place that turns those into screen pixels.
 *
 * **Scale is 1:1** — `TILE_UNIT` is 720, deliberately the same number as
 * `GAME_WIDTH`, so a 1x1 tile is exactly one screen wide and an authored
 * pixel is a game pixel. The editor anchored its own `TILE_UNIT` to
 * `GAME_WIDTH` for precisely this reason (`editorScale.ts`); keeping the
 * runtime at 1:1 is what makes the editor's canvas a literal preview
 * instead of an approximation.
 *
 * **Vertically the frame is pinned by the player reference marker**, not by
 * the tile's own edges: the editor draws a player stand-in at 85% down the
 * tile, and everything an author positions is read against that marker. So
 * `t = 0` puts that marker exactly where the player ship actually sits, and
 * the editor's static canvas and the game's opening frame agree pixel for
 * pixel. A tile is 720 tall against a 1280-tall screen, so the tile occupies
 * the lower ~56% of the view and authored lead-in positions above it
 * (negative local y, where the editor's own default entrance sits) land on
 * the upper part of the screen — off the tile, on screen, which is exactly
 * where an entering enemy should appear.
 *
 * A single-tile playtest holds this frame still. Scrolling it — so a level
 * of chained tiles moves past — is the level pass's job, and it belongs
 * here: give `TileFrame.originY` a velocity and everything authored moves
 * with its tile for free, because every position in the runner is resolved
 * through `toScreen` on the frame it belongs to.
 */
import { GAME_WIDTH, GAME_HEIGHT } from "../../config";
import { TUNING } from "../../tuning";
import type { AuthoredFootprint, Vec2 } from "./authoredTypes";

/**
 * How wide one footprint column is in authored units. Mirrors the editor's
 * `editorScale.ts` `TILE_UNIT`; both are anchored to `GAME_WIDTH`, and they
 * must move together or authored content silently changes size.
 */
export const TILE_UNIT = 720;

/** How far down the tile the editor draws its player reference marker (`EncounterEditor.tsx`'s `playerRefWorld`). */
export const PLAYER_REF_FRACTION = 0.85;

/** Where the player ship sits on screen — also `PlayScene`'s spawn position. */
export function playerLineY(): number {
  return GAME_HEIGHT - TUNING.encounters.playerLineOffsetY;
}

export interface TileFrame {
  /** Screen x of the tile's west edge. */
  originX: number;
  /** Screen y of the tile's north edge. */
  originY: number;
  widthPx: number;
  heightPx: number;
}

/** The frame a single-tile playtest runs in: horizontally centered, vertically pinned by the player reference marker. */
export function staticTileFrame(footprint: AuthoredFootprint): TileFrame {
  const widthPx = footprint * TILE_UNIT;
  return {
    originX: (GAME_WIDTH - widthPx) / 2,
    originY: playerLineY() - TILE_UNIT * PLAYER_REF_FRACTION,
    widthPx,
    heightPx: TILE_UNIT,
  };
}

export function toScreen(frame: TileFrame, local: Vec2): Vec2 {
  return { x: frame.originX + local.x, y: frame.originY + local.y };
}

export function toLocal(frame: TileFrame, screen: Vec2): Vec2 {
  return { x: screen.x - frame.originX, y: screen.y - frame.originY };
}
