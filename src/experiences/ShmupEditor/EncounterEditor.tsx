import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import EncounterTileFrame from "./EncounterTileFrame";
import EncounterTimeline from "./EncounterTimeline";
import StepPanel from "./StepPanel";
import { resolveSpriteUrl } from "./enemySprites";
import { addStep, deleteStepsFrom, isFirstStep, isLastStep, moveStep, updateStep } from "./encounterSteps";
import { createEncounterUnit, type EncounterDef, type EncounterStep, type EncounterUnit, type Vec2 } from "./encounterTypes";
import { computeInstancePreview } from "./movementPreview";
import type { TileDef } from "./types";
import type { UnitDef } from "./unitTypes";

interface EncounterEditorProps {
  tile: TileDef;
  units: UnitDef[];
  encounter: EncounterDef;
  onSave: (encounter: EncounterDef) => void;
  onCancel: () => void;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (encounter: EncounterDef) => void;
}

type Selection = { instanceId: string; stepId: string } | null;

const NODE_DIAMETER = 56;
const NODE_RADIUS = NODE_DIAMETER / 2;
/** The live-preview marker (see movementPreview.ts) is smaller than a waypoint node so it visually reads as secondary, not another authored step. */
const PREVIEW_DIAMETER = 36;
const PREVIEW_RADIUS = PREVIEW_DIAMETER / 2;
const PADDING = 60;
/** Reference-frame sizing: matches encounterSteps.ts's default next-step offset, so a freshly grown sequence reads at a similar scale to the tile itself. */
const TILE_UNIT = 130;

function validate(encounter: EncounterDef): string | null {
  if (!encounter.name.trim()) return "Name is required.";
  if (encounter.weight <= 0) return "Weight must be positive.";
  return null;
}

function deleteKey(instanceId: string, stepId: string): string {
  return `${instanceId}:${stepId}`;
}

/**
 * Canvas for one tile's encounter — places one or more Unit INSTANCES
 * (each referencing a UnitDef for sprite/stats/Action buffet) and, for
 * each, a flat ordered STEP sequence (specs/shmup-editor.md's Encounter
 * editor section). No graph, no separately-configured edges — a step is
 * `{ position, time, action }`, and the action (movement/attack/
 * animation) is looked up on the referenced Unit, not authored here. The
 * tile's real footprint/edges render as a fixed reference frame
 * (EncounterTileFrame) so placement is meaningful relative to the tile's
 * actual neighbors. Tap a step to move/extend/delete it and edit which
 * Action it uses; `EncounterTimeline` below the canvas is the primary way
 * to set *when* it happens (drag on a shared ruler) and doubles as a live
 * motion preview — scrubbing or hitting Play interpolates each instance's
 * actual position via `movementPreview.ts` and renders it as a small
 * ghost marker on top of the authored waypoints.
 */
