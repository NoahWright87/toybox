import { useEffect, useRef, useState } from "react";
import { resolveSpriteUrl } from "./enemySprites";
import type { EnemyDef } from "./enemyTypes";

interface EnemyListProps {
  enemies: EnemyDef[];
  onEdit: (enemy: EnemyDef) => void;
  onDuplicate: (enemy: EnemyDef) => void;
  onDelete: (enemy: EnemyDef) => void;
}

/** Visual-checker grid of enemy sprites, same pattern as TileList.tsx — actions behind a small "⋮" corner button instead of an always-visible row. */
export default function EnemyList({ enemies, onEdit, onDuplicate, onDelete }: EnemyListProps) {
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

  if (enemies.length === 0) {
    return <p className="shmup-hint">No enemies yet — create one to get started.</p>;
  }

  function closeMenu() {
    setExpandedId(null);
    setPendingDeleteId(null);
  }

  function toggleMenu(enemyId: string) {
    if (expandedId === enemyId) {
      closeMenu();
    } else {
      setExpandedId(enemyId);
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="shmup-tile-list__grid">
      {enemies.map((enemy) => {
        const spriteUrl = resolveSpriteUrl(enemy.spriteId, enemy.customSprite);
        return (
          <div key={enemy.id} className="shmup-tile-list__cell" ref={expandedId === enemy.id ? menuCellRef : undefined}>
            <div className={`shmup-tile-art shmup-tile-art--grid ${spriteUrl ? "" : "shmup-enemy-list__cell--empty"}`}>
              <div className="shmup-tile-art__row">
                <div className={`shmup-tile-art__cell ${spriteUrl ? "" : "shmup-tile-art__cell--empty"}`}>
                  {spriteUrl && <div className="shmup-tile-art__image" style={{ backgroundImage: `url(${spriteUrl})` }} />}
                </div>
              </div>
            </div>
            <button type="button" className="shmup-tile-list__menu-btn" title={enemy.name} onClick={() => toggleMenu(enemy.id)}>
              ⋮
            </button>
            {expandedId === enemy.id && (
              <div className="shmup-tile-list__menu">
                <span className="shmup-tile-list__menu-name">
                  {enemy.name} ({enemy.nodes.length} node{enemy.nodes.length === 1 ? "" : "s"})
                </span>
                <div className="shmup-btn-row">
                  <button
                    type="button"
                    className="shmup-btn shmup-btn--small"
                    onClick={() => {
                      closeMenu();
                      onEdit(enemy);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="shmup-btn shmup-btn--small"
                    onClick={() => {
                      closeMenu();
                      onDuplicate(enemy);
                    }}
                  >
                    Duplicate
                  </button>
                  {pendingDeleteId === enemy.id ? (
                    <>
                      <button
                        type="button"
                        className="shmup-btn shmup-btn--small shmup-btn--danger"
                        onClick={() => {
                          onDelete(enemy);
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
                    <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteId(enemy.id)}>
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
