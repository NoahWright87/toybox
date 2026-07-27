/**
 * EXP -> Levels (economy.spec.todo.md): earned automatically on kill, no
 * collection — progression is guaranteed. This module is pure curve math;
 * the hard rule that the resulting level-up picks only ever resolve at the
 * end-of-level break (never mid-play) is enforced by the caller
 * (PlayScene accrues EXP; ResolveScene/LevelUpScene batch the picks).
 */
import { TUNING } from "../../tuning";

/** EXP required to go from `level` to `level + 1`. Levels are 1-based. */
export function expToNextLevel(level: number): number {
  const { expCurveBase, expCurveGrowth } = TUNING.economy;
  return expCurveBase * Math.pow(expCurveGrowth, Math.max(1, level) - 1);
}

export interface ExpProgress {
  level: number;
  /** Progress toward `expToNextLevel(level)`, always < that threshold. */
  exp: number;
}

export interface ExpGainResult extends ExpProgress {
  /** How many times `level` rolled over this gain — the count of sequential level-up picks owed at the next break. */
  levelsGained: number;
}

/** Applies a batch of gained EXP, rolling over as many level-ups as it covers (batched, never partial). */
export function applyExpGain(current: ExpProgress, gained: number): ExpGainResult {
  let level = current.level;
  let exp = current.exp + Math.max(0, gained);
  let levelsGained = 0;
  let needed = expToNextLevel(level);
  while (needed > 0 && exp >= needed) {
    exp -= needed;
    level += 1;
    levelsGained += 1;
    needed = expToNextLevel(level);
  }
  return { level, exp, levelsGained };
}
