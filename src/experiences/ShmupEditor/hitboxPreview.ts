/**
 * Pure geometry for the Encounter canvas's low-fi hitbox/boundary preview
 * mode (E4, specs/shmup-editor.todo.md — "editor-side timeline playback,
 * not real Phaser"). This is a *readability/fairness* check layered on
 * top of the timeline scrubber that already exists (`EncounterEditor.tsx`'s
 * `scrubTime`/`playing`): instead of the big authoring icons (sprite
 * thumbnails sized for touch targets, not real scale), it shows enemies
 * and bullets at their actual authored hitbox size, plus reference
 * geometry (tile bounds, playable/camera bounds, a player hitbox
 * reference) — so "does a full-count line still fit the tile and still
 * read clearly" is something you can actually look at, not just guess at
 * from numbers.
 *
 * Same "no shared code with the game" stance the rest of the editor
 * takes — `games/shmup` doesn't exist as an importable package from here,
 * so the handful of real-game constants this needs (screen aspect ratio,
 * the player's own hitbox radius) are independently declared below and
 * documented against their real-game source, not imported.
 *
 * **Operates on `ActionAttack`/`ActionDef` now, not a standalone
 * `WeaponDef`** — Actions are back (unitTypes.ts). An attack's aim comes
 * from the owning Action's `facing`, not a separate aim mode; its
 * duration is computed from `repeatCount`/`burstIntervalMs`/etc rather
 * than authored per-placement (`computeAttackDurationMs`).
 */
import { PREVIEW_BULLET_LIFE_MS, PREVIEW_BULLET_SPEED, sweepOffsetDeg, shotAngleOffsets, type PreviewBullet } from "./actionPreview";
import type { Vec2 } from "./encounterTypes";
import type { ActionAttack, ActionDef, UnitDef } from "./unitTypes";

/** Mirrors games/shmup/src/config.ts's GAME_WIDTH/GAME_HEIGHT (720x1280, portrait) — the aspect ratio of what's actually visible on screen at once. Used to size the dotted "camera/playable bounds" overlay relative to the tile's own width, per levels-and-tiles.spec.todo.md §4 ("the camera framing... show[s] more/less active width", i.e. camera width tracks the tile, not a fixed independent value). */
export const GAME_ASPECT_RATIO = 1280 / 720;

/** Mirrors games/shmup/src/tuning/index.ts's TUNING.combat.hitboxRadiusNormal — the player ship's real collision radius at normal (non-Focus) speed. Independently maintained, not imported (see file header). */
export const PLAYER_REFERENCE_HITBOX_RADIUS = 6;

/** Fallback hitbox radius for a bullet whose attack's `spawnUnitId` doesn't resolve to a real Unit (e.g. mid-authoring, or the Unit was since deleted) — roughly the seeded default Bullet's own `size`, so an unresolvable reference still reads as "small," not invisible or huge. */
export const DEFAULT_BULLET_HITBOX_RADIUS = 6;

/**
 * A dotted "how much of the tile is visible on screen at once" reference
 * rectangle, in the same coordinate space as `tileRect` (world or stage —
 * whichever `tileRect` is already in). Width matches the tile's own width
 * (per the aspect-ratio note above); height is derived from the real
 * game's portrait aspect ratio and vertically centered on the tile. This
 * is a static approximation — the real game's playable-bounds box eases
 * between sections (levels-and-tiles.spec.todo.md §4), which this preview
 * doesn't attempt to animate.
 */
export function computeCameraBoundsRect(tileRect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
  const height = tileRect.width * GAME_ASPECT_RATIO;
  return { x: tileRect.x, y: tileRect.y + (tileRect.height - height) / 2, width: tileRect.width, height };
}

/**
 * Facing angle (degrees) for an Action, resolved the same way
 * `ActionPreview.tsx` does for `"fixed"`/`"facePlayer"` — except this
 * preview has real context an isolated authoring form doesn't: a real
 * player reference marker to aim at, and (for `"faceMovement"`) the
 * instance's own actual direction of travel at this instant
 * (`movementPreview.ts`'s `computeInstanceHeadingDeg`) instead of a fixed
 * stand-in.
 */
