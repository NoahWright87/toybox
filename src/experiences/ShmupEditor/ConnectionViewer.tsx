import { useState } from "react";
import TileArt from "./TileArt";
import { connects, rotationAngles, validOrientations, type Orientation, type OrientedTile } from "./orientation";
import type { TileDef } from "./types";

interface ConnectionViewerProps {
  tiles: TileDef[];
}

interface StackEntry extends OrientedTile {
  key: string;
}

const IDENTITY: Orientation = { rotation: 0, flip: false };

/** Every (tile, orientation) pair that would actually attach on top of `top` — nothing invalid is ever offered. */
function candidatesFor(tiles: TileDef[], top: OrientedTile | null): OrientedTile[] {
  if (!top) return tiles.map((tile) => ({ tile, orientation: IDENTITY }));
  const out: OrientedTile[] = [];
  for (const tile of tiles) {
    for (const orientation of validOrientations(tile.footprint)) {
      if (connects(top, { tile, orientation })) out.push({ tile, orientation });
    }
  }
  return out;
}

function makeKey(tileId: string): string {
  return `${tileId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * A visual flow-checker, not a pass/fail tester: the "+ Add Tile" picker
 * only ever offers tiles (in orientations) that are actually guaranteed to
 * attach to the current top of the stack — so building a stack here always
 * produces a structurally valid sequence, and the only thing left to judge
 * is whether the *art* reads well together (AI-generated tile art in
 * particular can be tag-compatible but visually mismatched at the seam).
 * Rotating/flipping an already-placed tile can still break that guarantee,
 * so the joint marker stays live as a safety net for that case.
 */
export default function ConnectionViewer({ tiles }: ConnectionViewerProps) {
  // Index 0 = top of the visual stack (most recently added); last = bottom (oldest).
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (tiles.length === 0) {
    return <p className="shmup-hint">Create at least one tile to check connections.</p>;
  }

  const candidates = pickerOpen ? candidatesFor(tiles, stack[0] ?? null) : [];

  function addTile(tile: TileDef, orientation: Orientation) {
    setStack((prev) => [{ key: makeKey(tile.id), tile, orientation }, ...prev]);
    setPickerOpen(false);
  }

  function removeTile(key: string) {
    setStack((prev) => prev.filter((e) => e.key !== key));
  }

  // Cycles rotation only (rotationAngles), leaving flip untouched — a
  // separate, dedicated concept from the 🔀 button. Cycling through
  // validOrientations() here would interleave a flip into every other
  // "rotate" click, since that list crosses rotation with flip.
  function spin(key: string, dir: 1 | -1) {
    setStack((prev) =>
      prev.map((e) => {
        if (e.key !== key) return e;
        const list = rotationAngles(e.tile.footprint);
        const idx = list.indexOf(e.orientation.rotation);
        const nextRotation = list[(idx + dir + list.length) % list.length];
        return { ...e, orientation: { ...e.orientation, rotation: nextRotation } };
      })
    );
  }

  function flip(key: string) {
    setStack((prev) => prev.map((e) => (e.key === key ? { ...e, orientation: { ...e.orientation, flip: !e.orientation.flip } } : e)));
  }

  return (
    <div className="shmup-connection-viewer">
      <div className="shmup-connection-viewer__add-row">
        <button type="button" className="shmup-btn shmup-btn--big" onClick={() => setPickerOpen(true)}>
          + Add Tile
        </button>
      </div>

      {pickerOpen && (
        <div className="shmup-tile-picker">
          {candidates.length === 0 ? (
            <p className="shmup-hint">No tiles connect to the current top of the stack.</p>
          ) : (
            candidates.map(({ tile, orientation }, i) => (
              <button
                key={`${tile.id}-${orientation.rotation}-${orientation.flip}-${i}`}
                type="button"
                className="shmup-tile-picker__option"
                onClick={() => addTile(tile, orientation)}
              >
                <TileArt tile={tile} orientation={orientation} size="thumb" />
                {/* A tile can appear once per valid orientation — this badge is what tells two otherwise-identical-looking thumbnails apart. */}
                <span className="shmup-tile-picker__orientation-badge">
                  {orientation.rotation}°{orientation.flip ? " ⟲" : ""}
                </span>
              </button>
            ))
          )}
          <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPickerOpen(false)}>
            Cancel
          </button>
        </div>
      )}

      {stack.length === 0 ? (
        <p className="shmup-hint">Stack is empty — add tiles to build a checked-good sequence.</p>
      ) : (
        <div className="shmup-connection-viewer__stack">
          {stack.map((entry, i) => (
            <div key={entry.key}>
              <div className="shmup-connection-viewer__row">
                <div className="shmup-connection-viewer__controls">
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
                <div className={`shmup-connection-viewer__joint ${connects(stack[i + 1], entry) ? "shmup-connection-viewer__joint--ok" : "shmup-connection-viewer__joint--bad"}`}>
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
