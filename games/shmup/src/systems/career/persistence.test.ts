import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isValidCareerState, loadCareer, saveCareer } from "./persistence";
import { createNewCareer } from "./careerState";

// vitest's "node" environment has no window/localStorage (see
// save/localSaveStore.test.ts) — a minimal in-memory Storage shim lets us
// exercise the real saveStore (doors-fs backend) round trip.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("career persistence", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    (globalThis as { window?: unknown }).window = { localStorage: new MemoryStorage() };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("returns a fresh career when nothing has been saved", () => {
    const career = loadCareer();
    expect(career.season).toBe(1);
    expect(career.currentNodeId).toBeNull();
  });

  it("round-trips a saved career through loadCareer", () => {
    const career = createNewCareer(150, 42);
    saveCareer({ ...career, currentNodeId: career.seasonMap.startNodeIds[0] });
    const loaded = loadCareer();
    expect(loaded.ratings).toBe(150);
    expect(loaded.currentNodeId).toBe(career.seasonMap.startNodeIds[0]);
    expect(loaded.seasonMap).toEqual(career.seasonMap);
  });

  it("falls back to a fresh career when the saved shape is corrupt/stale", () => {
    window.localStorage.setItem("ns97_fs_v1", "not json");
    const career = loadCareer();
    expect(career.season).toBe(1);
  });

  it("migrates a legacy Ratings-only value into a fresh career's starting Ratings", () => {
    window.localStorage.setItem("shmup_ratings_v1", "275");
    const career = loadCareer();
    expect(career.ratings).toBe(275);
  });
});

describe("isValidCareerState", () => {
  it("accepts a real CareerState", () => {
    expect(isValidCareerState(createNewCareer(0, 1))).toBe(true);
  });

  it("rejects a career-phase save whose currentNodeId doesn't exist in its own seasonMap", () => {
    const career = createNewCareer(0, 1);
    const broken = { ...career, currentNodeId: "not-a-real-node-id" };
    expect(isValidCareerState(broken)).toBe(false);
  });

  it("rejects a career-phase save whose current position has no reachable next node", () => {
    const career = createNewCareer(0, 1);
    // Corrupt the map so the current node (season start) resolves to nothing.
    const brokenMap = { ...career.seasonMap, startNodeIds: [] };
    const broken = { ...career, seasonMap: brokenMap };
    expect(isValidCareerState(broken)).toBe(false);
  });

  it("does not apply the reachability check to a Syndication-phase save (no seasonMap traversal there)", () => {
    const career = createNewCareer(0, 1);
    const syndication = { ...career, phase: "syndication" as const, currentNodeId: "not-a-real-node-id" };
    expect(isValidCareerState(syndication)).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidCareerState(null)).toBe(false);
    expect(isValidCareerState({})).toBe(false);
    expect(isValidCareerState({ version: 999 })).toBe(false);
  });
});
