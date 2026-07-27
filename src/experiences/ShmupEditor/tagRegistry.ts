/**
 * Known-tag registry (specs/shmup-editor.todo.md, E1 #191 follow-up):
 * freeform text tags are a typo trap — "dirt" vs "dirrt" would silently
 * never match. Edge tags are chosen from this list (or added to it via
 * "+ New tag...") instead of typed by hand everywhere.
 */
import { HARDWALL, WILDCARD, slotTag, type TileDef } from "./types";

/** Every distinct real tag currently used across the library's tiles (reserved values excluded). */
export function collectUsedTags(tiles: TileDef[]): string[] {
  const tags = new Set<string>();
  for (const tile of tiles) {
    for (const slot of [...tile.north, ...tile.south, tile.east, tile.west]) {
      // slotTag() (not slot.tag.trim()) so a hardwall slot never contributes
      // its leftover free-text tag — hardwall always wins over whatever
      // text happens to still be in that field.
      const tag = slotTag(slot);
      if (tag && tag !== HARDWALL && tag !== WILDCARD) tags.add(tag);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