export default function EncounterEditor({ tile, units, encounter, onSave, onCancel, onDraftChange }: EncounterEditorProps) {
  const [draft, setDraft] = useState<EncounterDef>(encounter);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragPos, setDragPos] = useState<{ instanceId: string; stepId: string; pos: Vec2 } | null>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const error = validate(draft);

  // Ephemeral preview state (scrub position, play/pause) is intentionally
  // NOT part of `draft`/onDraftChange — it's a viewing aid, not authored
  // content, so it doesn't need to survive a reload like the actual steps do.
  const allStepTimes = draft.units.flatMap((u) => u.steps.map((s) => s.time));
  const maxTime = allStepTimes.length > 0 ? Math.max(...allStepTimes) + 3 : 10;

  useEffect(() => {
    if (!playing) return;
    let raf: number;
    let last = performance.now();
    function tick(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      setScrubTime((t) => {
        const next = t + dt;
        return next > maxTime ? 0 : next;
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, maxTime]);

  function updateDraft(next: EncounterDef) {
    setDraft(next);
    onDraftChange(next);
  }

  function updateInstance(instanceId: string, updater: (instance: EncounterUnit) => EncounterUnit) {
    updateDraft({ ...draft, units: draft.units.map((u) => (u.id === instanceId ? updater(u) : u)) });
  }

  useEffect(() => {
    if (!selection) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target instanceof Element ? e.target : null;
      // A button's own onClick already does the right thing — see shmup-editor.md's
      // Encounter editor section (collapsing the panel on pointerdown shifted layout
      // under an in-flight click and silently ate the Save action).
      if (target?.closest("button")) return;
      if (!target?.closest(".shmup-enemy-canvas-stage") && !target?.closest(".shmup-panel") && !target?.closest(".shmup-timeline")) {
        setSelection(null);
        setPendingDeleteKey(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selection]);

  function stepPos(instanceId: string, step: { id: string; pos: Vec2 }): Vec2 {
    return dragPos && dragPos.instanceId === instanceId && dragPos.stepId === step.id ? dragPos.pos : step.pos;
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  function selectStep(instanceId: string, stepId: string) {
    setPendingDeleteKey(null);
    setSelection({ instanceId, stepId });
  }

  function addUnitInstance(unitDefId: string) {
    const unitDef = units.find((u) => u.id === unitDefId);
    const firstActionId = unitDef?.actions[0]?.id;
    if (!firstActionId) return;
    const index = draft.units.length;
    // Staggered diagonally (not just horizontally) so each new instance's
    // label doesn't render directly on top of the previous one's — still
    // just a default, since the move handle can reposition either.
    const startPos: Vec2 = { x: (tile.footprint * TILE_UNIT) / 2 + index * 110, y: -TILE_UNIT * 0.6 - index * 30 };
    const instance = addStep(createEncounterUnit(unitDefId), firstActionId, startPos);
    updateDraft({ ...draft, units: [...draft.units, instance] });
    setAddingUnit(false);
    const added = instance.steps[0];
    if (added) selectStep(instance.id, added.id);
  }

  function removeInstance(instanceId: string) {
    updateDraft({ ...draft, units: draft.units.filter((u) => u.id !== instanceId) });
    setSelection(null);
    setPendingDeleteKey(null);
  }

  function addNextStep(instanceId: string) {
    const before = draft.units.find((u) => u.id === instanceId);
    if (!before) return;
    const unitDef = units.find((u) => u.id === before.unitDefId);
    const firstActionId = unitDef?.actions[0]?.id;
    if (!firstActionId) return;
    const after = addStep(before, firstActionId);
    updateInstance(instanceId, () => after);
    const added = after.steps[after.steps.length - 1];
    if (added) selectStep(instanceId, added.id);
  }

  /** Deleting an instance's first step removes the whole instance from the encounter — an empty, step-less instance stub has no purpose. */
  function requestDeleteStep(instanceId: string, stepId: string) {
    const instance = draft.units.find((u) => u.id === instanceId);
    if (!instance) return;
    const idx = instance.steps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    const key = deleteKey(instanceId, stepId);
    const first = isFirstStep(instance, stepId);
    const subtreeSize = instance.steps.length - idx;
    const needsConfirm = (first || subtreeSize > 1) && pendingDeleteKey !== key;
    if (needsConfirm) {
      setPendingDeleteKey(key);
      return;
    }
    if (first) {
      removeInstance(instanceId);
      return;
    }
    updateInstance(instanceId, (i) => deleteStepsFrom(i, stepId));
    setSelection(null);
    setPendingDeleteKey(null);
  }

  function beginDrag(instanceId: string, stepId: string, pos: Vec2, e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragPos({ instanceId, stepId, pos });
  }
  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragPos || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setDragPos({ ...dragPos, pos: { x: e.clientX - rect.left - PADDING, y: e.clientY - rect.top - PADDING } });
  }
  function endDrag() {
    if (!dragPos) return;
    updateInstance(dragPos.instanceId, (i) => moveStep(i, dragPos.stepId, dragPos.pos));
    setDragPos(null);
  }

  // Bounding box spans every instance's every step PLUS the tile reference frame itself, so the frame is always visible even before any Unit is placed.
  const allPositions: Vec2[] = [
    { x: 0, y: 0 },
    { x: tile.footprint * TILE_UNIT, y: TILE_UNIT },
    ...draft.units.flatMap((inst) => inst.steps.map((s) => stepPos(inst.id, s))),
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

  const selectedInstance = selection ? draft.units.find((u) => u.id === selection.instanceId) : undefined;
  const selectedStep: EncounterStep | undefined = selectedInstance?.steps.find((s) => s.id === selection?.stepId);
  const selectedUnitDef = selectedInstance ? units.find((u) => u.id === selectedInstance.unitDefId) : undefined;

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
        Tap a step to select it. Tap the + (last step only) to add the next step; drag the ✥ handle to reposition. The dashed box is this tile's
        real footprint/edges, for reference. Use the timeline below to set when each step happens, and Play/scrub to preview motion (teal marker).
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
            {draft.units.flatMap((instance) =>
              instance.steps.slice(1).map((step, i) => {
                const prev = instance.steps[i];
                const a = toStage(stepPos(instance.id, prev));
                const b = toStage(stepPos(instance.id, step));
                return <line key={step.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffcc88" strokeWidth={2} markerEnd="url(#shmup-arrow)" />;
              })
            )}
          </svg>

          {draft.units.flatMap((instance) => {
            const unitDef = units.find((u) => u.id === instance.unitDefId);
            const spriteUrl = unitDef ? resolveSpriteUrl(unitDef.spriteId, unitDef.customSprite) : null;
            return instance.steps.map((step) => {
              const pos = toStage(stepPos(instance.id, step));
              const first = isFirstStep(instance, step.id);
              const last = isLastStep(instance, step.id);
              const action = unitDef?.actions.find((a) => a.id === step.actionId);
              const isSelected = selection?.instanceId === instance.id && selection.stepId === step.id;
              return (
                <div key={step.id} className="shmup-enemy-node-wrap" style={{ left: pos.x - NODE_RADIUS, top: pos.y - NODE_RADIUS }}>
                  <button
                    type="button"
                    className={`shmup-enemy-node ${isSelected ? "shmup-enemy-node--selected" : ""} ${action && !action.visible ? "shmup-enemy-node--hidden" : ""}`}
                    style={spriteUrl ? { backgroundImage: `url(${spriteUrl})` } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectStep(instance.id, step.id);
                    }}
                    title={unitDef?.name ?? "(missing Unit)"}
                  >
                    {!spriteUrl && "●"}
                  </button>
                  {first && <div className="shmup-enemy-node__label">{unitDef?.name ?? "?"}</div>}
                  <div className="shmup-enemy-node__badges">
                    {first && <span title="First step">▶</span>}
                    {action?.attack?.enabled && <span title="Attacks">🔫</span>}
                    {action && !action.visible && <span title="Hidden">👻</span>}
                  </div>

                  {isSelected && (
                    <div className="shmup-enemy-node__controls">
                      <button type="button" className="shmup-enemy-node__btn shmup-enemy-node__btn--move" title="Drag to move" onPointerDown={(e) => beginDrag(instance.id, step.id, step.pos, e)}>
                        ✥
                      </button>
                      {last && (
                        <button
                          type="button"
                          className="shmup-enemy-node__btn shmup-enemy-node__btn--add"
                          title="Add next step"
                          onClick={(e) => {
                            e.stopPropagation();
                            addNextStep(instance.id);
                          }}
                        >
                          +
                        </button>
                      )}
                      <button
                        type="button"
                        className="shmup-enemy-node__btn shmup-enemy-node__btn--delete"
                        title={first ? "Remove this Unit from the encounter" : "Delete"}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteStep(instance.id, step.id);
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

          {draft.units.map((instance) => {
            const unitDef = units.find((u) => u.id === instance.unitDefId);
            const preview = computeInstancePreview(instance, unitDef, scrubTime);
            if (!preview || !preview.action.visible) return null;
            const spriteUrl = unitDef ? resolveSpriteUrl(unitDef.spriteId, unitDef.customSprite) : null;
            const pos = toStage(preview.pos);
            return (
              <div
                key={`preview-${instance.id}`}
                className="shmup-enemy-preview-dot"
                style={{ left: pos.x - PREVIEW_RADIUS, top: pos.y - PREVIEW_RADIUS, backgroundImage: spriteUrl ? `url(${spriteUrl})` : undefined }}
                title={`${unitDef?.name ?? "?"} @ ${scrubTime.toFixed(1)}s`}
              />
            );
          })}
        </div>
      </div>

      <EncounterTimeline
        units={draft.units}
        unitDefs={units}
        maxTime={maxTime}
        scrubTime={scrubTime}
        onScrub={setScrubTime}
        playing={playing}
        onTogglePlay={() => setPlaying((v) => !v)}
        selection={selection}
        onSelectStep={selectStep}
        onRetimeStep={(instanceId, stepId, time) => updateInstance(instanceId, (i) => updateStep(i, stepId, { time }))}
      />

      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn" onClick={() => setAddingUnit((v) => !v)}>
          + Add Unit
        </button>
      </div>
      {addingUnit && (
        <div className="shmup-tile-picker">
          {units.length === 0 ? (
            <p className="shmup-hint">No Units in the library yet — create one first (Units menu).</p>
          ) : (
            units.map((u) => {
              const url = resolveSpriteUrl(u.spriteId, u.customSprite);
              return (
                <button key={u.id} type="button" className="shmup-tile-picker__option" onClick={() => addUnitInstance(u.id)} title={u.name}>
                  <div className="shmup-enemy-picker-thumb" style={url ? { backgroundImage: `url(${url})` } : undefined}>
                    {!url && <span>{u.name}</span>}
                  </div>
                </button>
              );
            })
          )}
          <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setAddingUnit(false)}>
            Cancel
          </button>
        </div>
      )}

      {selectedInstance && selectedStep && pendingDeleteKey === deleteKey(selectedInstance.id, selectedStep.id) && (
        <div className="shmup-panel shmup-panel--confirm">
          <p className="shmup-hint">
            {isFirstStep(selectedInstance, selectedStep.id)
              ? "Remove this Unit (and its whole sequence) from the encounter?"
              : "Delete this step and everything after it in the sequence?"}
          </p>
          <div className="shmup-btn-row">
            <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => requestDeleteStep(selectedInstance.id, selectedStep.id)}>
              Confirm
            </button>
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteKey(null)}>
              Keep
            </button>
          </div>
        </div>
      )}

      {selectedInstance && selectedStep && pendingDeleteKey !== deleteKey(selectedInstance.id, selectedStep.id) && (
        <StepPanel unit={selectedUnitDef} step={selectedStep} onChange={(patch) => updateInstance(selectedInstance.id, (i) => updateStep(i, selectedStep.id, patch))} />
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
