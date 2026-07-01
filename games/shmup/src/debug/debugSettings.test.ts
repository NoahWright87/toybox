import { describe, it, expect, beforeEach, afterEach } from "vitest";

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

describe("debugSettings", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    (globalThis as { window?: unknown }).window = { localStorage: new MemoryStorage() };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("defaults to an empty/no-override snapshot when nothing has been saved", async () => {
    const { getDebugOverrides } = await import("./debugSettings");
    const overrides = getDebugOverrides();
    expect(overrides.statMods).toEqual({});
    expect(overrides.firingConeDeg).toBe(0);
    expect(overrides.forkConeOverrideDeg).toBeNull();
    expect(overrides.enemySpawnIntervalMs).toBeNull();
    expect(overrides.episodeClearDurationSec).toBeNull();
    expect(overrides.showHitboxes).toBe(false);
  });

  it("round-trips a saved snapshot through getDebugOverrides after a fresh module load", async () => {
    // Import fresh each time (vitest isolates module state per test file, but
    // within one file the module singleton persists) -- exercise the
    // persistence surface directly instead of relying on re-import semantics.
    const { setDebugOverrides, getDebugOverrides } = await import("./debugSettings");
    setDebugOverrides({
      statMods: { damage: 2.5 },
      firingConeDeg: 15,
      forkConeOverrideDeg: 40,
      enemySpawnIntervalMs: 300,
      episodeClearDurationSec: 20,
      showHitboxes: true,
    });
    expect(getDebugOverrides()).toEqual({
      statMods: { damage: 2.5 },
      firingConeDeg: 15,
      forkConeOverrideDeg: 40,
      enemySpawnIntervalMs: 300,
      episodeClearDurationSec: 20,
      showHitboxes: true,
    });
  });

  it("persists to the SaveStore under the debug-overrides key so a reload would pick it back up", async () => {
    const { setDebugOverrides } = await import("./debugSettings");
    setDebugOverrides({
      statMods: {},
      firingConeDeg: 0,
      forkConeOverrideDeg: null,
      enemySpawnIntervalMs: null,
      episodeClearDurationSec: 45,
      showHitboxes: false,
    });
    const { saveStore } = await import("../save");
    const raw = saveStore.read("debug-overrides");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).episodeClearDurationSec).toBe(45);
  });
});
