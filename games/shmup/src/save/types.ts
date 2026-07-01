/**
 * The persistence port — gameplay/menu/settings code depends only on this
 * interface, never a concrete storage mechanism (see games/shmup/README.md
 * "Save storage" and specs/games/shmup/save.spec.md). Values are strings;
 * callers JSON-encode/decode their own payloads.
 */
export interface SaveStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  /** Optional: lists keys whose name starts with `prefix` (save slots, hall of fame, etc.). */
  list?(prefix: string): string[];
}
