import { resolveSpriteUrl } from "./enemySprites";
import type { UnitDef } from "./unitTypes";

interface UnitListProps {
  units: UnitDef[];
  onOpen: (unit: UnitDef) => void;
  /** True when the library is non-empty but the active layer filter matches nothing. */
  filtered: boolean;
}

/** Visual-checker grid of Unit sprites, same pattern as TileList.tsx — the whole cell opens the Unit, with Duplicate/Delete living in the Unit editor. */
export default function UnitList({ units, onOpen, filtered }: UnitListProps) {
  if (units.length === 0) {
    return <p className="shmup-hint">{filtered ? "No Units on that layer." : "No Units yet — create one to get started."}</p>;
  }

  return (
    <div className="shmup-tile-list__grid">
      {units.map((unit) => {
        const spriteUrl = resolveSpriteUrl(unit.spriteId, unit.customSprite);
        return (
          <button
            key={unit.id}
            type="button"
            className="shmup-tile-list__cell shmup-tile-list__cell--button"
            title={`${unit.name} — ${unit.hp} HP, ${unit.parts.length} part${unit.parts.length === 1 ? "" : "s"}`}
            onClick={() => onOpen(unit)}
          >
            <div className={`shmup-tile-art shmup-tile-art--grid ${spriteUrl ? "" : "shmup-enemy-list__cell--empty"}`}>
              <div className="shmup-tile-art__row">
                <div className={`shmup-tile-art__cell ${spriteUrl ? "" : "shmup-tile-art__cell--empty"}`}>
                  {spriteUrl && <div className="shmup-tile-art__image" style={{ backgroundImage: `url(${spriteUrl})` }} />}
                </div>
              </div>
            </div>
            <span className="shmup-tile-list__caption">{unit.name}</span>
          </button>
        );
      })}
    </div>
  );
}
