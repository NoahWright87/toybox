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
 */
import { PREVIEW_BULLET_LIFE_MS, PREVIEW_BULLET_SPEED, sweepOffsetDeg, shotAngleOffsets, type PreviewBullet } from "./weaponPreview";
import type { EncounterAttack, Vec2 } from "./encounterTypes";
import type { UnitDef, WeaponDef } from "./unitTypes";

/** Mirrors games/shmup/src/config.ts's GAME_WIDTH/GAME_HEIGHT (720x1280, portrait) — the aspect ratio of what's actually visible on screen at once. Used to size the dotted "camera/playable bounds" overlay relative to the tile's own width, per levels-and-tiles.spec.todo.md §4 ("the camera framing... show[s] more/less active width", i.e. camera width tracks the tile, not a fixed independent value). */
export const GAME_ASPECT_RATIO = 1280 / 720;

/** Mirrors games/shmup/src/tuning/index.ts's TUNING.combat.hitboxRadiusNormal — the player ship's real collision radius at normal (non-Focus) speed. Independently maintained, not imported (see file header). */
export const PLAYER_REFERENCE_HITBOX_RADIUS = 6;

/** Fallback hitbox radius for a bullet whose weapon's `spawnUnitId` doesn't resolve to a real Unit (e.g. mid-authoring, or the Unit was since deleted) — roughly the seeded default Bullet's own `size`, so an unresolvable reference still reads as "small," not invisible or huge. */
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
 * Aim angle (degrees) for one attack's weapon, resolved the same way
 * `EncounterEditor.tsx` already resolves it for the draggable aim-handle
 * (`aimAngleOverride ?? weapon.fixedAngleDeg`) — except for a
 * `"player"`-aimed weapon, which has no fixed angle to fall back to. The
 * standalone `WeaponForm.tsx` preview has no reference point for that
 * case at all (no live player exists while just browsing the picker); this
 * preview does have one (the player reference marker), so it aims at it —
 * a real improvement over the isolated preview's approximation, not just
 * a repeat of it.
 */
export function resolveAttackAimDeg(attack: Pick<EncounterAttack, "aimAngleOverride">, weapon: Pick<WeaponDef, "aimMode" | "fixedAngleDeg">, anchor: Vec2, playerRef: Vec2): number {
  if (weapon.aimMode === "player") {
    return (Math.atan2(playerRef.y - anchor.y, playerRef.x - anchor.x) * 180) / Math.PI;
  }
  return attack.aimAngleOverride ?? weapon.fixedAngleDeg;
}

/**
 * Bullet dots (relative offsets from the firing anchor — add the anchor's
 * own world position to get absolute placement) currently in flight from
 * one `EncounterAttack` placement, `elapsedMs` after that attack's own
 * `time`, fired at absolute angle `aimDeg` (see `resolveAttackAimDeg`).
 * Reuses `weaponPreview.ts`'s actual per-shot math (arc offsets, sweep,
 * travel speed/life) but — unlike that file's `computePreviewBullets` —
 * does NOT loop forever. `WeaponForm.tsx`'s preview loops indefinitely so
 * a single-burst weapon keeps demonstrating itself while you're just
 * browsing the picker; a real `EncounterAttack` placement fires exactly as
 * authored — a single burst when `durationMs === 0` (per its own doc
 * comment), otherwise repeating every `weapon.fireIntervalMs` only while
 * still within `durationMs`. Looping this the same way the standalone
 * preview does would make every attack look like it fires forever, which
 * is exactly the kind of density/fairness misread this preview exists to
 * catch, not reproduce.
 */
export function computeAttackBullets(weapon: WeaponDef, aimDeg: number, durationMs: number, elapsedMs: number): PreviewBullet[] {
  if (elapsedMs < 0) return [];
  const repeats = durationMs > 0 && weapon.fireIntervalMs > 0;
  const period = repeats ? weapon.fireIntervalMs : null;
  const offsets = shotAngleOffsets(weapon);
  const bullets: PreviewBullet[] = [];

  const cycleStarts: number[] = period === null ? [0] : (() => {
    const last = Math.min(durationMs, Math.floor(elapsedMs / period) * period);
    return [last, last - period];
  })();

  for (const cycleStart of cycleStarts) {
    if (cycleStart < 0 || cycleStart > durationMs) continue;
    const sweepAtBurst = sweepOffsetDeg(weapon, cycleStart);
    offsets.forEach((offsetDeg, i) => {
      const spawnMs = cycleStart + i * weapon.perShotDelayMs;
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

/** Looks up the real hitbox radius a weapon's spawned projectile should render at — the `size` of whatever Unit `spawnUnitId` resolves to, or the documented fallback when it doesn't resolve. */
export function resolveBulletRadius(weapon: Pick<WeaponDef, "spawnUnitId">, units: UnitDef[]): number {
  const spawned = weapon.spawnUnitId ? units.find((u) => u.id === weapon.spawnUnitId) : undefined;
  return spawned?.size ?? DEFAULT_BULLET_HITBOX_RADIUS;
}
