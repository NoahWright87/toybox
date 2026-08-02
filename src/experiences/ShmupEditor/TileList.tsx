import TileArt from "./TileArt";
import type { Orientation } from "./orientation";
import type { TileDef } from "./types";

interface TileListProps {
  tiles: TileDef[];
  onOpen: (tile: TileDef) => void;
  /** True when the library is non-empty but the active tag filter matches nothing — a different message from "no tiles yet". */
  filtered: boolean;
}

const IDENTITY: Orientation = { rotation: 0, flip: false };

/**
 * A visual-checker grid, not a metadata card list: tiles render as pure art
 * (TileArt, no schematic/labels), tiled edge-to-edge with no gaps and spanning
 * their real footprint width, so neighbouring tiles' art seams are actually
 * checkable at a glance — the point is judging how tiles read next to each
 * other (AI-generated art in particular can look off), not browsing text.
 *
 * **The whole cell is the button.** Opening a tile used to mean hitting an
 * 18x14px "⋮" in its corner and then picking "Edit" from the menu that opened —
 * two taps, the first on a target under half the size guidance, to do the thing
 * you almost always want. Duplicate and Delete moved into the tile editor
 * itself, which is where you already are when you decide you want them, and
 * which has room for them at a sane size.
 */
export default function TileList({ tiles, onOpen, filtered }: TileListProps) {
  if (tiles.length === 0) {
    return <p className="shmup-hint">{filtered ? "No tiles carry that tag." : "No tiles yet — create one to get started."}</p>;
  }

  return (
    <div className="shmup-tile-list__grid">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          className="shmup-tile-list__cell shmup-tile-list__cell--button"
          style={{ gridColumn: `span ${tile.footprint}` }}
          title={`${tile.name} (${tile.footprint}x1)`}
          onClick={() => onOpen(tile)}
        >
          <TileArt tile={tile} orientation={IDENTITY} size="grid" showName={false} />
          <span className="shmup-tile-list__caption">{tile.name}</span>
        </button>
      ))}
    </div>
  );
}
