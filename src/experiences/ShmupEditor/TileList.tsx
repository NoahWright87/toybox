import { useState } from "react";
import TilePreview from "./TilePreview";
import type { TileDef } from "./types";

interface TileListProps {
  tiles: TileDef[];
  onEdit: (tile: TileDef) => void;
  onDuplicate: (tile: TileDef) => void;
  onDelete: (tile: TileDef) => void;
}

export default function TileList({ tiles, onEdit, onDuplicate, onDelete }: TileListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (tiles.length === 0) {
    return <p className="shmup-hint">No tiles yet — create one to get started.</p>;
  }

  return (
    <div className="shmup-tile-list">
      {tiles.map((tile) => (
        <div key={tile.id} className="shmup-tile-list__card">
          <TilePreview tile={tile} size="small" />
          <div className="shmup-tile-list__meta">
            <span className="shmup-tile-list__name">{tile.name}</span>
            <span className="shmup-tile-list__footprint">
              {tile.footprint}x1{tile.biome ? ` · ${tile.biome}` : ""}
            </span>
          </div>
          <div className="shmup-btn-row">
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => onEdit(tile)}>
              Edit
            </button>
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => onDuplicate(tile)}>
              Duplicate
            </button>
            {pendingDeleteId === tile.id ? (
              <>
                <button
                  type="button"
                  className="shmup-btn shmup-btn--small shmup-btn--danger"
                  onClick={() => {
                    onDelete(tile);
                    setPendingDeleteId(null);
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
      ))}
    </div>
  );
}
