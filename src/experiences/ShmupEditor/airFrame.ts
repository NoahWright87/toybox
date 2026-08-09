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
 * - **Air is time-locked from the moment it spawns.** An aircraft is not
 *   attached to the terrain at any point, so its authored route is a route
 *   *through the screen*: whatever the author drew is where it flies,
 *   full stop, and nothing but its own path ever moves it.
 *
 * ## Air used to pin at first visibility, and that was wrong
 *
 * The previous rule had an air unit ride the scrolling tile frame until it
 * first became genuinely visible and pin *there*, on the reasoning that a
 * unit authored high in the tile starts above the screen and needs the
 * scroll to carry it in. What that actually produced was a route that
 * slid for the first few seconds and then stopped sliding — so the path an
 * author drew was not the path that got flown, and scrubbing the timeline
 * showed the whole thing drifting (Noah: "the routes shifted... I never
 * asked for that, and it doesn't make any sense. I want to design where
 * the air units will be on-screen as they fly around").
 *
 * Pinning at spawn instead makes an air route rigid: it renders in exactly
 * one place for every scrub time, and the author positions it against the
 * camera box in Air mode. The case the old rule existed to serve — flying
 * in from off-screen — is now simply *drawn*: put the first waypoint above
 * the camera box and the second one inside it. That is both more
 * predictable and more expressive, since the entrance becomes something
 * you author rather than something the scroll does to you.
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
import { LEVEL_SCROLL_SPEED } from "../../../games/shmup/src/systems/encounters/scrollModel";
import type { EncounterUnit } from "./encounterTypes";
import type { UnitLayer } from "./unitTypes";

/**
 * Which authoring frame a Unit belongs to — one per `UnitLayer`.
 *
 * **This used to be two-valued, folding doodad in with ground**, on the
 * reasoning that the two share a reference frame (both are scroll-locked, see
 * `isScrollLocked`) and so a third mode would have nothing to draw
 * differently. That was true about the *geometry* and wrong about the
 * *authoring*: it left every doodad in the ground roster, so placing a few
 * trees meant scrolling past them to find the tank, and there was no way to
 * pick a tile's scenery separately from its ground opposition. A frame is
 * really two things at once — a reference frame and a roster — and doodad
 * only ever matched ground on the first.
 *
 * So doodad mode renders exactly like ground mode (`referenceShiftY` returns
 * the same 0 for both) and differs only in which Units it offers and which
 * ones it dims. That is the intended shape, not an oversight.
 */
export type AuthorLayer = UnitLayer;

/** Mirrors `EncounterRunner.ts`'s own `isScrollLocked` — air is the only layer that decouples from the scrolling tile frame. */
export function isScrollLocked(layer: UnitLayer): boolean {
  return layer !== "air";
}

/** How far the level has scrolled, in world units, `t` seconds after the tile engaged. Negative times clamp to 0 — nothing has scrolled before the encounter starts. */
export function scrollOffsetY(t: number): number {
  return LEVEL_SCROLL_SPEED * Math.max(0, t);
}

/**
 * The encounter time an air instance's frame is pinned at: **the moment it
 * spawns**, which is its first step's own time. No search, no sampling —
 * see the file header on why this replaced a scan for first visibility.
 *
 * `null` when the instance has no steps at all (nothing to pin), or for a
 * scroll-locked layer, which never decouples.
 */
export function airPinSec(instance: EncounterUnit, layer: UnitLayer | undefined): number | null {
  if (layer === undefined || isScrollLocked(layer)) return null;
  const first = instance.steps[0];
  return first ? first.time : null;
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
  // Deliberately **not** clamped at the pin the way `scrollOffsetY` clamps at
  // zero. An air route is rigid in screen space at every scrub time, including
  // before the instance spawns; clamping would let the drawn path slide around
  // ahead of its own spawn moment, which is the exact behavior this rule
  // exists to remove.
  return -LEVEL_SCROLL_SPEED * (t - pinSec);
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
 *   decoupling, and since an air unit pins at spawn it applies for the
 *   instance's whole life. It cancels the scroll exactly, so the unit holds
 *   screen position from the first frame to the last.
 *
 * The combinations that fall out:
 *
 * | | ground mode | air mode |
 * |---|---|---|
 * | tile / ground unit | static | slides down past a fixed camera |
 * | air unit | drifts *up* the tile as terrain passes beneath | **holds still** |
 *
 * That bottom-right cell is the whole point: in Air mode an authored air
 * route is drawn in one fixed place, so what you draw is what it flies.
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
 *
 * Air is the only mode with a nonzero term, so ground and doodad mode draw
 * identically — see `AuthorLayer` on why doodad is still its own mode.
 */
export function referenceShiftY(mode: AuthorLayer, t: number): number {
  return mode === "air" ? scrollOffsetY(t) : 0;
}
