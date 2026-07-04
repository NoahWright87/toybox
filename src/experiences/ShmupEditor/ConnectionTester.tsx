import { useState } from "react";
import TileArt from "./TileArt";
import { applyOrientation, findAlignments, type Orientation } from "./orientation";
import type { Footprint, TileDef } from "./types";

interface ConnectionTesterProps {
  tiles: TileDef[];
}

interface StackEntry {
  key: string;
  tile: TileDef;
  orientation: Orientation;
}

const IDENTITY: Orientation = { rotation: 0, flip: false };

function rotationsFor(footprint: Footprint): Array<0 | 90 | 180 | 270> {
  return footprint === 1 ? [0, 90, 180, 270] : [0, 180];
}

function rotate(orientation: Orientation, footprint: Footprint, dir: 1 | -1): Orientation {
  const list = rotationsFor(footprint);
  const idx = list.indexOf(orientation.rotation);
  const next = list[(idx + dir + list.length) % list.length];
  return { ...orientation, rotation: next };
}

/**
 * True if `lower` (visually underneath) and `upper` (visually on top) would
 * actually attach — `lower`'s NORTH edge is what `upper`'s SOUTH edge has to
 * match, since generation grows "north"/upward and a newly-attached tile's
 * south is what touches the existing frontier below it. Comparing the two
 * tiles' *outer* edges instead (the previous version's bug) checks edges
 * that never touch on screen.
 */
function connects(lower: StackEntry, upper: StackEntry): boolean {
  const lowerOriented = applyOrientation(lower.tile, lower.orientation);
  const upperOriented = applyOrientation(upper.tile, upper.orientation);
  return findAlignments(lowerOriented, upperOriented).some((a) => a.offset === 0 && a.allMatch);
}

function makeKey(tileId: string): string {
  return `${tileId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function ConnectionTester({ tiles }: ConnectionTesterProps) {
  // Index 0 = top of the visual stack (most recently added); last = bottom (oldest).
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (tiles.length === 0) {
    return <p className="shmup-hint">Create at least one tile to test connections.</p>;
  }

  function addTile(tile: TileDef) {
    setStack((prev) => [{ key: makeKey(tile.id), tile, orientation: IDENTITY }, ...prev]);
    setPickerOpen(false);
  }

  function removeTile(key: string) {
    setStack((prev) => prev.filter((e) => e.key !== key));
  }

  function spin(key: string, dir: 1 | -1) {
    setStack((prev) => prev.map((e) => (e.key === key ? { ...e, orientation: rotate(e.orientation, e.tile.footprint, dir) } : e)));
  }

  function flip(key: string) {
    setStack((prev) => prev.map((e) => (e.key === key ? { ...e, orientation: { ...e.orientation, flip: !e.orientation.flip } } : e)));
  }

  return (
    <div className="shmup-connection-tester">
      <div className="shmup-connection-tester__add-row">
        <button type="button" className="shmup-btn shmup-btn--big" onClick={() => setPickerOpen(true)}>
          + Add Tile
        </button>
      </div>

      {pickerOpen && (
        <div className="shmup-tile-picker">
          {tiles.map((tile) => (
            <button key={tile.id} type="button" className="shmup-tile-picker__option" onClick={() => addTile(tile)}>
              <TileArt tile={tile} orientation={IDENTITY} size="thumb" />
            </button>
          ))}
          <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPickerOpen(false)}>
            Cancel
          </button>
        </div>
      )}

      {stack.length === 0 ? (
        <p className="shmup-hint">Stack is empty — add tiles to see if they connect.</p>
      ) : (
        <div className="shmup-connection-tester__stack">
          {stack.map((entry, i) => (
            <div key={entry.key}>
              <div className="shmup-connection-tester__row">
                <div className="shmup-connection-tester__controls">
                  <button type="button" className="shmup-btn shmup-btn--small" title="Rotate counter-clockwise" onClick={() => spin(entry.key, -1)}>
                    🔁
                  </button>
                  <button type="button" className="shmup-btn shmup-btn--small" title="Rotate clockwise" onClick={() => spin(entry.key, 1)}>
                    🔄
                  </button>
                  <button type="button" className="shmup-btn shmup-btn--small" title="Flip" onClick={() => flip(entry.key)}>
                    🔀
                  </button>
                  <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" title="Remove" onClick={() => removeTile(entry.key)}>
                    ✕
                  </button>
                </div>
                <TileArt tile={entry.tile} orientation={entry.orientation} />
              </div>
              {i < stack.length - 1 && (
                <div className={`shmup-connection-tester__joint ${connects(stack[i + 1], entry) ? "shmup-connection-tester__joint--ok" : "shmup-connection-tester__joint--bad"}`}>
                  {connects(stack[i + 1], entry) ? "✅" : "❌"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
