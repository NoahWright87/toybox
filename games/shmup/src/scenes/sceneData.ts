/**
 * The hand-off contracts between scenes (run-structure.spec.todo.md, F8
 * #136's episode flow: Map -> Play -> Resolve -> Map). Kept in one place so
 * MapScene, PlayScene, and ResolveScene agree on shape without importing
 * each other.
 */
import type { NodeType } from "../systems/map";
import type { OwnedWeaponRef } from "../systems/career";

export const SCENE_KEYS = {
  boot: "Boot",
  map: "Map",
  play: "Play",
  resolve: "Resolve",
} as const;

/** Map -> Play: everything PlayScene needs to run one episode, resolved ahead of time by the map (Difficulty, build) so PlayScene has zero career/map knowledge of its own. */
export interface EpisodeLaunchData {
  nodeId: string;
  /** Special node types (shop/event/treasure) never produce an EpisodeLaunchData — they resolve on the map. */
  nodeType: Extract<NodeType, "standard" | "elite" | "bossFinale">;
  season: number;
  D: number;
  /** Cumulative Ratings entering the episode — display-only (HUD tier readout); Ratings never changes mid-episode (Model 1). */
  ratings: number;
  weapons: OwnedWeaponRef[];
  /** True when this bossFinale node is the last Season's boss (Series Finale, not just a Season Finale). */
  isSeriesFinale: boolean;
}

export type EpisodeOutcome = "clear" | "death" | "special";

/** Play -> Resolve (or Map -> Resolve, for an instantly-resolved special node): the numbers to cash in and display; ResolveScene applies them to the persisted career. */
export interface ResolveLaunchData {
  outcome: EpisodeOutcome;
  nodeId: string;
  nodeType: NodeType;
  season: number;
  isSeriesFinale: boolean;
  score: number;
  ratingsBefore: number;
  ratingsDelta: number;
}
