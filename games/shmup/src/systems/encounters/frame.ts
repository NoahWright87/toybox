/**
 * The tile-local -> screen mapping, at a given moment in a scrolling level.
 *
 * Authored positions are all **tile-local**: the tile's own north-west
 * corner is (0, 0), +x runs east, +y runs south, and one footprint column
 * is `TILE_UNIT` across. Scale is 1:1 against game pixels — `TILE_UNIT` is
 * deliberately `GAME_WIDTH`, so an authored pixel is a game pixel and the
 * editor's canvas is a literal preview rather than an approximation.
 *
 * A tile's frame **moves**, because the level scrolls (`scrollModel.ts`):
 * its north edge starts on the top edge of the screen the moment the tile
 * engages and travels down from there. Every authored position resolves
 * through the frame at the instant it touches a sprite, so everything on a
 * tile scrolls with it for free — which is exactly right for a turret
 * bolted to the ground, and is what makes a level nothing more than
 * several of these frames at staggered depths.
 *
 * Horizontally the level is centred on the camera. A level (or tile) wider
 * than one screen overflows both sides for now; the easing playable-bounds
 * box that fixes that is `levels-and-tiles.spec.todo.md` §4's L2 work.
 */
import { GAME_WIDTH } from "../../config";
import { TILE_UNIT, tileEngageSec, tileLocalToScreenY } from "./scrollModel";
import type { AuthoredFootprint, Vec2 } from "./authoredTypes";
import type { TilePlacement } from "./levelLayout";

export interface TileFrame {
  /** Screen x of the tile's west edge. */
  originX: number;
  /** Screen y of the tile's north edge. */
  originY: number;
  widthPx: number;
  heightPx: number;
}

/** Screen x of the level's westmost column, so a level of `columns` columns is centred. */
export function levelOriginX(columns: number): number {
  return (GAME_WIDTH - Math.max(1, columns) * TILE_UNIT) / 2;
}

/** Seconds this tile's own encounter clock reads at level time `levelSec`. Negative before it engages. */
export function tileLocalSec(placement: TilePlacement, levelSec: number): number {
  return levelSec - tileEngageSec(placement.depth);
}

/** Where a tile sits on screen at level time `levelSec`. */
export function tileFrameAt(
  placement: TilePlacement,
  footprint: AuthoredFootprint,
  columns: number,
  levelSec: number
): TileFrame {
  return {
    originX: levelOriginX(columns) + placement.column * TILE_UNIT,
    originY: tileLocalToScreenY(0, tileLocalSec(placement, levelSec)),
    widthPx: footprint * TILE_UNIT,
    heightPx: TILE_UNIT,
  };
}

export function toScreen(frame: TileFrame, local: Vec2): Vec2 {
  return { x: frame.originX + local.x, y: frame.originY + local.y };
}

export function toLocal(frame: TileFrame, screen: Vec2): Vec2 {
  return { x: screen.x - frame.originX, y: screen.y - frame.originY };
}

export { TILE_UNIT };
