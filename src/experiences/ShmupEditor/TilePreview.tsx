import { useMemo } from "react";
import EdgeSelect from "./EdgeSelect";
import { applyOrientation, validOrientations, type Orientation } from "./orientation";
import { tileImageById } from "./tileImages";
import type { EdgeSlot, TileDef } from "./types";

const IDENTITY: Orientation = { rotation: 0, flip: false };

/** small = tile list cards, medium = connection tester, edit = the editor form (mobile-first: a 1x1 should fill most of a phone's width). */
type PreviewSize = "small" | "medium" | "edit";

interface TilePreviewProps {
  tile: TileDef;
  orientation?: Orientation;
  onOrientationChange?: (orientation: Orientation) => void;
  size?: PreviewSize;
  /** When true, each edge cell IS the control for that edge (a dropdown) instead of a static label. Always shown at identity orientation — editing a rotated view would have to be mapped back to the tile's authored (unrotated) data. */
  editable?: boolean;
  availableTags?: string[];
  onEdgeChange?: (side: "north" | "south" | "east" | "west", index: number, slot: EdgeSlot) => void;
  onRegisterTag?: (tag: string) => void;
}

function orientationLabel(o: Orientation): string {
  return `${o.rotation}°${o.flip ? " flip" : ""}`;
}

const COLUMN_WIDTH: Record<PreviewSize, string> = {
  small: "42px",
  medium: "64px",
  // vw-based so the browser keeps this responsive without any JS resize
  // handling — a 1x1 tile fills most of a phone's width, and a 2x1/3x1
  // tile overflows into horizontal scroll on the same small screen.
  edit: "min(78vw, 420px)",
};
const CORNER_WIDTH: Record<PreviewSize, string> = { small: "20px", medium: "26px", edit: "28px" };

export default function TilePreview({
  tile,
  orientation = IDENTITY,
  onOrientationChange,
  size = "medium",
  editable = false,
  availableTags = [],
  onEdgeChange,
  onRegisterTag,
}: TilePreviewProps) {
  const effectiveOrientation = editable ? IDENTITY : orientation;
  const orientations = useMemo(() => validOrientations(tile.footprint), [tile.footprint]);
  const oriented = useMemo(() => applyOrientation(tile, effectiveOrientation), [tile, effectiveOrientation]);
  const image = tileImageById(tile.imageId);

  const columns = oriented.footprint;
  const gridTemplateColumns = `${CORNER_WIDTH[size]} repeat(${columns}, ${COLUMN_WIDTH[size]}) ${CORNER_WIDTH[size]}`;

  function renderEdge(side: "north" | "south" | "east" | "west", index: number, slot: EdgeSlot, key: string) {
    if (editable && onEdgeChange && onRegisterTag) {
      return (
        <div key={key} className="shmup-tile-preview__edge shmup-tile-preview__edge--editable">
          <EdgeSelect
            slot={slot}
            availableTags={availableTags}
            onChange={(s) => onEdgeChange(side, index, s)}
            onRegisterTag={onRegisterTag}
            disabled={side === "south" && tile.isConnector}
          />
        </div>
      );
    }
    return (
      <div key={key} className={`shmup-tile-preview__edge ${slot.hardwall ? "shmup-tile-preview__edge--hardwall" : ""}`}>
        {slot.hardwall ? "WALL" : slot.tag || "?"}
      </div>
    );
  }

  return (
    <div className={`shmup-tile-preview shmup-tile-preview--${size}`}>
      <div className="shmup-tile-preview__grid" style={{ gridTemplateColumns }}>
        <div className="shmup-tile-preview__corner" />
        {oriented.north.map((slot, i) => renderEdge("north", i, slot, `n${i}`))}
        <div className="shmup-tile-preview__corner" />

        {renderEdge("west", 0, oriented.west, "w")}
        <div className={`shmup-tile-preview__body ${image.url ? "" : "shmup-tile-preview__body--empty"}`} style={{ gridColumn: `span ${columns}` }}>
          {/* One full copy of the tile's art per column, scaled to fill its own square — not a small repeating pattern. */}
          {Array.from({ length: columns }, (_, i) => (
            <div
              key={i}
              className="shmup-tile-preview__cell"
              style={image.url ? { backgroundImage: `url(${image.url})` } : undefined}
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

      {!editable && onOrientationChange && (
        <div className="shmup-tile-preview__orientations">
          {orientations.map((o) => (
            <button
              key={orientationLabel(o)}
              type="button"
              className={`shmup-btn shmup-btn--small ${
                o.rotation === orientation.rotation && o.flip === orientation.flip ? "shmup-btn--active" : ""
              }`}
              onClick={() => onOrientationChange(o)}
            >
              {orientationLabel(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
