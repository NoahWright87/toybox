/**
 * Typed pub/sub over ShmupEventMap (hype-and-ratings.spec.md's documented
 * event API). Deliberately not named `events` on the scene that owns it —
 * Phaser.Scene already has a built-in `events` EventEmitter.
 */
import type { ShmupEventMap } from "./types";

type Listener<K extends keyof ShmupEventMap> = (payload: ShmupEventMap[K]) => void;

export class ShmupEventBus {
  private listeners = new Map<keyof ShmupEventMap, Set<Listener<keyof ShmupEventMap>>>();

  on<K extends keyof ShmupEventMap>(event: K, listener: Listener<K>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<keyof ShmupEventMap>);
  }

  off<K extends keyof ShmupEventMap>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener as Listener<keyof ShmupEventMap>);
  }

  emit<K extends keyof ShmupEventMap>(event: K, payload: ShmupEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) (listener as Listener<K>)(payload);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
