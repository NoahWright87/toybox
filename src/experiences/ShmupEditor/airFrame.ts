/**
 * Air vs. ground authoring frames — the editor half of the runtime's
 * scroll-locked/time-locked reference-frame split.
 *
 * `games/shmup` already ships this behavior (`EncounterRunner.ts`'s
 * `isScrollLocked` / `pinnedOriginY`, documented in
 * `specs/games/shmup/authored-encounters.spec.md`). What did *not* exist was
 * any way to see it while authoring: the Encounter canvas drew every
 * instance against one tile-local frame regardless of `UnitDef.layer`, so an
 * aircraft and a turret looked identical in the editor and behaved
 * completely differently in the game. That is exactly the drift
 * `scrollModel.ts` exists to prevent, one level up — hence this module
 * mirrors the runtime's rule rather than inventing an editor-side one.
 *
 * ## The rule (copied from the runtime, not re-derived)
 *
 * - **Ground and doodad are scroll-locked.** Their authored position
 *   resolves against the live tile frame forever — a turret is bolted to the
 *   terrain and rides it off the bottom of the screen.
 * - **Air is time-locked, but not from spawn.** At a tile's clock zero its
 *   north edge is a full `TILE_UNIT` above the screen, so pinning an air
 *   unit's frame at spawn would strand it off-screen forever. An air unit
 *   therefore tracks the scrolling frame exactly like a ground unit **until
 *   it is first genuinely on screen**, and pins there. It still enters on
 *   cue where the author drew it; from that moment the only thing moving it
 *   is its own authored path.
 *
 * ## What this module does *not* change
 *
 * **Authored positions stay tile-local in the saved data.** Air mode is a
 * view transform, never a coordinate-system change: `displayShiftY` is a
 * rigid vertical translation applied at render time only. Two consequences
 * worth stating, because both would be bugs if it were done the other way:
 *
 * 1. The runtime resolves air positions *through the tile frame* (pinning
 *    freezes that frame's origin — it does not switch coordinate systems).
 *    Storing viewport-relative positions would contradict it.
 * 2. A rigid translation preserves arc length, so every derived step time
 *    (`encounterTiming.ts`, `bezier.ts`'s `cubicBezierLength`) is unaffected
 *    by which mode you authored in. No save-version bump, no migration.
 */
import { computeInstancePreview } from "./movementPreview";
import { cameraLocalBand, cameraLocalXBand, LEVEL_SCROLL_SPEED, tileLifespanSec } from "../../../games/shmup/src/systems/encounters/scrollModel";
import type { EncounterUnit } from "./encounterTypes";
import type { UnitDef, UnitLayer } from "./unitTypes";

/**
 * Which authoring frame a Unit belongs to. Deliberately two-valued while
 * `UnitLayer` is three-valued: doodad is scroll-locked exactly like ground
 * (`isScrollLocked` below), so it shares ground's frame and there is nothing
 * for a third mode to show differently.
 */
export type AuthorLayer = "ground" | "air";

/** Mirrors `EncounterRunner.ts`'s own `isScrollLocked` — air is the only layer that decouples from the scrolling tile frame. */
export function isScrollLocked(layer: UnitLayer): boolean {
  return layer !== "air";
}

/** Which authoring frame a Unit's layer puts it in. Doodad rides with ground; see `AuthorLayer`. */
export function authorLayerOf(layer: UnitLayer): AuthorLayer {
  return layer === "air" ? "air" : "ground";
}

/** How far the level has scrolled, in world units, `t` seconds after the tile engaged. Negative times clamp to 0 — nothing has scrolled before the encounter starts. */
export function scrollOffsetY(t: number): number {
  return LEVEL_SCROLL_SPEED * Math.max(0, t);
}

/**
 * Sampling interval for `computePinTimeSec`. 50ms is ~9 world units of
 * scroll at `LEVEL_SCROLL_SPEED` — far finer than the pin moment can be
 * perceived at, and cheap enough to sample a whole tile lifespan per
 * instance.
 */
export const PIN_SAMPLE_SEC = 0.05;

/**
 * How far out to look for an instance's pin moment. Deliberately past the
 * encounter's own last step: a unit authored well above the tile may not
 * reach the camera until several seconds after its path has finished, and
 * stopping the search at the last step time would report "never pins" for
 * exactly the units that most need the air treatment.
 */
export function pinHorizonSec(maxTime: number): number {
  return maxTime + tileLifespanSec();
}

