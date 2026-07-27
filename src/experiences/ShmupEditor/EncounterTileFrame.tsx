import { HARDWALL, resolveTileImageUrl, slotTag, type TileDef } from "./types";

interface EncounterTileFrameProps {
  tile: TileDef;
  widthPx: number;
  heightPx: number;
}

function edgeLabel(tag: string): string {
  return tag === HARDWALL ? "WALL" : tag || "?";
}

/**
 * Read-only reference frame showing the tile's actual footprint/edges
 * behind the encounter canvas (specs/shmup-editor.md's Encounter editor
 * section) — so an enemy's entrance/exit can be placed meaningfully
 * relative to where this tile really connects to its neighbors, not in an
 * abstract unrelated space. Deliberately not `TilePreview` (that's an
 * *editable* schematic with edge dropdowns); this is just a labeled
 * silhouette to place nodes against.
 */
export default function EncounterTileFrame({ tile, widthPx, heightPx }: EncounterTileFrameProps) {
  const imageUrl = resolveTileImageUrl(tile);
  return (
    <div
      className="shmup-encounter-frame"
      style={{ width: widthPx, height: heightPx, backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }}
    >
      <div className="shmup-encounter-frame__edge shmup-encounter-frame__edge--north">
        {tile.north.map((s, i) => (
          <span key={i}>{edgeLabel(slotTag(s))}</span>
        ))}
      </div>
      <div className="shmup-encounter-frame__edge shmup-encounter-frame__edge--south">
        {tile.south.map((s, i) => (
          <span key={i}>{edgeLabel(slotTag(s))}</span>
        ))}
      </div>
      <div className="shmup-encounter-frame__edge shmup-encounter-frame__edge--east">
        <span>{edgeLabel(slotTag(tile.east))}</span>
      </div>
      <div className="shmup-encounter-frame__edge shmup-encounter-frame__edge--west">
        <span>{edgeLabel(slotTag(tile.west))}</span>
      </div>
    </div>
  );
}
