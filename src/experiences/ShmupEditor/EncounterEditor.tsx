import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import EdgePanel from "./EdgePanel";
import EncounterTileFrame from "./EncounterTileFrame";
import NodePanel from "./NodePanel";
import { resolveSpriteUrl } from "./enemySprites";
import type { EnemyDef } from "./enemyTypes";
import { addChildNode, addRootNode, deleteEdge, deleteNode, getDescendantNodeIds, hasOutgoingEdge, moveNode } from "./encounterGraph";
import { createEncounterEnemy, type EncounterDef, type EncounterEnemy, type Vec2 } from "./encounterTypes";
import type { TileDef } from "./types";

interface EncounterEditorProps {
  tile: TileDef;
  enemies: EnemyDef[];
  encounter: EncounterDef;
  onSave: (encounter: EncounterDef) => void;
  onCancel: () => void;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (encounter: EncounterDef) => void;
}

type Selection = { kind: "node"; instanceId: string; nodeId: string } | { kind: "edge"; instanceId: string; edgeId: string } | null;

const NODE_DIAMETER = 56;
const NODE_RADIUS = NODE_DIAMETER / 2;
const PADDING = 60;
/** Reference-frame sizing: matches encounterGraph.ts's default child-node offset, so a freshly grown chain reads at a similar scale to the tile itself. */
const TILE_UNIT = 130;

function validate(encounter: EncounterDef): string | null {
  if (!encounter.name.trim()) return "Name is required.";
  if (encounter.weight <= 0) return "Weight must be positive.";
  return null;
}

function deleteKey(instanceId: string, id: string): string {
  return `${instanceId}:${id}`;
}

/**
 * Canvas for one tile's encounter — places one or more enemy INSTANCES
 * (each referencing an EnemyDef for sprite/stats) and, independently for
 * each, a movement/dwell/attack graph (specs/shmup-editor.md's Encounter
 * editor section). The tile's real footprint/edges render as a fixed
 * reference frame (EncounterTileFrame) so entrance/exit placement is
 * meaningful relative to the tile's actual neighbors, not an abstract
 * space. Tap-driven, same interaction model as the graph canvas this
 * replaced: tap a node for a move handle/+add/delete overlay, tap a link
 * for delete, below-canvas tabbed panels for the real param forms.
 */
