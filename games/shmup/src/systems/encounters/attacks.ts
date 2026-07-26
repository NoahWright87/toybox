/**
 * The firing schedule for an authored Action's attack — which shots are due
 * in a given slice of that Action's own elapsed time, and at what angle.
 *
 * The editor's `actionPreview.ts` / `hitboxPreview.ts` answer a *different*
 * question with the same numbers: "where would bullets be right now if I
 * recomputed the whole pattern from scratch." That's the right shape for a
 * preview (nothing to reset when a form field changes mid-animation) and
 * the wrong shape for a game, where each shot becomes a real pooled entity
 * exactly once. So the arc/sweep/spacing math below is a faithful port, but
 * the top-level entry point is `dueShots(attack, fromMs, toMs)` — an
 * edge-triggered "what crossed the wire since last frame" query — rather
 * than the preview's level-triggered "sample the pattern at t."
 *
 * Timing, all relative to the moment the owning Action started:
 * - burst `k` starts at `telegraphMs + k * burstIntervalMs`
 * - shot `i` within a burst fires at `burstStart + i * perShotDelayMs`
 * - the sweep offset is sampled once **per burst**, at its start, so every
 *   shot in one burst shares an arc rotation (matching the editor preview)
 * - `repeatCount: null` means "keep firing as long as the Action runs" —
 *   the caller stops asking when the Action ends. A `burstIntervalMs` of 0
 *   fires exactly one burst regardless, since repeating at zero interval
 *   has no meaning (same guard the editor's preview applies).
 */
import type { AuthoredAttack } from "./authoredTypes";

/** ActionAttack has no sweep-amplitude field; ping-pong needs some fixed swing to oscillate within. Mirrors the editor's documented preview-only choice so authored ping-pong reads the same in both. */
export const SWEEP_PINGPONG_AMPLITUDE_DEG = 90;

/**
 * Hard ceiling on shots resolved from one `dueShots` call. A pathological
 * authored config (or a long frame hitch after a tab regains focus) must
 * not turn into an unbounded spawn burst — this bounds it the same way
 * `TUNING.weapons.maxForkedBulletsPerShot` bounds the player's side.
 */
export const MAX_SHOTS_PER_UPDATE = 64;

/**
 * How far through one Action's attack a single firing anchor has already
 * fired. Owned by whatever is doing the firing (a Unit's base track, or one
 * of its Parts'), advanced by `advanceAttackTrack`.
 */
export interface AttackTrack {
  /** Which Action is currently running here — a change restarts the schedule. */
  actionId: string | null;
  /** Encounter time (sec) the current Action started at. */
  startedAtSec: number;
  /** Milliseconds of that Action's own timeline already resolved into shots. */
  firedThroughMs: number;
}

export function freshAttackTrack(): AttackTrack {
  return { actionId: null, startedAtSec: 0, firedThroughMs: 0 };
}

/** One resolved shot: which burst/shot it belongs to, when it fired, and its angle offset from the Action's resolved facing. */
export interface ScheduledShot {
  burstIndex: number;
  shotIndex: number;
  /** Milliseconds since the owning Action started. */
  atMs: number;
  /** Degrees to add to the Action's resolved facing — arc position plus this burst's sweep rotation. */
  angleOffsetDeg: number;
}

/** 0..1 -> 0..1 triangle wave, peaking at phase 0.5 — turns a linear sweep into a back-and-forth ping-pong. */
function triangleWave01(phase01: number): number {
  return phase01 < 0.5 ? phase01 * 2 : 2 - phase01 * 2;
}

/** Deterministic pseudo-random in [0, 1) from an integer index — stable across calls, so "random" arc spacing is a fixed authored layout, not per-frame jitter. */
function stableRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** The whole arc's rotation offset (degrees) at `elapsedMs`, relative to its resting position. 0 when `sweepSpeedDeg` is 0. */
export function sweepOffsetDeg(attack: Pick<AuthoredAttack, "sweepSpeedDeg" | "pingPong">, elapsedMs: number): number {
  if (attack.sweepSpeedDeg === 0) return 0;
  const elapsedSec = elapsedMs / 1000;
  if (!attack.pingPong) return attack.sweepSpeedDeg * elapsedSec;
  const speed = Math.abs(attack.sweepSpeedDeg);
  const periodSec = (4 * SWEEP_PINGPONG_AMPLITUDE_DEG) / speed;
  const phase01 = (((elapsedSec % periodSec) + periodSec) % periodSec) / periodSec;
  return SWEEP_PINGPONG_AMPLITUDE_DEG * (2 * triangleWave01(phase01) - 1);
}

/** Each shot's angle offset (degrees, relative to the aim direction) within one burst — `count` values spread across the arc, evenly or pseudo-randomly. */
export function shotAngleOffsets(attack: Pick<AuthoredAttack, "count" | "arcStartDeg" | "arcEndDeg" | "spacing">): number[] {
  const { arcStartDeg, arcEndDeg, spacing } = attack;
  const count = Math.max(0, Math.floor(attack.count));
  if (count <= 0) return [];
  if (count === 1) return [(arcStartDeg + arcEndDeg) / 2];
  if (spacing === "random") {
    return Array.from({ length: count }, (_, i) => arcStartDeg + stableRandom01(i + 1) * (arcEndDeg - arcStartDeg));
  }
  return Array.from({ length: count }, (_, i) => arcStartDeg + (i * (arcEndDeg - arcStartDeg)) / (count - 1));
}

