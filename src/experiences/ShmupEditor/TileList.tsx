import { useEffect, useRef, useState } from "react";
import TileArt from "./TileArt";
import type { Orientation } from "./orientation";
import type { TileDef } from "./types";

interface TileListProps {
  tiles: TileDef[];
  onEdit: (tile: TileDef) => void;
  onDuplicate: (tile: TileDef) => void;
  onDelete: (tile: TileDef) => void;
}

const IDENTITY: Orientation = { rotation: 0, flip: false };

/**
 * A visual-checker grid, not a metadata card list: tiles render as pure art
 * (TileArt, no schematic/labels), tiled edge-to-edge with no gaps and
 * spanning their real footprint width, so neighboring tiles' art seams are
 * actually checkable at a glance — the point is judging how tiles read next
 * to each other (AI-generated art in particular can look off), not
 * browsing text. Per-tile actions live behind a small "⋮" corner button
 * instead of an always-visible row, so they don't compete with the art.
 */
export default function TileList({ tiles, onEdit, onDuplicate, onDelete }: TileListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const menuCellRef = useRef<HTMLDivElement | null>(null);

  // A no-gap grid means the open menu can visually sit over neighboring
  // tiles — closing on an outside click/tap keeps a forgotten-open menu
  // from looking like it belongs to (or obscures) the wrong tile.
  useEffect(() => {
    if (!expandedId) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuCellRef.current && !menuCellRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  if (tiles.length === 0) {
    return <p className="shmup-hint">No tiles yet — create one to get started.</p>;
  }

  function closeMenu() {
    setExpandedId(null);
    setPendingDeleteId(null);
  }

  function toggleMenu(tileId: string) {
    if (expandedId === tileId) {
      closeMenu();
    } else {
      // Switching straight from one tile's menu to another's must not carry
      // over an armed delete-confirm — otherwise reopening the first tile
      // later shows "Confirm/Keep" instead of a fresh "Delete".
      setExpandedId(tileId);
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="shmup-tile-list__grid">
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className="shmup-tile-list__cell"
          style={{ gridColumn: `span ${tile.footprint}` }}
          ref={expandedId === tile.id ? menuCellRef : undefined}
        >
          <TileArt tile={tile} orientation={IDENTITY} size="grid" showName={false} />
          <button type="button" className="shmup-tile-list__menu-btn" title={tile.name} onClick={() => toggleMenu(tile.id)}>
            ⋮
          </button>
          {expandedId === tile.id && (
            <div className="shmup-tile-list__menu">
              <span className="shmup-tile-list__menu-name">
                {tile.name} ({tile.footprint}x1)
              </span>
              <div className="shmup-btn-row">
                <button
                  type="button"
                  className="shmup-btn shmup-btn--small"
                  onClick={() => {
                    closeMenu();
                    onEdit(tile);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="shmup-btn shmup-btn--small"
                  onClick={() => {
                    closeMenu();
                    onDuplicate(tile);
                  }}
                >
                  Duplicate
                </button>
                {pendingDeleteId === tile.id ? (
                  <>
                    <button
                      type="button"
                      className="shmup-btn shmup-btn--small shmup-btn--danger"
                      onClick={() => {
                        onDelete(tile);
                        closeMenu();
                      }}
                    >
                      Confirm
                    </button>
                    <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteId(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteId(tile.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
