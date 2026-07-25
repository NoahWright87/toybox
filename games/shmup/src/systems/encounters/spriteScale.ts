/**
 * How big an authored Unit draws, and how its Parts sit on it.
 *
 * The authored data pins **collision** size (`UnitDef.size`, a hitbox
 * radius) but never display size — the editor's encounter canvas draws
 * fixed-size touch-target icons and says so ("sprite thumbnails sized for
 * touch targets, not real scale"). So display size has to be derived, and
 * the only authored number that actually describes how big a thing is is
 * `size`. Display size is therefore `size * artToHitboxRatio`, which keeps
 * the relative sizes an author gave their roster (a battleship at `size` 34
 * really does draw ~2x a helicopter at 16) and keeps the shmup-standard
 * "hitbox is smaller than the ship" relationship consistent across every
 * Unit instead of varying with whatever PNG canvas the art arrived on.
 *
 * **Part offsets are authored against a 150px body**, because that's the
 * box `PartPositionEditor.tsx` renders the body sprite into at a flat 1:1
 * px-per-offset-unit mapping. Scaling an offset by
 * `displaySize / EDITOR_BODY_BOX` reproduces exactly what the author
 * dragged, at whatever size the Unit ends up drawing — the battleship's
 * four turrets land on its four barbettes either way.
 *
 * Art faces **north** (the sprites are drawn nose-up; see
 * `public/shmup-editor/enemies/`), while the angle convention everywhere
 * else here is 0 = +x/east, 90 = +y/south. `ART_FACING_DEG` is the bridge:
 * a Unit facing 90 (south, straight at the player — the editor's default
 * `fixedFacingDeg`) renders rotated a half turn.
 */
import { TUNING } from "../../tuning";

/** `PartPositionEditor.tsx`'s `BODY_BOX` — the px box a Unit's body renders into while dragging Part offsets. */
export const EDITOR_BODY_BOX = 150;

/** `PartPositionEditor.tsx`'s `PART_BOX` — the px box a Part's own sprite renders into inside that body box. */
export const EDITOR_PART_BOX = 64;

/** Direction the authored art is drawn pointing, in the 0 = +x / 90 = +y convention. North/up. */
export const ART_FACING_DEG = -90;

/** Longest-side display size (px) for a Unit with hitbox radius `size`. */
export function unitDisplaySize(size: number): number {
  return Math.max(1, size) * TUNING.encounters.artToHitboxRatio;
}

/** Multiplier taking an authored Part offset (or Part sprite size) from the editor's 150px body box into this Unit's real display size. */
export function partScaleFor(displaySize: number): number {
  return displaySize / EDITOR_BODY_BOX;
}

/** Phaser rotation (radians) that points art drawn facing `ART_FACING_DEG` along `facingDeg`. */
export function facingToRotation(facingDeg: number): number {
  return ((facingDeg - ART_FACING_DEG) * Math.PI) / 180;
}
