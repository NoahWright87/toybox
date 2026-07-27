import { useMemo } from "react";
import EdgeSelect from "./EdgeSelect";
import { applyOrientation, type Orientation } from "./orientation";
import { resolveTileImageUrl, type EdgeSlot, type TileDef } from "./types";

const IDENTITY: Orientation = { rotation: 0, flip: false };

// vw-based so the browser keeps this responsive without any JS resize
// handling — a 1x1 tile fills most of a phone's width, and a 2x1/3x1 tile
// overflows into horizontal scroll on the same small screen.
const COLUMN_WIDTH = "min(78vw, 420px)";
// Wide enough for the rotated (writing-mode: vertical-rl) west/east
// dropdown text to actually be legible, not just show the arrow icon.
const CORNER_WIDTH = "40px";

interface TilePreviewProps {
  tile: TileDef;
  /** When true, each edge cell IS the control for that edge (a dropdown) instead of a static label. Always shown at identity orientation — editing a rotated view would have to be mapped back to the tile's authored (unrotated) data. */
  editable?: boolean;
  availableTags?: string[];
  onEdgeChange?: (side: "north" | "south" | "east" | "west", index: number, slot: EdgeSlot) => void;
  onRegisterTag?: (tag: string) => void;
}

/**
 * Read-only or editable schematic showing a tile's footprint/edges — used
 * by the editor form (the tile list is a pure-art visual-checker grid now,
 * TileList.tsx, not a schematic view). Always rendered at identity
 * orientation: this is about *authoring* edge data, not checking how a
 * tile looks rotated (see TileArt + ConnectionViewer for that).
 */
export default function TilePreview({ tile, editable = false, availableTags = [], onEdgeChange, onRegisterTag }: TilePreviewProps) {
  const oriented = useMemo(() => applyOrientation(tile, IDENTITY), [tile]);
  const imageUrl = resolveTileImageUrl(tile);

  const columns = oriented.footprint;
  const gridTemplateColumns = `${CORNER_WIDTH} repeat(${columns}, ${COLUMN_WIDTH}) ${CORNER_WIDTH}`;

  function renderEdge(side: "north" | "south" | "east" | "west", index: number, slot: EdgeSlot, key: string) {
    const vertical = side === "east" || side === "west";
    const verticalClass = vertical ? "shmup-tile-preview__edge--vertical" : "";
    if (editable && onEdgeChange && onRegisterTag) {
      return (
        <div key={key} className={`shmup-tile-preview__edge shmup-tile-preview__edge--editable ${verticalClass}`}>
          <EdgeSelect
            slot={slot}
            availableTags={availableTags}
            onChange={(s) => onEdgeChange(side, index, s)}
            onRegisterTag={onRegisterTag}
            disabled={side === "south" && tile.isConnector}
            vertical={vertical}
          />
        </div>
      );
    }
    return (
      <div key={key} className={`shmup-tile-preview__edge ${slot.hardwall ? "shmup-tile-preview__edge--hardwall" : ""} ${verticalClass}`}>
        <span className={vertical ? "shmup-tile-preview__edge-text--vertical" : undefined}>
          {slot.hardwall ? "WALL" : slot.tag || "?"}
        </span>
      </div>
    );
  }

  return (
    <div className="shmup-tile-preview shmup-tile-preview--edit">
      <div className="shmup-tile-preview__grid" style={{ gridTemplateColumns }}>
        <div className="shmup-tile-preview__corner" />
        {oriented.north.map((slot, i) => renderEdge("north", i, slot, `n${i}`))}
        <div className="shmup-tile-preview__corner" />

        {renderEdge("west", 0, oriented.west, "w")}
        <div className={`shmup-tile-preview__body ${imageUrl ? "" : "shmup-tile-preview__body--empty"}`} style={{ gridColumn: `span ${columns}` }}>
          {/* One full copy of the tile's art per column, scaled to fill its own square — not a small repeating pattern. */}
          {Array.from({ length: columns }, (_, i) => (
            <div
              key={i}
              className="shmup-tile-preview__cell"
              style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
            />
          ))}
          <div className="shmup-tile-preview__label">
            <span className="shmup-tile-preview__name">{tile.name}</span>
            {tile.isConnector && <span className="shmup-tile-preview__badge">CONNECTOR</span>}
          </div>
        </div>
        {renderEdge("east", 0, oriented.east, "e")}

        <div className="shmup-tile-preview__corner" />
        {oriented.south.map((slot, i) => renderEdge("south", i, slot, `s${i}`))}
        <div className="shmup-tile-preview__corner" />
      </div>
    </div>
  );
}
