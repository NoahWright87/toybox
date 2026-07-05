import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import EdgePanel from "./EdgePanel";
import NodePanel from "./NodePanel";
import SpritePicker from "./SpritePicker";
import { resolveSpriteUrl } from "./enemySprites";
import { addChildNode, addRootNode, deleteEdge, deleteNode, getDescendantNodeIds, hasOutgoingEdge, moveNode } from "./enemyGraph";
import type { EnemyDef, GraphNode, Vec2 } from "./enemyTypes";

interface EnemyGraphEditorProps {
  enemy: EnemyDef;
  onSave: (enemy: EnemyDef) => void;
  onCancel: () => void;
  /** Called on every change (not just Save) so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (enemy: EnemyDef) => void;
}

type Selection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

const NODE_DIAMETER = 56;
const NODE_RADIUS = NODE_DIAMETER / 2;
const PADDING = 60;

function validate(enemy: EnemyDef): string | null {
  if (!enemy.name.trim()) return "Name is required.";
  return null;
}

/**
 * Free-form node-graph canvas + below-canvas settings panels + enemy-level
 * fields (name/sprite) + Save/Cancel — the E2 analogue of TileEditorForm.tsx.
 * Tap-driven, not drag-to-connect (see specs/shmup-editor.md): tapping a
 * node reveals on-canvas quick actions (a move handle, "+" to grow a linked
 * child node, delete), and a below-canvas tab panel for its settings.
 * Tapping an edge (the link between two nodes) does the same for movement/
 * attack/branch. There is no "connect two existing nodes" gesture — every
 * node except the entrance is created already-linked to its parent.
 */
export default function EnemyGraphEditor({ enemy, onSave, onCancel, onDraftChange }: EnemyGraphEditorProps) {
  const [draft, setDraft] = useState<EnemyDef>(enemy);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragPos, setDragPos] = useState<{ nodeId: string; pos: Vec2 } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const error = validate(draft);

  function updateDraft(next: EnemyDef) {
    setDraft(next);
    onDraftChange(next);
  }

