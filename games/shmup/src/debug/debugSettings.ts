/**
 * Debug overlay overrides (C12 #151), persisted via the SaveStore port
 * (save.spec.md) — never a direct localStorage call. A fresh Player is
 * constructed every episode (run-structure.spec.md's Map -> Play -> Resolve
 * flow), so without this every debug tweak (stat nudges, spawn rate, episode
 * length, hitbox toggle...) would silently reset each time a new episode
 * launched, making the overlay useless for anything but single-episode
 * testing. `current` is a module-level singleton so it also survives a
 * PlayScene `create()` re-run without a full page reload; persisting through
 * `saveStore` additionally survives an actual reload.
 */
import { saveStore } from "../save";
import type { StatId } from "../systems/stats";

export interface DebugOverrides {
  /** Flat nudge amount per stat, keyed by StatId; zero/absent entries aren't stored. */
  statMods: Partial<Record<StatId, number>>;
  firingConeDeg: number;
  forkConeOverrideDeg: number | null;
  enemySpawnIntervalMs: number | null;
  episodeClearDurationSec: number | null;
  showHitboxes: boolean;
}

const DEBUG_SAVE_KEY = "debug-overrides";

function defaults(): DebugOverrides {
  return {
    statMods: {},
    firingConeDeg: 0,
    forkConeOverrideDeg: null,
    enemySpawnIntervalMs: null,
    episodeClearDurationSec: null,
    showHitboxes: false,
  };
}

function load(): DebugOverrides {
  try {
    const raw = saveStore.read(DEBUG_SAVE_KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    // corrupt/unreadable -- fall back to defaults rather than crashing debug tooling
  }
  return defaults();
}

let current: DebugOverrides = load();

/** The live snapshot — read once per Player construction, never mutated in place by callers. */
export function getDebugOverrides(): DebugOverrides {
  return current;
}

/** Replaces and persists the snapshot. DebugOverlay calls this after every mutation. */
export function setDebugOverrides(next: DebugOverrides): void {
  current = next;
  saveStore.write(DEBUG_SAVE_KEY, JSON.stringify(current));
}
