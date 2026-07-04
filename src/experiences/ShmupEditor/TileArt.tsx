import type { Orientation } from "./orientation";
import { resolveTileImageUrl, type TileDef } from "./types";

interface TileArtProps {
  tile: TileDef;
  orientation: Orientation;
  size?: "thumb" | "large";
}

/**
 * Art-only tile rendering for the Connection Tester (specs/shmup-editor.todo.md,
 * E1 #191 follow-up) — no edge-tag labels, just what the tile actually looks
 * like, so stacking tiles reads as "does this look/feel right" rather than a
 * table of connector words.
 *
 * The rotate/flip transform is applied to the whole row of columns (not each
 * cell individually): rotating/flipping a rigid row of N cells 180° both
 * mirrors each cell's art AND reverses the visual column order in one CSS
 * transform, matching orientation.ts's data-level column-reversal exactly
 * (today every column shows identical art so the reordering isn't visible,
 * but this stays correct once per-column art exists).
 */
export default function TileArt({ tile, orientation, size = "large" }: TileArtProps) {
  const imageUrl = resolveTileImageUrl(tile);
  const columns = tile.footprint;
  const transform = `scaleX(${orientation.flip ? -1 : 1}) rotate(${orientation.rotation}deg)`;

  return (
    <div className={`shmup-tile-art shmup-tile-art--${size}`}>
      <div className="shmup-tile-art__row" style={{ transform }}>
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className={`shmup-tile-art__cell ${imageUrl ? "" : "shmup-tile-art__cell--empty"}`}>
            {imageUrl && <div className="shmup-tile-art__image" style={{ backgroundImage: `url(${imageUrl})` }} />}
          </div>
        ))}
      </div>
      <span className="shmup-tile-art__name">{tile.name}</span>
    </div>
  );
}
