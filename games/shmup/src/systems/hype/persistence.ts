/**
 * Ratings persistence — temporary measure. SHMUP is a standalone Vite bundle
 * (games/shmup/README.md) that can't import the live Doors 97 `fsStore`
 * singleton without pulling the whole React app into this package's bundle
 * (see ../../sprites/fsOverride.ts for the same constraint on sprite
 * overrides). Until F1 wires SHMUP.EXE into Doors 97 and F8/F11 build the
 * real virtual-FS career save, Ratings lives in its own localStorage key —
 * distinct from "ns97_fs_v1" so it never collides with the Doors 97 FS.
 */

const RATINGS_STORAGE_KEY = "shmup_ratings_v1";

/** Returns the persisted cumulative Ratings, or 0 if none/unreadable. */
export function loadRatings(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(RATINGS_STORAGE_KEY);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** Persists cumulative Ratings. Silently no-ops if storage is unavailable. */
export function saveRatings(ratings: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RATINGS_STORAGE_KEY, String(ratings));
  } catch {
    // storage unavailable (private mode, quota, etc.) -- Ratings just won't persist this session
  }
}
