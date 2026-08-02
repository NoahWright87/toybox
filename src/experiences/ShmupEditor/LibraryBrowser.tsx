import { useMemo, type ReactNode } from "react";
import { slotTag, type TileDef } from "./types";
import type { UnitDef, UnitLayer } from "./unitTypes";

/** Which library the browser is showing. "preview" holds the whole-level views (Connection Viewer, Tag Graph) rather than a library of its own. */
export type LibraryTab = "tiles" | "units" | "preview";

interface LibraryBrowserProps {
  tab: LibraryTab;
  onTabChange: (tab: LibraryTab) => void;
  tileCount: number;
  unitCount: number;
  /** Null on the Preview tab, which has nothing to create. */
  onCreate: (() => void) | null;
  createLabel: string;
  /** The filter control for the active tab — a tag picker for tiles, a layer picker for units. Null on Preview. */
  filter: ReactNode;
  children: ReactNode;
}

export const ALL_FILTER = "__all__";

/**
 * Every distinct edge tag in the library, sorted, for the Tiles tab's filter.
 * Tags are per-edge-slot free text rather than a tile-level field, so a tile
 * "has" a tag if any of its four edges carries it — which is also what makes
 * the filter useful: "show me everything that borders water".
 */
export function tileTags(tiles: TileDef[]): string[] {
  const seen = new Set<string>();
  for (const tile of tiles) {
    for (const slot of [...tile.north, ...tile.south, tile.east, tile.west]) {
      const tag = slotTag(slot);
      if (tag) seen.add(tag);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function tileHasTag(tile: TileDef, tag: string): boolean {
  if (tag === ALL_FILTER) return true;
  return [...tile.north, ...tile.south, tile.east, tile.west].some((slot) => slotTag(slot) === tag);
}

export function unitInLayer(unit: UnitDef, layer: string): boolean {
  return layer === ALL_FILTER || unit.layer === (layer as UnitLayer);
}

/**
 * The library shell: Tiles / Units / Preview tabs, the active tab's filter, and
 * a Create button — all pinned above a scrolling grid.
 *
 * Replaces menu-bar-only navigation. Switching between the tile and unit
 * libraries used to mean opening a Win95 menu and picking an item from it,
 * which is two taps on a 35x17px target for something you do constantly; the
 * menu bar stays (it also holds Help/Reset and the level views) but is no
 * longer the only route. Per Noah: "units and tiles are like two major tabs,
 * and maybe preview would be a third tab?"
 *
 * The header is pinned rather than scrolling with the grid, which is the same
 * height-lock the encounter editor uses (`.shmup-enc-fill`): the grid is the
 * only scroller, so the tabs, the filter and Create stay reachable no matter
 * how far down a long library you are.
 */
export default function LibraryBrowser({ tab, onTabChange, tileCount, unitCount, onCreate, createLabel, filter, children }: LibraryBrowserProps) {
  const tabs = useMemo(
    () =>
      [
        { id: "tiles" as const, label: `Tiles (${tileCount})` },
        { id: "units" as const, label: `Units (${unitCount})` },
        { id: "preview" as const, label: "Preview" },
      ] satisfies { id: LibraryTab; label: string }[],
    [tileCount, unitCount]
  );

  return (
    <div className="shmup-lib">
      <div className="shmup-lib__head">
        <div className="shmup-lib__tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`shmup-lib__tab ${tab === t.id ? "shmup-lib__tab--active" : ""}`}
              aria-pressed={tab === t.id}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(filter || onCreate) && (
          <div className="shmup-lib__controls">
            {filter}
            {onCreate && (
              <button type="button" className="shmup-btn shmup-btn--primary shmup-lib__create" onClick={onCreate}>
                {createLabel}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="shmup-lib__body">{children}</div>
    </div>
  );
}
