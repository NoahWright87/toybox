import { useMemo } from "react";
import EdgeSelect from "./EdgeSelect";
import { applyOrientation, validOrientations, type Orientation } from "./orientation";
import type { EdgeSlot, TileDef } from "./types";

const IDENTITY: Orientation = { rotation: 0, flip: false };

interface TilePreviewProps {
  tile: TileDef;
  orientation?: Orientation;
  onOrientationChange?: (orientation: Orientation) => void;
  size?: "small" | "large";
  /** When true, each edge cell IS the control for that edge (a dropdown) instead of a static label. Always shown at identity orientation — editing a rotated view would have to be mapped back to the tile's authored (unrotated) data. */
  editable?: boolean;
  availableTags?: string[];
  onEdgeChange?: (side: "north" | "south" | "east" | "west", index: number, slot: EdgeSlot) => void;
  onRegisterTag?: (tag: string) => void;
}

function orientationLabel(o: Orientation): string {
  return `${o.rotation}°${o.flip ? " flip" : ""}`;
}

export default function TilePreview({
  tile,
  orientation = IDENTITY,
  onOrientationChange,
  size = "large",
  editable = false,
  availableTags = [],
  onEdgeChange,
  onRegisterTag,
}: TilePreviewProps) {
  const effectiveOrientation = editable ? IDENTITY : orientation;
  const orientations = useMemo(() => validOrientations(tile.footprint), [tile.footprint]);
  const oriented = useMemo(() => applyOrientation(tile, effectiveOrientation), [tile, effectiveOrientation]);

  const columns = oriented.footprint;
  const columnWidth = size === "small" ? 44 : 64;
  const gridTemplateColumns = `28px repeat(${columns}, ${columnWidth}px) 28px`;

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
        <div className="shmup-tile-preview__body" style={{ gridColumn: `span ${columns}`, background: tile.color }}>
          <span className="shmup-tile-preview__name">{tile.name}</span>
          {tile.isConnector && <span className="shmup-tile-preview__badge">CONNECTOR</span>}
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
