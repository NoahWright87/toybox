/**
 * The full persisted career (run-structure.spec.todo.md's persistence rule,
 * root CLAUDE.md's reload rule): "Career state — build, gold, Ratings,
 * Season, map position, deadline position — saved to the virtual FS at the
 * map level. Reload mid-episode resumes the pre-episode map state." Nothing
 * here is written during an episode (see scenes/PlayScene.ts) — only Map/
 * Resolve write it, so a reload mid-episode naturally resumes at the map.
 */
import type { SeasonMap } from "../map";

export const CAREER_STATE_VERSION = 1;

/** A weapon by id + upgrade tier — build persistence stub (only PLACEHOLDER_WEAPON exists until C1 #140). */
export interface OwnedWeaponRef {
  weaponId: string;
  tier: number;
}

/** "career" = normal Season/Finale progression; "syndication" = post-Series-Finale endless mode. */
export type CareerPhase = "career" | "syndication";

export interface CareerState {
  version: typeof CAREER_STATE_VERSION;
  ratings: number;
  /** 1-based; clamped to TUNING.difficulty.seasonCount. */
  season: number;
  seasonMap: SeasonMap;
  /** null = at the Season's virtual start, before any node is taken. */
  currentNodeId: string | null;
  visitedNodeIds: string[];
  deadlinePosition: number;
  weapons: OwnedWeaponRef[];
  phase: CareerPhase;
  /** Endless episode counter once in Syndication — feeds computeDifficulty's episodeIndex the same way visitedNodeIds.length does during a normal Season. */
  syndicationEpisodeIndex: number;
  /** Ratings snapshot the moment the Series Finale resolves (win or loss) — Syndication is optional from there. */
  finaleScore: number | null;
  /** Ratings snapshot the moment Syndication ends (Cancelled). */
  syndicationScore: number | null;
  savedAt: number;
}