/** How many bursts this attack ever fires. `Infinity` = for as long as the owning Action runs. */
export function burstCount(attack: Pick<AuthoredAttack, "repeatCount" | "burstIntervalMs">): number {
  if (attack.burstIntervalMs <= 0) return 1; // repeating at a zero interval has no meaning
  if (attack.repeatCount === null) return Infinity;
  return Math.max(1, Math.floor(attack.repeatCount));
}

/** When burst `index` starts, in ms since the owning Action began. */
export function burstStartMs(attack: Pick<AuthoredAttack, "telegraphMs" | "burstIntervalMs">, index: number): number {
  return Math.max(0, attack.telegraphMs) + index * Math.max(0, attack.burstIntervalMs);
}

/**
 * True while a burst's telegraph wind-up is running at `elapsedMs` — the
 * visual tell, not a firing rule. Burst `k`'s wind-up occupies
 * `[k * burstIntervalMs, burstStartMs(k))`, which for burst 0 is exactly
 * `[0, telegraphMs)`.
 */
export function isTelegraphing(attack: Pick<AuthoredAttack, "telegraphMs" | "burstIntervalMs" | "repeatCount">, elapsedMs: number): boolean {
  if (attack.telegraphMs <= 0 || elapsedMs < 0) return false;
  const interval = Math.max(0, attack.burstIntervalMs);
  const index = interval > 0 ? Math.floor(elapsedMs / interval) : 0;
  if (index >= burstCount(attack)) return false;
  return elapsedMs < burstStartMs(attack, index);
}

/**
 * Every shot whose scheduled time falls in `[fromMs, toMs)`, in fire order.
 * The half-open window is what makes this safe to call every frame with
 * `from` = last frame's elapsed and `to` = this frame's: a shot scheduled
 * at exactly 0 fires on the first update, and no shot ever fires twice.
 */
export function dueShots(attack: AuthoredAttack, fromMs: number, toMs: number): ScheduledShot[] {
  if (toMs <= fromMs) return [];
  const offsets = shotAngleOffsets(attack);
  if (offsets.length === 0 || attack.spawnUnitId === null) return [];

  const bursts = burstCount(attack);
  const perShotDelay = Math.max(0, attack.perShotDelayMs);
  const burstSpan = perShotDelay * (offsets.length - 1);
  const interval = Math.max(0, attack.burstIntervalMs);

  // Only bursts whose own span can reach into the window are worth walking.
  const firstBurst = interval > 0 ? Math.max(0, Math.floor((fromMs - burstSpan - attack.telegraphMs) / interval)) : 0;

  const out: ScheduledShot[] = [];
  for (let k = firstBurst; k < bursts; k++) {
    const start = burstStartMs(attack, k);
    if (start >= toMs) break; // this burst and every later one are still in the future
    if (start + burstSpan < fromMs) continue; // wholly behind the window
    const sweep = sweepOffsetDeg(attack, start);
    for (let i = 0; i < offsets.length; i++) {
      const atMs = start + i * perShotDelay;
      if (atMs < fromMs || atMs >= toMs) continue;
      out.push({ burstIndex: k, shotIndex: i, atMs, angleOffsetDeg: sweep + offsets[i] });
      if (out.length >= MAX_SHOTS_PER_UPDATE) return out;
    }
  }
  return out;
}

/**
 * Advances one firing anchor by a frame and returns the shots it owes.
 *
 * Switching to a different Action restarts the schedule, which is what
 * makes an Action's `telegraphMs`/`burstIntervalMs` relative to *itself*
 * rather than to the encounter clock — author a wind-up once and it reads
 * the same wherever that Action is placed.
 *
 * **`previousSec` must be the moment the current frame began, not "now".**
 * On a switch, the track skips straight to however much of the new Action's
 * timeline was already in the past *as of the start of this frame*.
 * Normally that's ~0 and the Action's opening shot fires immediately;
 * after a long frame hitch it's what stops a whole backlog of bursts from
 * being replayed in one go. Passing `nowSec` here instead silently swallows
 * every shot scheduled at the very start of the Action, which is exactly
 * what a `t = 0` shot is.
 *
 * Safe to call more than once in the same frame: the second call sees an
 * unchanged `actionId` and an already-advanced `firedThroughMs`, so it
 * neither re-fires nor skips.
 */
export function advanceAttackTrack(
  track: AttackTrack,
  attack: AuthoredAttack | null,
  actionId: string | null,
  actionStartSec: number,
  previousSec: number,
  nowSec: number
): ScheduledShot[] {
  if (track.actionId !== actionId) {
    track.actionId = actionId;
    track.startedAtSec = actionStartSec;
    track.firedThroughMs = Math.max(0, (previousSec - actionStartSec) * 1000);
  }
  if (!attack) return [];

  const elapsedMs = (nowSec - track.startedAtSec) * 1000;
  const shots = dueShots(attack, track.firedThroughMs, elapsedMs);
  track.firedThroughMs = Math.max(track.firedThroughMs, elapsedMs);
  return shots;
}
