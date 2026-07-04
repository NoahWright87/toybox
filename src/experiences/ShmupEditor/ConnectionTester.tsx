import { useMemo, useState } from "react";
import TilePreview from "./TilePreview";
import { applyOrientation, findAlignments, type Orientation } from "./orientation";
import type { TileDef } from "./types";

interface ConnectionTesterProps {
  tiles: TileDef[];
}

const IDENTITY: Orientation = { rotation: 0, flip: false };

export default function ConnectionTester({ tiles }: ConnectionTesterProps) {
  const [aboveId, setAboveId] = useState<string>(tiles[0]?.id ?? "");
  const [belowId, setBelowId] = useState<string>(tiles[0]?.id ?? "");
  const [aboveOrientation, setAboveOrientation] = useState<Orientation>(IDENTITY);
  const [belowOrientation, setBelowOrientation] = useState<Orientation>(IDENTITY);

  const above = tiles.find((t) => t.id === aboveId);
  const below = tiles.find((t) => t.id === belowId);

  const alignments = useMemo(() => {
    if (!above || !below) return [];
    return findAlignments(applyOrientation(above, aboveOrientation), applyOrientation(below, belowOrientation));
  }, [above, below, aboveOrientation, belowOrientation]);

  if (tiles.length === 0) {
    return <p className="shmup-hint">Create at least one tile to test connections.</p>;
  }

  return (
    <div className="shmup-connection-tester">
      <div className="shmup-connection-tester__pair">
        <div className="shmup-connection-tester__slot">
          <label className="shmup-field">
            <span>Above (this tile's north edge is tested)</span>
            <select className="shmup-input" value={aboveId} onChange={(e) => setAboveId(e.target.value)}>
              {tiles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {above && <TilePreview tile={above} orientation={aboveOrientation} onOrientationChange={setAboveOrientation} />}
        </div>

        <div className="shmup-connection-tester__slot">
          <label className="shmup-field">
            <span>Below (this tile's south edge is tested)</span>
            <select className="shmup-input" value={belowId} onChange={(e) => setBelowId(e.target.value)}>
              {tiles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {below && <TilePreview tile={below} orientation={belowOrientation} onOrientationChange={setBelowOrientation} />}
        </div>
      </div>

      <div className="shmup-connection-tester__results">
        <h4>Possible attachments</h4>
        {alignments.length === 0 && <p className="shmup-hint">No overlapping alignment is possible at these footprints.</p>}
        {alignments.map((alignment) => (
          <div
            key={alignment.offset}
            className={`shmup-alignment ${alignment.allMatch ? "shmup-alignment--match" : "shmup-alignment--mismatch"}`}
          >
            <span className="shmup-alignment__offset">offset {alignment.offset}</span>
            <span className="shmup-alignment__status">{alignment.allMatch ? "✓ attaches" : "✗ blocked"}</span>
            <span className="shmup-alignment__columns">
              {alignment.columns.map((c, i) => (
                <span key={i} className={c.matched ? "shmup-col-ok" : "shmup-col-bad"}>
                  {c.aboveTag || "?"}/{c.belowTag || "?"}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