export default function EncounterEditor({ tile, enemies, encounter, onSave, onCancel, onDraftChange }: EncounterEditorProps) {
  const [draft, setDraft] = useState<EncounterDef>(encounter);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragPos, setDragPos] = useState<{ instanceId: string; nodeId: string; pos: Vec2 } | null>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [addingEnemy, setAddingEnemy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const error = validate(draft);

  function updateDraft(next: EncounterDef) {
    setDraft(next);
    onDraftChange(next);
  }

  function updateInstance(instanceId: string, updater: (instance: EncounterEnemy) => EncounterEnemy) {
    updateDraft({ ...draft, enemies: draft.enemies.map((e) => (e.id === instanceId ? updater(e) : e)) });
  }

  useEffect(() => {
    if (!selection) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target instanceof Element ? e.target : null;
      // A button's own onClick already does the right thing — see shmup-editor.md's
      // Encounter editor section (collapsing the panel on pointerdown shifted layout
      // under an in-flight click and silently ate the Save action).
      if (target?.closest("button")) return;
      if (!target?.closest(".shmup-enemy-canvas-stage") && !target?.closest(".shmup-panel")) {
        setSelection(null);
        setPendingDeleteKey(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selection]);

  function nodePos(instanceId: string, node: { id: string; pos: Vec2 }): Vec2 {
    return dragPos && dragPos.instanceId === instanceId && dragPos.nodeId === node.id ? dragPos.pos : node.pos;
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  function selectNode(instanceId: string, nodeId: string) {
    setPendingDeleteKey(null);
    setSelection({ kind: "node", instanceId, nodeId });
  }
  function selectEdge(instanceId: string, edgeId: string) {
    setPendingDeleteKey(null);
    setSelection({ kind: "edge", instanceId, edgeId });
  }

  function addEnemyInstance(enemyDefId: string) {
    const index = draft.enemies.length;
    // Staggered diagonally (not just horizontally) so each new instance's
    // entrance label doesn't render directly on top of the previous one's —
    // still just a default, since the move handle can reposition either.
    const startPos: Vec2 = { x: (tile.footprint * TILE_UNIT) / 2 + index * 110, y: -TILE_UNIT * 0.6 - index * 30 };
    const instance = addRootNode(createEncounterEnemy(enemyDefId), startPos);
    updateDraft({ ...draft, enemies: [...draft.enemies, instance] });
    setAddingEnemy(false);
    if (instance.entranceNodeId) selectNode(instance.id, instance.entranceNodeId);
  }

  function removeInstance(instanceId: string) {
    updateDraft({ ...draft, enemies: draft.enemies.filter((e) => e.id !== instanceId) });
    setSelection(null);
    setPendingDeleteKey(null);
  }

  function addChild(instanceId: string, parentNodeId: string) {
    const before = draft.enemies.find((e) => e.id === instanceId)!;
    const after = addChildNode(before, parentNodeId);
    updateInstance(instanceId, () => after);
    const added = after.nodes.find((n) => !before.nodes.some((old) => old.id === n.id));
    if (added) selectNode(instanceId, added.id);
  }

  /** Deleting an instance's entrance removes the whole instance from the encounter — an empty graph-less instance stub has no purpose. */
  function requestDeleteNode(instanceId: string, nodeId: string) {
    const instance = draft.enemies.find((e) => e.id === instanceId);
    if (!instance) return;
    const key = deleteKey(instanceId, nodeId);
    const subtreeSize = getDescendantNodeIds(instance, nodeId).size;
    const isEntrance = nodeId === instance.entranceNodeId;
    const needsConfirm = (isEntrance || subtreeSize > 1) && pendingDeleteKey !== key;
    if (needsConfirm) {
      setPendingDeleteKey(key);
      return;
    }
    if (isEntrance) {
      removeInstance(instanceId);
      return;
    }
    updateInstance(instanceId, (i) => deleteNode(i, nodeId));
    setSelection(null);
    setPendingDeleteKey(null);
  }

  function requestDeleteEdge(instanceId: string, edgeId: string) {
    const instance = draft.enemies.find((e) => e.id === instanceId);
    const edge = instance?.edges.find((e) => e.id === edgeId);
    if (!instance || !edge) return;
    const key = deleteKey(instanceId, edgeId);
    const subtreeSize = getDescendantNodeIds(instance, edge.toNodeId).size;
    if (subtreeSize > 1 && pendingDeleteKey !== key) {
      setPendingDeleteKey(key);
      return;
    }
    updateInstance(instanceId, (i) => deleteEdge(i, edgeId));
    setSelection(null);
    setPendingDeleteKey(null);
  }

  function beginDrag(instanceId: string, nodeId: string, pos: Vec2, e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragPos({ instanceId, nodeId, pos });
  }
  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragPos || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setDragPos({ ...dragPos, pos: { x: e.clientX - rect.left - PADDING, y: e.clientY - rect.top - PADDING } });
  }
  function endDrag() {
    if (!dragPos) return;
    updateInstance(dragPos.instanceId, (i) => moveNode(i, dragPos.nodeId, dragPos.pos));
    setDragPos(null);
  }

  // Bounding box spans every instance's every node PLUS the tile reference frame itself, so the frame is always visible even before any enemy is placed.
  const allPositions: Vec2[] = [
    { x: 0, y: 0 },
    { x: tile.footprint * TILE_UNIT, y: TILE_UNIT },
    ...draft.enemies.flatMap((inst) => inst.nodes.map((n) => nodePos(inst.id, n))),
  ];
  const minX = Math.min(...allPositions.map((p) => p.x));
  const minY = Math.min(...allPositions.map((p) => p.y));
  const maxX = Math.max(...allPositions.map((p) => p.x));
  const maxY = Math.max(...allPositions.map((p) => p.y));
  const width = maxX - minX + PADDING * 2;
  const height = maxY - minY + PADDING * 2;

  function toStage(pos: Vec2): Vec2 {
    return { x: pos.x - minX + PADDING, y: pos.y - minY + PADDING };
  }

  type Selected = { kind: "node"; instance: EncounterEnemy; node: (typeof draft.enemies)[number]["nodes"][number] } | { kind: "edge"; instance: EncounterEnemy; edge: (typeof draft.enemies)[number]["edges"][number] } | null;
  const selected: Selected = (() => {
    if (!selection) return null;
    const instance = draft.enemies.find((e) => e.id === selection.instanceId);
    if (!instance) return null;
    if (selection.kind === "node") {
      const node = instance.nodes.find((n) => n.id === selection.nodeId);
      return node ? { kind: "node", instance, node } : null;
    }
    const edge = instance.edges.find((e) => e.id === selection.edgeId);
    return edge ? { kind: "edge", instance, edge } : null;
  })();

  const framePos = toStage({ x: 0, y: 0 });

  return (
    <div className="shmup-enemy-form">
      <div className="shmup-tile-form__toolbar">
        <label className="shmup-field shmup-field--inline">
          <span>Encounter name</span>
          <input type="text" className="shmup-input" value={draft.name} onChange={(e) => updateDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Weight</span>
          <input
            type="number"
            min={0}
            step={0.1}
            className="shmup-input shmup-input--small"
            value={draft.weight}
            onChange={(e) => updateDraft({ ...draft, weight: Number(e.target.value) })}
          />
        </label>
      </div>

      <p className="shmup-hint">
        Tap a node or link to edit it. Tap the + to grow a linked node; drag the ✥ handle to reposition. The dashed box is this tile's real
        footprint/edges, for reference.
      </p>

      <div className="shmup-enemy-canvas-scroll">
        <div
          className="shmup-enemy-canvas-stage"
          ref={stageRef}
          style={{ width, height }}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div style={{ position: "absolute", left: framePos.x, top: framePos.y }}>
            <EncounterTileFrame tile={tile} widthPx={tile.footprint * TILE_UNIT} heightPx={TILE_UNIT} />
          </div>

          <svg className="shmup-enemy-canvas-svg" width={width} height={height}>
            <defs>
              <marker id="shmup-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#ffcc88" />
              </marker>
            </defs>
            {draft.enemies.flatMap((instance) =>
              instance.edges.map((edge) => {
                const from = instance.nodes.find((n) => n.id === edge.fromNodeId);
                const to = instance.nodes.find((n) => n.id === edge.toNodeId);
                if (!from || !to) return null;
                const a = toStage(nodePos(instance.id, from));
                const b = toStage(nodePos(instance.id, to));
                const isSelected = selection?.kind === "edge" && selection.instanceId === instance.id && selection.edgeId === edge.id;
                return (
                  <g key={edge.id}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isSelected ? "#ff6b00" : "#ffcc88"} strokeWidth={isSelected ? 4 : 2} markerEnd="url(#shmup-arrow)" />
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={20}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectEdge(instance.id, edge.id);
                      }}
                    />
                  </g>
                );
              })
            )}
          </svg>

          {draft.enemies.flatMap((instance) => {
            const enemyDef = enemies.find((en) => en.id === instance.enemyDefId);
            const spriteUrl = enemyDef ? resolveSpriteUrl(enemyDef.spriteId, enemyDef.customSprite) : null;
            return instance.nodes.map((node) => {
              const pos = toStage(nodePos(instance.id, node));
              const isEntrance = instance.entranceNodeId === node.id;
              const isLeaf = !hasOutgoingEdge(instance, node.id);
              const isSelected = selection?.kind === "node" && selection.instanceId === instance.id && selection.nodeId === node.id;
              return (
                <div key={node.id} className="shmup-enemy-node-wrap" style={{ left: pos.x - NODE_RADIUS, top: pos.y - NODE_RADIUS }}>
                  <button
                    type="button"
                    className={`shmup-enemy-node ${isSelected ? "shmup-enemy-node--selected" : ""}`}
                    style={spriteUrl ? { backgroundImage: `url(${spriteUrl})` } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectNode(instance.id, node.id);
                    }}
                    title={enemyDef?.name ?? "(missing enemy)"}
                  >
                    {!spriteUrl && "●"}
                  </button>
                  {isEntrance && <div className="shmup-enemy-node__label">{enemyDef?.name ?? "?"}</div>}
                  <div className="shmup-enemy-node__badges">
                    {isEntrance && <span title="Entrance">▶</span>}
                    {node.dwell && <span title="Dwell">⏳</span>}
                    {node.attack?.enabled && <span title="Attack">🔫</span>}
                    {isLeaf && node.exit && <span title="Exit">🚪</span>}
                  </div>

                  {isSelected && (
                    <div className="shmup-enemy-node__controls">
                      <button type="button" className="shmup-enemy-node__btn shmup-enemy-node__btn--move" title="Drag to move" onPointerDown={(e) => beginDrag(instance.id, node.id, node.pos, e)}>
                        ✥
                      </button>
                      {isLeaf && (
                        <button
                          type="button"
                          className="shmup-enemy-node__btn shmup-enemy-node__btn--add"
                          title="Add linked node"
                          onClick={(e) => {
                            e.stopPropagation();
                            addChild(instance.id, node.id);
                          }}
                        >
                          +
                        </button>
                      )}
                      <button
                        type="button"
                        className="shmup-enemy-node__btn shmup-enemy-node__btn--delete"
                        title={isEntrance ? "Remove this enemy from the encounter" : "Delete"}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteNode(instance.id, node.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>

      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn" onClick={() => setAddingEnemy((v) => !v)}>
          + Add Enemy
        </button>
      </div>
      {addingEnemy && (
        <div className="shmup-tile-picker">
          {enemies.length === 0 ? (
            <p className="shmup-hint">No enemies in the library yet — create one first (Enemies menu).</p>
          ) : (
            enemies.map((en) => {
              const url = resolveSpriteUrl(en.spriteId, en.customSprite);
              return (
                <button key={en.id} type="button" className="shmup-tile-picker__option" onClick={() => addEnemyInstance(en.id)} title={en.name}>
                  <div className="shmup-enemy-picker-thumb" style={url ? { backgroundImage: `url(${url})` } : undefined}>
                    {!url && <span>{en.name}</span>}
                  </div>
                </button>
              );
            })
          )}
          <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setAddingEnemy(false)}>
            Cancel
          </button>
        </div>
      )}

      {selected && selected.kind === "node" && pendingDeleteKey === deleteKey(selected.instance.id, selected.node.id) && (
        <div className="shmup-panel shmup-panel--confirm">
          <p className="shmup-hint">
            {selected.node.id === selected.instance.entranceNodeId
              ? "Remove this enemy (and its whole path) from the encounter?"
              : "Delete this node and everything after it in the chain?"}
          </p>
          <div className="shmup-btn-row">
            <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => requestDeleteNode(selected.instance.id, selected.node.id)}>
              Confirm
            </button>
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteKey(null)}>
              Keep
            </button>
          </div>
        </div>
      )}
      {selected && selected.kind === "edge" && pendingDeleteKey === deleteKey(selected.instance.id, selected.edge.id) && (
        <div className="shmup-panel shmup-panel--confirm">
          <p className="shmup-hint">Delete this link and everything after it in the chain?</p>
          <div className="shmup-btn-row">
            <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => requestDeleteEdge(selected.instance.id, selected.edge.id)}>
              Confirm
            </button>
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteKey(null)}>
              Keep
            </button>
          </div>
        </div>
      )}

      {selected && selected.kind === "node" && pendingDeleteKey !== deleteKey(selected.instance.id, selected.node.id) && (
        <NodePanel instance={selected.instance} node={selected.node} onChange={(next) => updateInstance(selected.instance.id, () => next)} />
      )}
      {selected && selected.kind === "edge" && pendingDeleteKey !== deleteKey(selected.instance.id, selected.edge.id) && (
        <EdgePanel instance={selected.instance} edge={selected.edge} onChange={(next) => updateInstance(selected.instance.id, () => next)} />
      )}

      {error && <p className="shmup-error">{error}</p>}
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Encounter
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
