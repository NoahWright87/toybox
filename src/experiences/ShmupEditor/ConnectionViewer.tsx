import { useEffect, useState } from "react";
import TileArt from "./TileArt";
import { canDeleteEntry, candidatesForAddPoint, computeAddPoints, orientationValidAt, type AddPoint, type GridEntry } from "./connectionGrid";
import { rotationAngles, type Orientation } from "./orientation";
import { saveLevel } from "./levelStore";
import { DEFAULT_PLAYTEST_DIFFICULTY, playtestLevel } from "./playtestLaunch";
import type { TileDef } from "./types";

interface ConnectionViewerProps {
  tiles: TileDef[];
}

const IDENTITY: Orientation = { rotation: 0, flip: false };

/** Step the Difficulty stepper moves by, and its ceiling — matched to the Encounter editor's own preview dial. */
const DIFFICULTY_STEP = 5;
const DIFFICULTY_MAX = 200;

function makeKey(tileId: string): string {
  return `${tileId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type AddTarget = AddPoint | "initial" | null;

// Arrow (not a flat "+") since a single tile can now have several add
// points around it at once — the direction needs to be legible at a glance.
const ADD_ARROW: Record<AddPoint["side"], string> = { north: "↑", south: "↓", east: "→", west: "←" };

/**
 * A 2D grid builder, tiles literally touching (~1px), so seams are checkable
 * at a glance — not a pass/fail tester. "+ Add" appears at every open
 * (non-hardwall, unoccupied) edge of every placed tile — north/south/east/
 * west, not just north/south — and only offers the FIRST orientation that
 * connects per tile (not every permutation); rotate/flip after placing
 * covers the rest. See connectionGrid.ts for the placement/alignment math.
 *
 * **Play test** saves the assembled grid to `LEVEL.DAT` (`levelStore.ts`)
 * and hands off to the real game, which scrolls the whole thing past the
 * player with a weighted-random Encounter picked per tile — the same roll a
 * real level makes. Saving first is load-bearing: the game reads the
 * filesystem, not this component's state, which until now kept its grid
 * nowhere at all.
 */
export default function ConnectionViewer({ tiles }: ConnectionViewerProps) {
  const [entries, setEntries] = useState<GridEntry[]>([]);
  const [addTarget, setAddTarget] = useState<AddTarget>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(DEFAULT_PLAYTEST_DIFFICULTY);

  // Close the picker / deselect a tile on a genuine outside click — anything
  // that isn't on a tile (for selection) or the picker/an add-point button
  // (for the add menu). Checked by class rather than a container ref so
  // "empty space" inside the grid still counts as outside, and clicking a
  // DIFFERENT tile/add-point is left to that element's own onClick.
  useEffect(() => {
    if (!selectedKey && addTarget === null) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (selectedKey && !target?.closest(".shmup-strip-entry")) {
        setSelectedKey(null);
      }
      if (addTarget !== null && !target?.closest(".shmup-tile-picker") && !target?.closest(".shmup-grid-add")) {
        setAddTarget(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selectedKey, addTarget]);

  if (tiles.length === 0) {
    return <p className="shmup-hint">Create at least one tile to check connections.</p>;
  }

  const addPoints = computeAddPoints(entries);

  const candidates =
    addTarget === null ? [] : addTarget === "initial" ? tiles.map((tile) => ({ tile, orientation: IDENTITY, row: 0, col: 0 })) : candidatesForAddPoint(tiles, entries, addTarget);

  function openInitialPicker() {
    setSelectedKey(null);
    setAddTarget("initial");
  }

  function openPointPicker(point: AddPoint) {
    setSelectedKey(null);
    setAddTarget(point);
  }

  function placeTile(tile: TileDef, orientation: Orientation, row: number, col: number) {
    setEntries((prev) => [...prev, { key: makeKey(tile.id), tile, orientation, row, col }]);
    setAddTarget(null);
  }

  function removeTile(key: string) {
    setEntries((prev) => prev.filter((e) => e.key !== key));
    setSelectedKey(null);
  }

  function spin(key: string, dir: 1 | -1) {
    setEntries((prev) => {
      const entry = prev.find((e) => e.key === key);
      if (!entry) return prev;
      const list = rotationAngles(entry.tile.footprint);
      const idx = list.indexOf(entry.orientation.rotation);
      const rotation = list[(idx + dir + list.length) % list.length];
      if (!orientationValidAt(prev, key, { ...entry.orientation, rotation })) return prev;
      return prev.map((e) => (e.key === key ? { ...e, orientation: { ...e.orientation, rotation } } : e));
    });
  }

  function flip(key: string) {
    setEntries((prev) => {
      const entry = prev.find((e) => e.key === key);
      if (!entry) return prev;
      const orientation = { ...entry.orientation, flip: !entry.orientation.flip };
      if (!orientationValidAt(prev, key, orientation)) return prev;
      return prev.map((e) => (e.key === key ? { ...e, orientation } : e));
    });
  }

  // Map (row,col) to positive CSS grid line indices — entries/add-points can
  // have negative coordinates (growth in any direction), but grid lines
  // can't; this just offsets everything by the current min, uniformly.
  const rows = [...entries.map((e) => e.row), ...addPoints.map((p) => p.row)];
  const cols = [...entries.flatMap((e) => [e.col, e.col + e.tile.footprint - 1]), ...addPoints.map((p) => p.colStart), ...addPoints.map((p) => p.colEnd)];
  const minRow = rows.length ? Math.min(...rows) : 0;
  const maxRow = rows.length ? Math.max(...rows) : 0;
  const minCol = cols.length ? Math.min(...cols) : 0;
  const maxCol = cols.length ? Math.max(...cols) : 0;
  const gridRow = (row: number) => row - minRow + 1;
  const gridCol = (col: number) => col - minCol + 1;

  // Explicit per-track sizing instead of a blanket grid-auto-rows/columns:
  // a row/column that actually holds a placed tile needs the full tile unit
  // (so footprints line up), but a row/column that only holds an add-point
  // button or the picker (nothing placed there yet) should size to its own
  // content — otherwise every add-only row/column would render as a giant
  // empty tile-sized cell.
  const entryRows = new Set(entries.map((e) => e.row));
  const entryCols = new Set<number>();
  for (const e of entries) for (let c = 0; c < e.tile.footprint; c++) entryCols.add(e.col + c);
  const gridTemplateRows: string[] = [];
  for (let r = minRow; r <= maxRow; r++) gridTemplateRows.push(entryRows.has(r) ? "var(--shmup-connection-grid-unit)" : "auto");
  const gridTemplateColumns: string[] = [];
  for (let c = minCol; c <= maxCol; c++) gridTemplateColumns.push(entryCols.has(c) ? "var(--shmup-connection-grid-unit)" : "auto");

  const picker = addTarget !== null && (
    <div className="shmup-tile-picker">
      {candidates.length === 0 ? (
        <p className="shmup-hint">No tiles connect here.</p>
      ) : (
        candidates.map(({ tile, orientation, row, col }) => (
          <button key={tile.id} type="button" className="shmup-tile-picker__option" onClick={() => placeTile(tile, orientation, row, col)}>
            <TileArt tile={tile} orientation={orientation} size="thumb" />
          </button>
        ))
      )}
      <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setAddTarget(null)}>
        Cancel
      </button>
    </div>
  );

  if (entries.length === 0) {
    return (
      <div className="shmup-connection-viewer">
        <div className="shmup-strip-add-row--initial">
          <button type="button" className="shmup-strip-add" onClick={openInitialPicker}>
            + Add
          </button>
          {picker}
        </div>
      </div>
    );
  }

  function handlePlaytest() {
    saveLevel(entries);
    playtestLevel(difficulty);
  }

  return (
    <div className="shmup-connection-viewer">
      <div className="shmup-connection-viewer__toolbar">
        <button type="button" className="shmup-btn shmup-btn--primary" onClick={handlePlaytest}>
          ▶ Play Test Level
        </button>
        <div className="shmup-connection-viewer__difficulty">
          <button
            type="button"
            className="shmup-btn shmup-btn--small"
            onClick={() => setDifficulty((d) => Math.max(0, d - DIFFICULTY_STEP))}
            aria-label="Lower difficulty"
          >
            −
          </button>
          {/* Difficulty is not decoration: an instance whose minCostPerInstance
              exceeds it doesn't spawn at all, so a level played too low is
              legitimately empty. */}
          <span className="shmup-connection-viewer__difficulty-value">Diff. {difficulty}</span>
          <button
            type="button"
            className="shmup-btn shmup-btn--small"
            onClick={() => setDifficulty((d) => Math.min(DIFFICULTY_MAX, d + DIFFICULTY_STEP))}
            aria-label="Raise difficulty"
          >
            +
          </button>
        </div>
      </div>
      <div className="shmup-connection-viewer__scroll">
        <div
          className="shmup-connection-viewer__grid"
          style={{ gridTemplateRows: gridTemplateRows.join(" "), gridTemplateColumns: gridTemplateColumns.join(" ") }}
        >
          {entries.map((entry) => {
            const selected = selectedKey === entry.key;
            const rotList = rotationAngles(entry.tile.footprint);
            const rotIdx = rotList.indexOf(entry.orientation.rotation);
            const canRotateLeft = orientationValidAt(entries, entry.key, { ...entry.orientation, rotation: rotList[(rotIdx - 1 + rotList.length) % rotList.length] });
            const canRotateRight = orientationValidAt(entries, entry.key, { ...entry.orientation, rotation: rotList[(rotIdx + 1) % rotList.length] });
            const canFlip = orientationValidAt(entries, entry.key, { ...entry.orientation, flip: !entry.orientation.flip });
            const canDelete = canDeleteEntry(entries, entry.key);
            return (
              <div
                key={entry.key}
                className="shmup-strip-entry"
                style={{ gridRow: gridRow(entry.row), gridColumn: `${gridCol(entry.col)} / span ${entry.tile.footprint}` }}
                onClick={() => setSelectedKey((k) => (k === entry.key ? null : entry.key))}
              >
                <TileArt tile={entry.tile} orientation={entry.orientation} size="strip" showName={false} />
                {selected && (
                  <>
                    <button
                      type="button"
                      className="shmup-strip-entry__btn shmup-strip-entry__btn--delete"
                      disabled={!canDelete}
                      title={canDelete ? "Delete" : "Can't delete — would split the grid (only tiles with 0-1 neighbors can be removed)"}
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
          {addPoints.map((point) => (
            <button
              key={point.key}
              type="button"
              className={`shmup-grid-add shmup-grid-add--${point.side}`}
              style={{ gridRow: gridRow(point.row), gridColumn: `${gridCol(point.colStart)} / span ${point.colEnd - point.colStart + 1}` }}
              onClick={() => openPointPicker(point)}
              title={`Add to the ${point.side}`}
            >
              {ADD_ARROW[point.side]}
            </button>
          ))}
          {addTarget !== null && addTarget !== "initial" && (
            <div
              className="shmup-connection-viewer__picker-slot"
              style={{ gridRow: gridRow(addTarget.row), gridColumn: `${gridCol(addTarget.colStart)} / span ${addTarget.colEnd - addTarget.colStart + 1}` }}
            >
              {picker}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
