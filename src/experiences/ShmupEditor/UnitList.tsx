import { useEffect, useRef, useState } from "react";
import { resolveSpriteUrl } from "./enemySprites";
import type { UnitDef } from "./unitTypes";

interface UnitListProps {
  units: UnitDef[];
  onEdit: (unit: UnitDef) => void;
  onDuplicate: (unit: UnitDef) => void;
  onDelete: (unit: UnitDef) => void;
}

/** Visual-checker grid of Unit sprites, same pattern as TileList.tsx — actions behind a small "⋮" corner button instead of an always-visible row. */
export default function UnitList({ units, onEdit, onDuplicate, onDelete }: UnitListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const menuCellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expandedId) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuCellRef.current && !menuCellRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  if (units.length === 0) {
    return <p className="shmup-hint">No Units yet — create one to get started.</p>;
  }

  function closeMenu() {
    setExpandedId(null);
    setPendingDeleteId(null);
  }

  function toggleMenu(unitId: string) {
    if (expandedId === unitId) {
      closeMenu();
    } else {
      setExpandedId(unitId);
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="shmup-tile-list__grid">
      {units.map((unit) => {
        const spriteUrl = resolveSpriteUrl(unit.spriteId, unit.customSprite);
        return (
          <div key={unit.id} className="shmup-tile-list__cell" ref={expandedId === unit.id ? menuCellRef : undefined}>
            <div className={`shmup-tile-art shmup-tile-art--grid ${spriteUrl ? "" : "shmup-enemy-list__cell--empty"}`}>
              <div className="shmup-tile-art__row">
                <div className={`shmup-tile-art__cell ${spriteUrl ? "" : "shmup-tile-art__cell--empty"}`}>
                  {spriteUrl && <div className="shmup-tile-art__image" style={{ backgroundImage: `url(${spriteUrl})` }} />}
                </div>
              </div>
            </div>
            <button type="button" className="shmup-tile-list__menu-btn" title={unit.name} onClick={() => toggleMenu(unit.id)}>
              ⋮
            </button>
            {expandedId === unit.id && (
              <div className="shmup-tile-list__menu">
                <span className="shmup-tile-list__menu-name">
                  {unit.name} ({unit.hp} HP, {unit.actions.length} action{unit.actions.length === 1 ? "" : "s"})
                </span>
                <div className="shmup-btn-row">
                  <button
                    type="button"
                    className="shmup-btn shmup-btn--small"
                    onClick={() => {
                      closeMenu();
                      onEdit(unit);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="shmup-btn shmup-btn--small"
                    onClick={() => {
                      closeMenu();
                      onDuplicate(unit);
                    }}
                  >
                    Duplicate
                  </button>
                  {pendingDeleteId === unit.id ? (
                    <>
                      <button
                        type="button"
                        className="shmup-btn shmup-btn--small shmup-btn--danger"
                        onClick={() => {
                          onDelete(unit);
                          closeMenu();
                        }}
                      >
                        Confirm
                      </button>
                      <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteId(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteId(unit.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
