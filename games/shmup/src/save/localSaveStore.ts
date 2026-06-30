import type { SaveStore } from "./types";

const KEY_PREFIX = "shmup:save:";

/** Standalone fallback — plain localStorage, namespaced so it can't collide with the Doors FS blob or other apps' keys. */
export class LocalSaveStore implements SaveStore {
  read(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(KEY_PREFIX + key);
    } catch {
      return null;
    }
  }

  write(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEY_PREFIX + key, value);
    } catch {
      /* quota exceeded or storage disabled — silently drop, mirrors StorageAdapter.ts */
    }
  }

  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(KEY_PREFIX + key);
    } catch {
      /* silent */
    }
  }

  list(prefix: string): string[] {
    if (typeof window === "undefined") return [];
    try {
      const fullPrefix = KEY_PREFIX + prefix;
      const out: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) out.push(k.slice(KEY_PREFIX.length));
      }
      return out;
    } catch {
      return [];
    }
  }
}
