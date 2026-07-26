/**
 * The level scroll model — **the one module both packages import.**
 *
 * Everywhere else, `/shmup-editor` and this game deliberately share no
 * runtime code, only mirrored data shapes. This file is the exception, and
 * it exists because mirroring already failed here: the tile size was
 * declared once in `editorScale.ts` and again in the game, and the scroll
 * speed decides *what an authored encounter actually looks like when
 * played*. Two copies of that number means the editor showing you one
 * thing and the game doing another, silently, forever. So the editor
 * imports this file directly (`src/experiences/ShmupEditor/*`). It has no
 * imports of its own beyond the playfield size, so pulling it into the
 * Doors bundle costs nothing.
 *
 * It's also why these two numbers don't live in `TUNING`: that module is a
 * large game-only object the editor has no business importing. This file
 * is their tuning home — change the scroll speed here and both sides move
 * together.
 *
 * ## The model
 *
 * A shmup level scrolls **down**: the player advances north, terrain moves
 * south across the screen, and new tiles arrive at the top just before they
 * are needed. Tiles are ordered by **depth** — depth 0 is the first one you
 * meet, depth 1 is behind it (further north), and so on.
 *
 * The clock is anchored so that **at a tile's own time zero, the tile sits
 * entirely off the top of the screen, with its south edge exactly on the
 * screen's top edge**. Nothing on it is visible yet; the tile then scrolls
 * down into view. That's what makes content arrive the way a shmup's does —
 * an enemy authored above its tile spawns genuinely off-screen and flies in,
 * instead of popping into existence mid-screen the instant the tile loads.
 *
 * It also means a tile behaves identically played alone or as depth 7 of a
 * level: consecutive tiles engage exactly one tile-height of scrolling
 * apart, so tile *d*'s south edge lands on the screen top at the same
 * moment tile *d-1*'s north edge does, and they abut seamlessly.
 *
 * That anchoring collapses the whole mapping to one line, independent of
 * depth (`tileLocalToScreenY`):
 *
 *     screenY = localY - TILE_UNIT + LEVEL_SCROLL_SPEED * t
 *
 * where `localY` is tile-local (0 = the tile's north edge, `TILE_UNIT` =
 * its south edge) and `t` is seconds since that tile engaged. Everything
 * else here is a consequence of that one equation.
 */
import { GAME_HEIGHT, GAME_WIDTH } from "../../config";

/**
 * Width of one footprint column, in authored units. Deliberately equal to
 * `GAME_WIDTH`, so a 1x1 tile is exactly one screen wide and an authored
 * pixel is a game pixel. The editor's canvas works in these units.
 */
export const TILE_UNIT = 720;

/**
 * How fast the level scrolls past, px/sec. **This is the number.**
 *
 * At 180 a tile takes 4s to hand over to the next one and lasts ~11.1s from
 * engaging to fully scrolled away, which is the window an authored encounter
 * has to play out in. Raising it makes levels faster and gives every
 * encounter less room; lowering it does the opposite. Distinct from
 * `TUNING.visuals.bgScrollSpeed`, which is the cosmetic parallax drift of
 * the star backdrop and means nothing to gameplay.
 */
export const LEVEL_SCROLL_SPEED = 180;

/** How far above the bottom of the screen the player ship sits. */
export const PLAYER_LINE_OFFSET_Y = 90;

/** Where the player ship sits on screen. */
export function playerScreenY(): number {
  return GAME_HEIGHT - PLAYER_LINE_OFFSET_Y;
}

/** Screen y of a tile-local y, `t` seconds after that tile engaged. The whole model. */
export function tileLocalToScreenY(localY: number, t: number): number {
  return localY - TILE_UNIT + LEVEL_SCROLL_SPEED * t;
}

/** The inverse: which tile-local y is at a given screen y, `t` seconds in. */
export function screenToTileLocalY(screenY: number, t: number): number {
  return screenY + TILE_UNIT - LEVEL_SCROLL_SPEED * t;
}

/**
 * Where the player sits in a tile's own coordinates, `t` seconds after it
 * engaged — the marker an author is really positioning against. It starts
 * below the tile and travels up through it as the tile scrolls past, which
 * is why a static marker in the editor can only ever be one frame of the
 * truth.
 */
export function playerTileLocalY(t: number): number {
  return screenToTileLocalY(playerScreenY(), t);
}

/** The band of tile-local y currently on screen, `t` seconds after the tile engaged. */
export function cameraLocalBand(t: number): { top: number; bottom: number } {
  const top = screenToTileLocalY(0, t);
  return { top, bottom: top + GAME_HEIGHT };
}

/** The band of tile-local x on screen for a tile of this footprint — the camera is always one screen wide, however wide the tile is. */
export function cameraLocalXBand(footprint: number): { left: number; right: number } {
  const left = (footprint * TILE_UNIT - GAME_WIDTH) / 2;
  return { left, right: left + GAME_WIDTH };
}

/** When the tile at `depth` engages, in seconds from the start of the level. Depth 0 engages immediately. */
export function tileEngageSec(depth: number): number {
  return (depth * TILE_UNIT) / LEVEL_SCROLL_SPEED;
}

/** Seconds from one tile engaging to the next — how long a tile "owns" the front of the level. */
export function secondsPerTile(): number {
  return TILE_UNIT / LEVEL_SCROLL_SPEED;
}

/**
 * How long a tile lasts from the moment it engages until it has scrolled
 * entirely past the bottom of the screen. It starts a full tile-height
 * above the view and has to travel that plus a whole screen height to
 * clear — so this, not `secondsPerTile`, is the window an encounter
 * authored on that tile actually gets.
 */
export function tileLifespanSec(): number {
  return (TILE_UNIT + GAME_HEIGHT) / LEVEL_SCROLL_SPEED;
}

/** True once the tile has scrolled entirely past the bottom of the screen, `t` seconds after engaging. */
export function tileFullyOffScreen(t: number): boolean {
  return tileLocalToScreenY(0, t) >= GAME_HEIGHT;
}