/**
 * The encounter time at which an air instance first becomes genuinely
 * visible — the moment the runtime pins its frame — or `null` if the scroll
 * never brings it on screen at all (in which case it rides the tile forever,
 * same as a ground unit, which is what the runtime does too).
 *
 * Sampled rather than solved: the path is a cubic bezier and the camera band
 * is a moving window, so there is no closed form. The runtime effectively
 * samples this per frame; this samples at `PIN_SAMPLE_SEC`.
 *
 * **Deliberately uses the *pre-pin* trajectory** — an authored tile-local
 * position, unshifted — because that is precisely how the unit moves before
 * it pins. Feeding a post-pin position back in would be circular.
 *
 * **Deliberately uses committed positions** (whatever is in `instance`), not
 * a live drag override. Recomputing the pin mid-drag would move the frame
 * the dragged node is being positioned in, which reads as the canvas sliding
 * under your finger — the same reasoning `EncounterEditor.tsx`'s bounding
 * box already applies to `minX`/`minY`.
 */
export function computePinTimeSec(
  instance: EncounterUnit,
  unitDef: UnitDef | undefined,
  footprint: number,
  horizonSec: number,
  sampleSec: number = PIN_SAMPLE_SEC
): number | null {
  if (!unitDef) return null;
  const first = instance.steps[0];
  if (!first) return null;
  const xBand = cameraLocalXBand(footprint);
  const stride = Math.max(sampleSec, 1e-3);
  for (let t = Math.max(0, first.time); t <= horizonSec; t += stride) {
    const preview = computeInstancePreview(instance, unitDef, t);
    if (!preview) continue;
    if (preview.pos.x < xBand.left || preview.pos.x > xBand.right) continue;
    // The camera's band of tile-local y climbs the tile as the level
    // scrolls, so containment has to be tested against the band at *this*
    // instant, not a fixed rectangle.
    const band = cameraLocalBand(t);
    if (preview.pos.y < band.top || preview.pos.y > band.bottom) continue;
    return t;
  }
  return null;
}

/**
 * The **pin term**: how far an instance has decoupled from the tile frame,
 * in the tile's own coordinates, at time `t`. Zero for anything
 * scroll-locked, and zero for an air unit that hasn't pinned yet (the
 * fly-in). After the pin it cancels the scroll, so the unit holds screen
 * position while the terrain keeps moving.
 *
 * **This, not `displayShiftY`, is what geometry math wants.** Adding it to
 * an authored position yields the instance's *effective* tile-local
 * position — physically where it is in the tile's frame right now — which
 * is the space the player marker, attack anchors and `facePlayer` aim all
 * already live in. `displayShiftY` adds a second, mode-dependent term that
 * translates the entire scene uniformly, so it must not be double-counted
 * into relative geometry.
 */
export function pinShiftY(scrollLocked: boolean, pinSec: number | null, t: number): number {
  if (scrollLocked || pinSec === null) return 0;
  return -scrollOffsetY(t - pinSec);
}

export interface DisplayShiftArgs {
  /** Which frame the canvas is currently drawn in. */
  mode: AuthorLayer;
  /** Whether the thing being positioned rides the tile (`isScrollLocked`). Reference geometry that belongs to the tile — the frame itself — passes `true`. */
  scrollLocked: boolean;
  /** `computePinTimeSec` for this instance; ignored when `scrollLocked`. */
  pinSec: number | null;
  /** Current scrub time. */
  t: number;
}

/**
 * The vertical offset to add to an authored tile-local position to render it
 * in the current mode, at the current scrub time.
 *
 * Two terms, and it's worth being explicit about both since the interesting
 * behavior is entirely in how they interact:
 *
 * - **The mode term** (`+scroll(t)` in air mode, `0` in ground mode) is what
 *   pins the camera. Ground mode draws tile-local space directly, so the
 *   tile is static and the camera box climbs it. Air mode adds back exactly
 *   the scroll the camera band subtracts, which holds the camera still and
 *   slides the terrain down through it instead.
 * - **The pin term** (`-scroll(t - pinSec)`, air layers only) is the
 *   decoupling. Before the pin it's zero, so an air unit rides the tile in
 *   both modes — that's the fly-in, and it's the part authors most often get
 *   wrong. After the pin it cancels the scroll, so the unit holds screen
 *   position.
 *
 * The four combinations that fall out:
 *
 * | | ground mode | air mode |
 * |---|---|---|
 * | tile / ground unit | static | slides down past a fixed camera |
 * | air unit, pre-pin | rides the tile | rides the tile (descends into view) |
 * | air unit, post-pin | drifts *up* the tile as terrain passes beneath | holds still |
 */
export function displayShiftY({ mode, scrollLocked, pinSec, t }: DisplayShiftArgs): number {
  return pinShiftY(scrollLocked, pinSec, t) + referenceShiftY(mode, t);
}

/**
 * The shift for anything belonging to the tile itself rather than to a
 * placed instance — the tile frame, the camera bounds box, the player
 * reference marker. Identical to a scroll-locked instance's shift; named
 * separately because "the tile is scroll-locked" reads oddly at call sites.
 *
 * Note this makes the camera box and the player marker *constant* in air
 * mode: both already compute a tile-local position that moves by
 * `-scroll(t)`, and this adds exactly that back.
 */
export function referenceShiftY(mode: AuthorLayer, t: number): number {
  return mode === "air" ? scrollOffsetY(t) : 0;
}
