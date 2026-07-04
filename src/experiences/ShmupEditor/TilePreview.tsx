import { useMemo } from "react";
import { applyOrientation, validOrientations, type Orientation } from "./orientation";
import type { TileDef } from "./types";

interface TilePreviewProps {
  tile: TileDef;
  orientation: Orientation;
  onOrientationChange?: (orientation: Orientation) => void;
  size?: "small" | "large";
}

function orientationLabel(o: Orientation): string {
  return `${o.rotation}°${o.flip ? " flip" : ""}`;
}

export default function TilePreview({ tile, orientation, onOrientationChange, size = "large" }: TilePreviewProps) {
  const orientations = useMemo(() => validOrientations(tile.footprint), [tile.footprint]);
  const oriented = useMemo(() => applyOrientation(tile, orientation), [tile, orientation]);

  const columns = oriented.footprint;
  const gridTemplateColumns = `28px repeat(${columns}, 1fr) 28px`;

  return (
    <div className={`shmup-tile-preview shmup-tile-preview--${size}`}>
      <div className="shmup-tile-preview__grid" style={{ gridTemplateColumns }}>
        <div className="shmup-tile-preview__corner" />
        {oriented.north.map((slot, i) => (
          <div key={`n${i}`} className={`shmup-tile-preview__edge ${slot.hardwall ? "shmup-tile-preview__edge--hardwall" : ""}`}>
            {slot.hardwall ? "WALL" : slot.tag || "?"}
          </div>
        ))}
        <div className="shmup-tile-preview__corner" />

        <div className={`shmup-tile-preview__edge ${oriented.west.hardwall ? "shmup-tile-preview__edge--hardwall" : ""}`}>
          {oriented.west.hardwall ? "WALL" : oriented.west.tag || "?"}
        </div>
        <div
          className="shmup-tile-preview__body"
          style={{ gridColumn: `span ${columns}`, background: tile.color }}
        >
          <span className="shmup-tile-preview__name">{tile.name}</span>
          {tile.isConnector && <span className="shmup-tile-preview__badge">CONNECTOR</span>}
        </div>
        <div className={`shmup-tile-preview__edge ${oriented.east.hardwall ? "shmup-tile-preview__edge--hardwall" : ""}`}>
          {oriented.east.hardwall ? "WALL" : oriented.east.tag || "?"}
        </div>

        <div className="shmup-tile-preview__corner" />
        {oriented.south.map((slot, i) => (
          <div key={`s${i}`} className={`shmup-tile-preview__edge ${slot.hardwall ? "shmup-tile-preview__edge--hardwall" : ""}`}>
            {slot.hardwall ? "WALL" : slot.tag || "?"}
          </div>
        ))}
        <div className="shmup-tile-preview__corner" />
      </div>

      {onOrientationChange && (
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
