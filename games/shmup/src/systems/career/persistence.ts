/**
 * Career persistence via the SaveStore port (save.spec.md) — never raw
 * localStorage. Key "career" maps to CAREER.DAT under
 * C:\Programs\Games\SHMUP\Saves\ (DoorsFsSaveStore), same hackable-FS
 * precedent as SCORES.DAT elsewhere (root CLAUDE.md).
 */
import { saveStore } from "../../save";
import { availableNodeIds } from "../map";
import { createNewCareer } from "./careerState";
import { CAREER_STATE_VERSION } from "./types";
import type { CareerState } from "./types";

const CAREER_SAVE_KEY = "career";

/**
 * Pre-map Ratings-only save (hype-and-ratings.spec.md, F7 #135) — superseded
 * by CareerState now that the map/season system exists. Read once, as a
 * one-time migration into a fresh career's starting Ratings, so players who
 * already had progress under the old system don't lose it; never written to
 * again after this file lands.
 */
const LEGACY_RATINGS_KEY = "shmup_ratings_v1";

function legacyStartingRatings(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LEGACY_RATINGS_KEY);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

/**
 * Validates shape/version before trusting a save (root CLAUDE.md's reload
 * rule) — a corrupt or stale-shape save falls back to a fresh career rather
 * than crashing or, worse, stranding the player on a map with nothing
 * tappable. Beyond the field-shape check, a "career"-phase save must resolve
 * to at least one reachable node: `currentNodeId` (if set) has to exist in
 * its own `seasonMap`, and `availableNodeIds` from it can't be empty.
 */
export function isValidCareerState(value: unknown): value is CareerState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const map = v.seasonMap as Record<string, unknown> | undefined;
  const shapeOk =
    v.version === CAREER_STATE_VERSION &&
    typeof v.ratings === "number" &&
    typeof v.season === "number" &&
    (v.currentNodeId === null || typeof v.currentNodeId === "string") &&
    Array.isArray(v.visitedNodeIds) &&
    typeof v.deadlinePosition === "number" &&
    Array.isArray(v.weapons) &&
    (v.phase === "career" || v.phase === "syndication") &&
    typeof v.syndicationEpisodeIndex === "number" &&
    !!map &&
    typeof map.bossNodeId === "string" &&
    typeof map.nodes === "object";
  if (!shapeOk) return false;

  if (v.phase === "career") {
    try {
      const state = v as unknown as CareerState;
      if (state.currentNodeId !== null && !state.seasonMap.nodes[state.currentNodeId]) return false;
      if (availableNodeIds(state.seasonMap, state.currentNodeId).length === 0) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function loadCareer(): CareerState {
  const raw = saveStore.read(CAREER_SAVE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidCareerState(parsed)) return parsed;
    } catch {
      // corrupt JSON — fall through to a fresh career
    }
  }
  return createNewCareer(legacyStartingRatings());
}

export function saveCareer(state: CareerState): void {
  saveStore.write(CAREER_SAVE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
}
