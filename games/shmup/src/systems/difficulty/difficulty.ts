/**
 * The escalation formula (run-structure.spec.todo.md):
 *   D = seasonBase(season) + episodeRamp*episodeIndex + stageOffset
 *     + itemModifiers + deadlinePenalty*mapLag
 *
 * `mapLag` is a between-episodes/overworld quantity (0 while ahead of the
 * deadline), computed once on episode entry — never an in-episode clock.
 * D is independent of Ratings (Ratings gates access only, see systems/map).
 */
import { TUNING } from "../../tuning";
import type { DifficultyContext } from "./types";

function seasonBase(season: number): number {
  const table = TUNING.difficulty.seasonBase;
  const idx = Math.min(table.length - 1, Math.max(0, season - 1));
  return table[idx];
}

export function computeDifficulty(ctx: DifficultyContext): number {
  const d =
    seasonBase(ctx.season) +
    TUNING.difficulty.episodeRamp * ctx.episodeIndex +
    (ctx.stageOffset ?? 0) +
    (ctx.itemModifiers ?? 0) +
    TUNING.difficulty.deadlinePenalty * ctx.mapLag;
  return Math.max(0, d);
}
