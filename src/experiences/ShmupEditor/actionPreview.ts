/**
 * Pure simulation for `ActionForm.tsx`'s live bullet-pattern preview —
 * renamed/adapted from the pre-Actions-reversal `weaponPreview.ts` (Noah's
 * original request still holds: "a small preview showing what the weapon
 * would do would be absolutely killer... shmups are very visual games").
 * Computes bullet dot positions as a function of elapsed time, the same
 * "declarative, recomputed from scratch every frame" shape as
 * `movementPreview.ts`'s `computeInstancePreview` rather than accumulating
 * mutable simulation state — recomputing is cheap at this scale and avoids
 * any state to reset when a form field changes mid-preview.
 *
 * This operates on `ActionAttack` (unitTypes.ts) now, not a standalone
 * `WeaponDef` — an Action's attack is just one field of a richer whole, but
 * everything the bullet pattern itself needs (arc/count/spacing/sweep/
 * burst timing/spawn) still lives on that one sub-object, so the pure math
 * below is unchanged from before the reversal.
 *
 * This is a *representative* visualization, not a physics simulation
 * matching the eventual game runtime (which doesn't exist yet — same "no
 * shared code with the game" stance the rest of the editor takes): bullet
 * travel speed is a fixed preview constant, not derived from whatever Unit
 * `spawnUnitId` points at (that Unit might not even be resolvable while
 * just browsing the picker), and a single-burst attack (`burstIntervalMs
 * === 0`) still loops every `PREVIEW_LOOP_FALLBACK_MS` so the preview keeps
 * demonstrating the pattern instead of firing once and going static.
 */
import type { ActionAttack } from "./unitTypes";

export const PREVIEW_BULLET_SPEED = 90; // px/sec
export const PREVIEW_BULLET_LIFE_MS = 1400;
export const PREVIEW_LOOP_FALLBACK_MS = 1500;
/** ActionAttack has no dedicated sweep-amplitude field; ping-pong needs *some* fixed swing to oscillate within, so this is a documented preview-only choice, not derived from authored data. */
export const SWEEP_PINGPONG_AMPLITUDE_DEG = 90;
/** Wind-up window right before a burst fires, visualized as the shooter dot glowing — mirrors the timeline's telegraph-color concept (specs/shmup-editor.md's Warning Indicators section) at preview scale. */
export const TELEGRAPH_GLOW_THRESHOLD = 1;

export interface PreviewBullet {
  x: number;
  y: number;
  /** 1 = freshly spawned, fading toward 0 near end of life — lets the renderer draw a trail-like fade instead of bullets popping out of existence. */
  alpha: number;
}

/** How often a burst repeats — real for `burstIntervalMs > 0`, a fallback loop period otherwise so the preview never just fires once and stops. */
export function burstPeriodMs(attack: Pick<ActionAttack, "burstIntervalMs">): number {
  return attack.burstIntervalMs > 0 ? attack.burstIntervalMs : PREVIEW_LOOP_FALLBACK_MS;
}

/** 0..1 -> 0..1 triangle wave, peaking at phase 0.5 — used to turn a linear sweep into a back-and-forth ping-pong. */
function triangleWave01(phase01: number): number {
  return phase01 < 0.5 ? phase01 * 2 : 2 - phase01 * 2;
}

/** Deterministic pseudo-random in [0, 1) from an integer index — stable across repeated calls with the same index (unlike Math.random()), so "random" spacing doesn't jitter to a new layout every animation frame. */
function stableRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** The whole arc's rotation offset (degrees) at `elapsedMs`, relative to its resting position — 0 when `sweepSpeedDeg` is 0 (a static arc). */
export function sweepOffsetDeg(attack: Pick<ActionAttack, "sweepSpeedDeg" | "pingPong">, elapsedMs: number): number {
  if (attack.sweepSpeedDeg === 0) return 0;
  const elapsedSec = elapsedMs / 1000;
  if (!attack.pingPong) return attack.sweepSpeedDeg * elapsedSec;
  const speed = Math.abs(attack.sweepSpeedDeg);
  const periodSec = (4 * SWEEP_PINGPONG_AMPLITUDE_DEG) / speed;
  const phase01 = ((elapsedSec % periodSec) + periodSec) % periodSec / periodSec;
  return SWEEP_PINGPONG_AMPLITUDE_DEG * (2 * triangleWave01(phase01) - 1);
}

/** Each shot's angle offset (degrees, relative to the aim direction) within one burst — `count` values spread across `[arcStartDeg, arcEndDeg]`, evenly or pseudo-randomly per `spacing`. */
export function shotAngleOffsets(attack: Pick<ActionAttack, "count" | "arcStartDeg" | "arcEndDeg" | "spacing">): number[] {
  const { count, arcStartDeg, arcEndDeg, spacing } = attack;
  if (count <= 1) return [(arcStartDeg + arcEndDeg) / 2];
  if (spacing === "random") {
    return Array.from({ length: count }, (_, i) => arcStartDeg + stableRandom01(i + 1) * (arcEndDeg - arcStartDeg));
  }
  return Array.from({ length: count }, (_, i) => arcStartDeg + (i * (arcEndDeg - arcStartDeg)) / (count - 1));
}

/** True while a burst's telegraph wind-up is active, just before it fires at `elapsedMs`'s current loop cycle. */
export function isTelegraphing(attack: Pick<ActionAttack, "burstIntervalMs" | "telegraphMs">, elapsedMs: number): boolean {
  if (attack.telegraphMs <= 0) return false;
  const period = burstPeriodMs(attack);
  const phase = ((elapsedMs % period) + period) % period;
  return phase >= period - attack.telegraphMs;
}

/** Every bullet dot's current render position at `elapsedMs`, given the attack's config and an absolute aim angle (degrees, 0 = +x/right, 90 = +y/down — the owning Action's resolved `facing`). Returns `[]` while nothing is mid-flight. */
export function computePreviewBullets(attack: ActionAttack, aimDeg: number, elapsedMs: number): PreviewBullet[] {
  const period = burstPeriodMs(attack);
  const offsets = shotAngleOffsets(attack);
  const bullets: PreviewBullet[] = [];

  // A bullet spawned by the *previous* cycle's burst can still be mid-flight into the current cycle, so check the current cycle and the one before it.
  for (const cycleStart of [Math.floor(elapsedMs / period) * period, Math.floor(elapsedMs / period) * period - period]) {
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
