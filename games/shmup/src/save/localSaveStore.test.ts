import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalSaveStore } from "./localSaveStore";

// vitest's "node" environment (vitest.config.ts) has no window/localStorage —
// the same environment SHMUP's other tests run in (see fsOverride.test.ts).
// A minimal in-memory Storage shim lets us exercise the real read/write/list
// paths rather than just the typeof-window guards.
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

describe("LocalSaveStore", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    (globalThis as { window?: unknown }).window = { localStorage: new MemoryStorage() };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("returns null for a key that was never written", () => {
    expect(new LocalSaveStore().read("settings")).toBeNull();
  });

  it("round-trips a write through read, namespaced under shmup:save:", () => {
    const store = new LocalSaveStore();
    store.write("settings", '{"sound":true}');
    expect(store.read("settings")).toBe('{"sound":true}');
    expect(window.localStorage.getItem("shmup:save:settings")).toBe('{"sound":true}');
  });

  it("remove clears a previously written key", () => {
    const store = new LocalSaveStore();
    store.write("settings", "v1");
    store.remove("settings");
    expect(store.read("settings")).toBeNull();
  });

  it("list returns keys under a prefix, stripped of the namespace", () => {
    const store = new LocalSaveStore();
    store.write("slot-1", "a");
    store.write("slot-2", "b");
    store.write("settings", "c");
    expect(store.list("slot-").sort()).toEqual(["slot-1", "slot-2"]);
  });

  it("is a no-op (not a throw) when window is unavailable", () => {
    (globalThis as { window?: unknown }).window = undefined;
    const store = new LocalSaveStore();
    expect(() => store.write("settings", "v1")).not.toThrow();
    expect(store.read("settings")).toBeNull();
    expect(store.list("")).toEqual([]);
    expect(() => store.remove("settings")).not.toThrow();
  });
});
