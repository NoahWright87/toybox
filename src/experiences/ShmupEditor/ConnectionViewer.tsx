import { useEffect, useState } from "react";
import TileArt from "./TileArt";
import { connects, rotationAngles, validOrientations, type Orientation, type OrientedTile } from "./orientation";
import type { TileDef } from "./types";

interface ConnectionViewerProps {
  tiles: TileDef[];
}

interface StripEntry extends OrientedTile {
  key: string;
}

const IDENTITY: Orientation = { rotation: 0, flip: false };

function makeKey(tileId: string): string {
  return `${tileId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** First orientation (in validOrientations order) satisfying `isValid` per tile — not every permutation. Rotate/flip after placing covers the rest. */
function firstMatchPerTile(tiles: TileDef[], isValid: (candidate: OrientedTile) => boolean): OrientedTile[] {
  const out: OrientedTile[] = [];
  for (const tile of tiles) {
    for (const orientation of validOrientations(tile.footprint)) {
      const candidate: OrientedTile = { tile, orientation };
      if (isValid(candidate)) {
        out.push(candidate);
        break;
      }
    }
  }
  return out;
}

/** Would `orientation` still connect strip[index] to both of its current neighbors? */
function orientationValidAt(strip: StripEntry[], index: number, orientation: Orientation): boolean {
  const candidate: OrientedTile = { tile: strip[index].tile, orientation };
  const north = strip[index - 1]; // physically above (more north)
  const south = strip[index + 1]; // physically below (more south)
  if (north && !connects(candidate, north)) return false;
  if (south && !connects(south, candidate)) return false;
  return true;
}

type AddMode = "above" | "below" | null;

/**
 * A strip builder, tiles literally touching (~1px), so seams are checkable
 * at a glance — not a pass/fail tester. "+ Add" only ever offers the FIRST
 * orientation that connects per tile (not every permutation); rotate/flip
 * after placing covers the rest. The strip grows in both directions (an
 * "+ Add" above the top tile and below the bottom one), matching how a real
 * level segment is built rather than a single append-only stack.
 */
export default function ConnectionViewer({ tiles }: ConnectionViewerProps) {
  // Index 0 = top of the strip (most north); last index = bottom (most south).
  const [strip, setStrip] = useState<StripEntry[]>([]);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Close the picker / deselect a tile on a genuine outside click — anything
  // that isn't on a tile (for selection) or the picker/its trigger buttons
  // (for the add menu). Checked by class rather than a single container ref
  // so "empty space" *inside* the strip (e.g. an underfilled row) still
  // counts as outside, and clicking a DIFFERENT tile/+Add button is left to
  // that element's own onClick — no race between this listener and a click
  // toggling selection/add-mode to a new target.
  useEffect(() => {
    if (!selectedKey && addMode === null) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (selectedKey && !target?.closest(".shmup-strip-entry")) {
        setSelectedKey(null);
      }
      if (addMode !== null && !target?.closest(".shmup-tile-picker") && !target?.closest(".shmup-strip-add")) {
        setAddMode(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selectedKey, addMode]);

  if (tiles.length === 0) {
    return <p className="shmup-hint">Create at least one tile to check connections.</p>;
  }

  const candidates: OrientedTile[] =
    addMode === null
      ? []
      : strip.length === 0
        ? tiles.map((tile) => ({ tile, orientation: IDENTITY }))
        : addMode === "above"
          ? // The candidate becomes the new top (more north): candidate is "upper", the current top is "lower" relative to it.
            firstMatchPerTile(tiles, (c) => connects(strip[0], c))
          : // The candidate becomes the new bottom (more south): candidate is "lower", the current bottom is "upper" relative to it.
            firstMatchPerTile(tiles, (c) => connects(c, strip[strip.length - 1]));

  function openPicker(mode: "above" | "below") {
    setSelectedKey(null);
    setAddMode(mode);
  }

  function addTile(tile: TileDef, orientation: Orientation) {
    const entry: StripEntry = { key: makeKey(tile.id), tile, orientation };
    setStrip((prev) => (addMode === "below" ? [...prev, entry] : [entry, ...prev]));
    setAddMode(null);
  }

  function removeTile(key: string) {
    setStrip((prev) => prev.filter((e) => e.key !== key));
    setSelectedKey(null);
  }

  function spin(key: string, dir: 1 | -1) {
    setStrip((prev) => {
      const index = prev.findIndex((e) => e.key === key);
      if (index === -1) return prev;
      const list = rotationAngles(prev[index].tile.footprint);
      const idx = list.indexOf(prev[index].orientation.rotation);
      const rotation = list[(idx + dir + list.length) % list.length];
      if (!orientationValidAt(prev, index, { ...prev[index].orientation, rotation })) return prev;
      return prev.map((e, i) => (i === index ? { ...e, orientation: { ...e.orientation, rotation } } : e));
    });
  }

  function flip(key: string) {
    setStrip((prev) => {
      const index = prev.findIndex((e) => e.key === key);
      if (index === -1) return prev;
      const orientation = { ...prev[index].orientation, flip: !prev[index].orientation.flip };
      if (!orientationValidAt(prev, index, orientation)) return prev;
      return prev.map((e, i) => (i === index ? { ...e, orientation } : e));
    });
  }

  const picker = addMode !== null && (
    <div className="shmup-tile-picker">
      {candidates.length === 0 ? (
        <p className="shmup-hint">No tiles connect here.</p>
      ) : (
        candidates.map(({ tile, orientation }) => (
          <button key={tile.id} type="button" className="shmup-tile-picker__option" onClick={() => addTile(tile, orientation)}>
            <TileArt tile={tile} orientation={orientation} size="thumb" />
          </button>
        ))
      )}
      <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setAddMode(null)}>
        Cancel
      </button>
    </div>
  );

  return (
    <div className="shmup-connection-viewer">
      {strip.length === 0 ? (
        <div className="shmup-strip-add-row--initial">
          <button type="button" className="shmup-strip-add" onClick={() => openPicker("above")}>
            + Add
          </button>
          {picker}
        </div>
      ) : (
        <div className="shmup-connection-viewer__strip">
          <button type="button" className="shmup-strip-add" onClick={() => openPicker("above")}>
            + Add
          </button>
          {/* Rendered right where "+ Add" (above) was tapped, not at the bottom of the whole strip. */}
          {addMode === "above" && picker}
          {strip.map((entry, index) => {
            const selected = selectedKey === entry.key;
            const rotList = rotationAngles(entry.tile.footprint);
            const rotIdx = rotList.indexOf(entry.orientation.rotation);
            const canRotateLeft = orientationValidAt(strip, index, { ...entry.orientation, rotation: rotList[(rotIdx - 1 + rotList.length) % rotList.length] });
            const canRotateRight = orientationValidAt(strip, index, { ...entry.orientation, rotation: rotList[(rotIdx + 1) % rotList.length] });
            const canFlip = orientationValidAt(strip, index, { ...entry.orientation, flip: !entry.orientation.flip });
            const canDelete = index === 0 || index === strip.length - 1;
            return (
              <div
                key={entry.key}
                className="shmup-strip-entry"
                onClick={() => setSelectedKey((k) => (k === entry.key ? null : entry.key))}
              >
                <TileArt tile={entry.tile} orientation={entry.orientation} size="strip" showName={false} />
                {selected && (
                  <>
                    <button
                      type="button"
                      className="shmup-strip-entry__btn shmup-strip-entry__btn--delete"
                      disabled={!canDelete}
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTile(entry.key);
                      }}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      className="shmup-strip-entry__btn shmup-strip-entry__btn--rotate-left"
                      disabled={!canRotateLeft}
                      title="Rotate"
                      onClick={(e) => {
                        e.stopPropagation();
                        spin(entry.key, -1);
                      }}
                    >
                      🔄
                    </button>
                    <button
                      type="button"
                      className="shmup-strip-entry__btn shmup-strip-entry__btn--rotate-right"
                      disabled={!canRotateRight}
                      title="Rotate"
                      onClick={(e) => {
                        e.stopPropagation();
                        spin(entry.key, 1);
                      }}
                    >
                      🔁
                    </button>
                    <button
                      type="button"
                      className="shmup-strip-entry__btn shmup-strip-entry__btn--flip"
                      disabled={!canFlip}
                      title="Flip"
                      onClick={(e) => {
                        e.stopPropagation();
                        flip(entry.key);
                      }}
                    >
                      🔀
                    </button>
                  </>
                )}
              </div>
            );
          })}
          <button type="button" className="shmup-strip-add" onClick={() => openPicker("below")}>
            + Add
          </button>
          {addMode === "below" && picker}
        </div>
      )}
    </div>
  );
}