  // Close the selection (and its panel) on a genuine outside tap — same
  // class-based "is this inside something that should keep it open" check
  // ConnectionViewer/TileList use, since a container ref alone doesn't
  // distinguish "empty canvas space" from "outside the canvas entirely."
  // Deliberately does NOT close on a tap that lands on any <button> (Save/
  // Cancel included): collapsing the panel on pointerdown shifts the page
  // layout, and if that shift moves the very button being tapped, the
  // subsequent mouseup/click can miss it entirely (caught by an end-to-end
  // Playwright pass where "Save Enemy" silently failed to fire). A button's
  // own onClick already does the right thing, so it doesn't need this
  // effect's help closing anything.
  useEffect(() => {
    if (!selection) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("button")) return;
      if (!target?.closest(".shmup-enemy-canvas-stage") && !target?.closest(".shmup-panel")) {
        setSelection(null);
        setPendingDeleteId(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selection]);

  function nodePos(node: GraphNode): Vec2 {
    return dragPos && dragPos.nodeId === node.id ? dragPos.pos : node.pos;
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  function selectNode(nodeId: string) {
    setPendingDeleteId(null);
    setSelection({ kind: "node", id: nodeId });
  }
  function selectEdge(edgeId: string) {
    setPendingDeleteId(null);
    setSelection({ kind: "edge", id: edgeId });
  }

  function addEntrance() {
    const next = addRootNode(draft, { x: 0, y: 0 });
    updateDraft(next);
    if (next.entranceNodeId) selectNode(next.entranceNodeId);
  }

  function addChild(parentId: string) {
    const next = addChildNode(draft, parentId);
    updateDraft(next);
    const added = next.nodes.find((n) => !draft.nodes.some((old) => old.id === n.id));
    if (added) selectNode(added.id);
  }

  function requestDeleteNode(nodeId: string) {
    const subtreeSize = getDescendantNodeIds(draft, nodeId).size;
    if (subtreeSize > 1 && pendingDeleteId !== nodeId) {
      setPendingDeleteId(nodeId);
      return;
    }
    updateDraft(deleteNode(draft, nodeId));
    setSelection(null);
    setPendingDeleteId(null);
  }

  function requestDeleteEdge(edgeId: string) {
    const edge = draft.edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const subtreeSize = getDescendantNodeIds(draft, edge.toNodeId).size;
    if (subtreeSize > 1 && pendingDeleteId !== edgeId) {
      setPendingDeleteId(edgeId);
      return;
    }
    updateDraft(deleteEdge(draft, edgeId));
    setSelection(null);
    setPendingDeleteId(null);
  }

  function beginDrag(nodeId: string, e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragPos({ nodeId, pos: nodePos(draft.nodes.find((n) => n.id === nodeId)!) });
  }
  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragPos || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setDragPos({ nodeId: dragPos.nodeId, pos: { x: e.clientX - rect.left - PADDING, y: e.clientY - rect.top - PADDING } });
  }
  function endDrag() {
    if (!dragPos) return;
    updateDraft(moveNode(draft, dragPos.nodeId, dragPos.pos));
    setDragPos(null);
  }

  const spriteUrl = resolveSpriteUrl(draft.spriteId, draft.customSprite);

  const xs = draft.nodes.map((n) => nodePos(n).x);
  const ys = draft.nodes.map((n) => nodePos(n).y);
  const minX = xs.length ? Math.min(...xs, 0) : 0;
  const minY = ys.length ? Math.min(...ys, 0) : 0;
  const maxX = xs.length ? Math.max(...xs, 0) : 0;
  const maxY = ys.length ? Math.max(...ys, 0) : 0;
  const width = maxX - minX + PADDING * 2;
  const height = maxY - minY + PADDING * 2;

  function toStage(pos: Vec2): Vec2 {
    return { x: pos.x - minX + PADDING, y: pos.y - minY + PADDING };
  }

  const selectedNode = selection?.kind === "node" ? draft.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedEdge = selection?.kind === "edge" ? draft.edges.find((e) => e.id === selection.id) : undefined;

  return (
    <div className="shmup-enemy-form">
      <div className="shmup-tile-form__toolbar">
        <label className="shmup-field shmup-field--inline">
          <span>Name</span>
          <input type="text" className="shmup-input" value={draft.name} onChange={(e) => updateDraft({ ...draft, name: e.target.value })} />
        </label>
      </div>

      <SpritePicker spriteId={draft.spriteId} customSprite={draft.customSprite} onChange={(spriteId, customSprite) => updateDraft({ ...draft, spriteId, customSprite })} />

      <p className="shmup-hint">Tap a node or link to edit it. Tap the + to grow a linked node; drag the ✥ handle to reposition.</p>

      {draft.nodes.length === 0 ? (
        <div className="shmup-strip-add-row--initial">
          <button type="button" className="shmup-strip-add" onClick={addEntrance}>
            + Add Entrance
          </button>
        </div>
      ) : (
        <div className="shmup-enemy-canvas-scroll">
          <div className="shmup-enemy-canvas-stage" ref={stageRef} style={{ width, height }} onPointerMove={onDragMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <svg className="shmup-enemy-canvas-svg" width={width} height={height}>
              <defs>
                <marker id="shmup-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#ffcc88" />
                </marker>
              </defs>
              {draft.edges.map((edge) => {
                const from = draft.nodes.find((n) => n.id === edge.fromNodeId);
                const to = draft.nodes.find((n) => n.id === edge.toNodeId);
                if (!from || !to) return null;
                const a = toStage(nodePos(from));
                const b = toStage(nodePos(to));
                const isSelected = selection?.kind === "edge" && selection.id === edge.id;
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
                        selectEdge(edge.id);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {draft.nodes.map((node) => {
              const pos = toStage(nodePos(node));
              const isEntrance = draft.entranceNodeId === node.id;
              const isLeaf = !hasOutgoingEdge(draft, node.id);
              const isSelected = selection?.kind === "node" && selection.id === node.id;
              return (
                <div key={node.id} className="shmup-enemy-node-wrap" style={{ left: pos.x - NODE_RADIUS, top: pos.y - NODE_RADIUS }}>
                  <button
                    type="button"
                    className={`shmup-enemy-node ${isSelected ? "shmup-enemy-node--selected" : ""}`}
                    style={spriteUrl ? { backgroundImage: `url(${spriteUrl})` } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectNode(node.id);
                    }}
                    title={isEntrance ? "Entrance node" : undefined}
                  >
                    {!spriteUrl && "●"}
                  </button>
                  <div className="shmup-enemy-node__badges">
                    {isEntrance && <span title="Entrance">▶</span>}
                    {node.dwell && <span title="Dwell">⏳</span>}
                    {node.attack?.enabled && <span title="Attack">🔫</span>}
                    {node.branch && <span title="Branch">⚡</span>}
                    {isLeaf && node.exit && <span title="Exit">🚪</span>}
                  </div>

                  {isSelected && (
                    <div className="shmup-enemy-node__controls">
                      <button
                        type="button"
                        className="shmup-enemy-node__btn shmup-enemy-node__btn--move"
                        title="Drag to move"
                        onPointerDown={(e) => beginDrag(node.id, e)}
                      >
                        ✥
                      </button>
                      {isLeaf && (
                        <button
                          type="button"
                          className="shmup-enemy-node__btn shmup-enemy-node__btn--add"
                          title="Add linked node"
                          onClick={(e) => {
                            e.stopPropagation();
                            addChild(node.id);
                          }}
                        >
                          +
                        </button>
                      )}
                      <button
                        type="button"
                        className="shmup-enemy-node__btn shmup-enemy-node__btn--delete"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteNode(node.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedNode && pendingDeleteId === selectedNode.id && (
        <div className="shmup-panel shmup-panel--confirm">
          <p className="shmup-hint">Delete this node and everything after it in the chain?</p>
          <div className="shmup-btn-row">
            <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => requestDeleteNode(selectedNode.id)}>
              Confirm
            </button>
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteId(null)}>
              Keep
            </button>
          </div>
        </div>
      )}
      {selectedEdge && pendingDeleteId === selectedEdge.id && (
        <div className="shmup-panel shmup-panel--confirm">
          <p className="shmup-hint">Delete this link and everything after it in the chain?</p>
          <div className="shmup-btn-row">
            <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => requestDeleteEdge(selectedEdge.id)}>
              Confirm
            </button>
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteId(null)}>
              Keep
            </button>
          </div>
        </div>
      )}

      {selectedNode && pendingDeleteId !== selectedNode.id && <NodePanel enemy={draft} node={selectedNode} onChange={updateDraft} />}
      {selectedEdge && pendingDeleteId !== selectedEdge.id && <EdgePanel enemy={draft} edge={selectedEdge} onChange={updateDraft} />}

      {error && <p className="shmup-error">{error}</p>}
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Enemy
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