export function resolveActionFacingDeg(action: Pick<ActionDef, "facing" | "fixedFacingDeg">, anchor: Vec2, playerRef: Vec2, movementHeadingDeg: number): number {
  if (action.facing === "facePlayer") return (Math.atan2(playerRef.y - anchor.y, playerRef.x - anchor.x) * 180) / Math.PI;
  if (action.facing === "faceMovement") return movementHeadingDeg;
  return action.fixedFacingDeg;
}

/**
 * How long (ms) an Action's attack takes to complete its bursts —
 * `null` = indefinite (fires for as long as the Action itself keeps
 * running — a Final Action's unbounded repeat). Per unitTypes.ts's
 * ActionDef doc, this is always *computed*, never hand-authored: the
 * telegraph wind-up, plus every burst-to-burst gap after the first, plus
 * the last burst's own internal per-shot delays.
 */
export function computeAttackDurationMs(attack: Pick<ActionAttack, "repeatCount" | "burstIntervalMs" | "telegraphMs" | "count" | "perShotDelayMs">): number | null {
  if (attack.repeatCount === null) return null;
  const bursts = Math.max(1, attack.repeatCount);
  return attack.telegraphMs + (bursts - 1) * attack.burstIntervalMs + Math.max(0, attack.count - 1) * attack.perShotDelayMs;
}

/**
 * Bullet dots (relative offsets from the firing anchor — add the anchor's
 * own world position to get absolute placement) currently in flight from
 * one Action's attack, `elapsedMs` after that placement's own `time`,
 * fired at absolute angle `aimDeg` (see `resolveActionFacingDeg`). Reuses
 * `actionPreview.ts`'s actual per-shot math (arc offsets, sweep, travel
 * speed/life) but — unlike that file's `computePreviewBullets` — does NOT
 * loop forever when `durationMs` is a real (non-null) number.
 * `ActionForm.tsx`'s preview loops indefinitely so a single-burst attack
 * keeps demonstrating itself while you're just browsing the picker; a real
 * placement fires exactly as authored — a single burst when
 * `computeAttackDurationMs` resolves to 0, otherwise repeating every
 * `attack.burstIntervalMs` only while still within that computed duration
 * (or forever, for a `null`/indefinite duration — a Final Action).
 */
export function computeAttackBullets(attack: ActionAttack, aimDeg: number, durationMs: number | null, elapsedMs: number): PreviewBullet[] {
  if (elapsedMs < 0) return [];
  const repeats = (durationMs === null || durationMs > 0) && attack.burstIntervalMs > 0;
  const period = repeats ? attack.burstIntervalMs : null;
  const offsets = shotAngleOffsets(attack);
  const bullets: PreviewBullet[] = [];

  const cycleStarts: number[] =
    period === null
      ? [0]
      : (() => {
          const rawLast = Math.floor(elapsedMs / period) * period;
          const last = durationMs === null ? rawLast : Math.min(durationMs, rawLast);
          return [last, last - period];
        })();

  for (const cycleStart of cycleStarts) {
    if (cycleStart < 0) continue;
    if (durationMs !== null && cycleStart > durationMs) continue;
    const sweepAtBurst = sweepOffsetDeg(attack, cycleStart);
    offsets.forEach((offsetDeg, i) => {
      const spawnMs = cycleStart + i * attack.perShotDelayMs;
      const age = elapsedMs - spawnMs;
      if (age < 0 || age > PREVIEW_BULLET_LIFE_MS) return;
      const angleRad = ((aimDeg + sweepAtBurst + offsetDeg) * Math.PI) / 180;
      const dist = (PREVIEW_BULLET_SPEED * age) / 1000;
      const alpha = 1 - age / PREVIEW_BULLET_LIFE_MS;
      bullets.push({ x: Math.cos(angleRad) * dist, y: Math.sin(angleRad) * dist, alpha });
    });
  }
  return bullets;
}

/** Looks up the real hitbox radius an attack's spawned projectile should render at — the `size` of whatever Unit `spawnUnitId` resolves to, or the documented fallback when it doesn't resolve. */
export function resolveBulletRadius(attack: Pick<ActionAttack, "spawnUnitId">, units: UnitDef[]): number {
  const spawned = attack.spawnUnitId ? units.find((u) => u.id === attack.spawnUnitId) : undefined;
  return spawned?.size ?? DEFAULT_BULLET_HITBOX_RADIUS;
}
