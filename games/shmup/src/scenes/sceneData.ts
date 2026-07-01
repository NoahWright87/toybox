/**
 * The hand-off contracts between scenes (run-structure.spec.todo.md, F8
 * #136's episode flow: Map -> Play -> Resolve -> Map). Kept in one place so
 * MapScene, PlayScene, and ResolveScene agree on shape without importing
 * each other.
 */
import type { NodeType } from "../systems/map";
import type { OwnedItemRef, OwnedWeaponRef } from "../systems/career";
import type { MainStatId } from "../systems/stats";

export const SCENE_KEYS = {
  boot: "Boot",
  map: "Map",
  play: "Play",
  resolve: "Resolve",
  levelUp: "LevelUp",
  shop: "Shop",
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
  items: OwnedItemRef[];
  /** Level-up stat picks so far this career (economy.spec.todo.md) — folded into the resolved build the same way `weapons`/`items` are. */
  statPicks: Partial<Record<MainStatId, number>>;
  /** Current career level — display-only (HUD), same convention as `ratings`; EXP/level itself never changes mid-episode (batched at the end-of-level break). */
  level: number;
  /** True when this bossFinale node is the last Season's boss (Series Finale, not just a Season Finale). */
  isSeriesFinale: boolean;
}

export type EpisodeOutcome = "clear" | "death" | "special";

/**
 * Play -> Resolve (or Map -> Resolve, for an instantly-resolved special
 * node): the numbers to cash in and display; ResolveScene applies them to
 * the persisted career, then routes on to LevelUpScene/ShopScene/MapScene
 * per economy.spec.todo.md's end-of-level break (F9 #137).
 */
export interface ResolveLaunchData {
  outcome: EpisodeOutcome;
  nodeId: string;
  nodeType: NodeType;
  season: number;
  isSeriesFinale: boolean;
  score: number;
  ratingsBefore: number;
  ratingsDelta: number;
  /** Physical gold caught this episode (economy.spec.todo.md) — banked regardless of clear/death, same as the build. Defaults to 0 for special (shop/event/treasure) nodes, which never run an episode. */
  goldCollected: number;
  /** EXP gained this episode (gained automatically on kill, no collection) — rolled into level-ups only at this break, never mid-play. */
  expGained: number;
}

/** Resolve -> LevelUp: how many sequential stat picks are owed at this break (one per level gained this episode — economy.spec.todo.md's hard rule: batched, never mid-play). `totalPicks` is fixed for the whole sequence (used for the "Pick N of totalPicks" prompt); `picksRemaining` counts down (including the current one) across each `scene.restart()`. */
export interface LevelUpLaunchData {
  picksRemaining: number;
  totalPicks: number;
}

/** "baseline" = the small shop shown at every inter-level break; "node" = a dedicated map shop node with bigger/rarer stock (economy.spec.todo.md's "two cadences, do both"). */
export type ShopVariant = "baseline" | "node";

export interface ShopLaunchData {
  variant: ShopVariant;
}
