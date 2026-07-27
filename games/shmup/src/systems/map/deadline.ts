/**
 * The overworld deadline (FTL-style pursuing fleet, run-structure.spec.todo.md):
 * "Stages auto-scroll, so there is no in-episode timer. The time pressure is
 * between episodes." The deadline creeps forward in the same "column" units
 * as the map every time a node is taken; Player Speed slows its advance.
 */
import { TUNING } from "../../tuning";

/**
 * Advances the deadline by one node-take. `playerSpeed` is the resolved
 * Player Speed stat (overworld-only effect — in-episode Player Speed is pure
 * movement, per combat.spec.todo.md); higher speed buys slack, floored so
 * the deadline always creeps forward some.
 */
export function advanceDeadline(position: number, playerSpeed: number): number {
  const slack = TUNING.map.deadlineSlackPerSpeed * Math.max(0, playerSpeed);
  const advance = Math.max(TUNING.map.deadlineMinAdvance, TUNING.map.deadlineAdvancePerNode - slack);
  return position + advance;
}

/**
 * mapLag = how far the deadline has passed the player's own column
 * progress, evaluated on episode entry — 0 while the player is still ahead
 * of (or exactly at) the deadline.
 */
export function mapLagFor(deadlinePosition: number, playerColumn: number): number {
  return Math.max(0, deadlinePosition - playerColumn);
}
