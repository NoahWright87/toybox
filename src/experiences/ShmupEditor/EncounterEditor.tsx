import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import EncounterTileFrame from "./EncounterTileFrame";
import EncounterTimeline from "./EncounterTimeline";
import StepPanel from "./StepPanel";
import AttackPanel from "./AttackPanel";
import { resolveSpriteUrl } from "./enemySprites";
import { clampHandleOffset, distanceBetween, resolveHandleIn, resolveHandleOut, resolveSegment } from "./bezier";
import { addStep, deleteStepsFrom, isFirstStep, isLastStep, moveStep, updateStep } from "./encounterSteps";
import { addAttack, deleteAttack, updateAttack } from "./encounterAttacks";
import { isStepTimeDerived, recomputeStepTimes, segmentArcLength, speedMultiplierForDuration } from "./encounterTiming";
import { createEncounterUnit, type EncounterAttack, type EncounterDef, type EncounterStep, type EncounterUnit, type Vec2 } from "./encounterTypes";
import { computeInstancePreview, LAST_STEP_PREVIEW_WINDOW } from "./movementPreview";
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

type Selection = { instanceId: string; kind: "step"; stepId: string } | { instanceId: string; kind: "attack"; attackId: string } | null;
type HandleDrag = { instanceId: string; stepId: string; which: "in" | "out"; offset: Vec2 } | null;
/** Dragging an attack's aim handle — unlike bezier handles (an offset from a fixed step position), an attack's anchor itself moves along the bezier path over time, so the only thing worth persisting is the angle, not a position offset. */
type AimDrag = { instanceId: string; attackId: string; angleDeg: number } | null;

const NODE_DIAMETER = 56;
const NODE_RADIUS = NODE_DIAMETER / 2;
/** The live-preview marker (see movementPreview.ts) is smaller than a waypoint node so it visually reads as secondary, not another authored step. */
const PREVIEW_DIAMETER = 36;
const PREVIEW_RADIUS = PREVIEW_DIAMETER / 2;
/** Real HTML button now (not an SVG circle) — smaller than the 28px move/add/delete node controls, but still a legitimate touch target, unlike the ~12px SVG dot this replaced. */
const HANDLE_DIAMETER = 22;
const HANDLE_RADIUS = HANDLE_DIAMETER / 2;
const PADDING = 60;
/** Reference-frame sizing: matches encounterSteps.ts's default next-step offset, so a freshly grown sequence reads at a similar scale to the tile itself. */
const TILE_UNIT = 130;
/** Attack-track markers are smaller than a movement waypoint node — secondary to the path, same "reads as another layer, not another waypoint" reasoning as PREVIEW_DIAMETER. */
const ATTACK_MARKER_DIAMETER = 32;
const ATTACK_MARKER_RADIUS = ATTACK_MARKER_DIAMETER / 2;
/** Purely visual length of the aim-direction indicator/handle from an attack's anchor position — not a stored value, just how far out the drag target renders. */
const AIM_HANDLE_LENGTH = 55;

function validate(encounter: EncounterDef): string | null {
  if (!encounter.name.trim()) return "Name is required.";
  if (encounter.weight <= 0) return "Weight must be positive.";
  return null;
}

function deleteKey(instanceId: string, stepId: string): string {
  return `${instanceId}:${stepId}`;
}

/** An attack's anchor position in world space — wherever the instance's bezier path (via computeInstancePreview) puts it at the attack's own time, plus the firing Part's offset. Falls back to the instance's first step (still positionally meaningful, even before the instance has technically "spawned") rather than nothing. */
function attackAnchorWorld(instance: EncounterUnit, unitDef: UnitDef | undefined, attack: EncounterAttack): Vec2 | null {
  if (!unitDef) return null;
  const part = unitDef.parts.find((p) => p.id === attack.partId);
  if (!part) return null;
  const basePos = computeInstancePreview(instance, unitDef, attack.time)?.pos ?? instance.steps[0]?.pos;
  if (!basePos) return null;
  return { x: basePos.x + part.offset.x, y: basePos.y + part.offset.y };
}

/**
 * Canvas for one tile's encounter — places one or more Unit INSTANCES
 * (each referencing a UnitDef for sprite/stats/Action buffet) and, for
 * each, a flat ordered STEP sequence (specs/shmup-editor.md's Encounter
 * editor section). No graph, no separately-configured edges — a step is
 * `{ position, time, action, handles }`, and the action (attack/animation
 * — no movement, see unitTypes.ts) is looked up on the referenced Unit,
 * not authored here. The tile's real footprint/edges render as a fixed
 * reference frame (EncounterTileFrame) so placement is meaningful relative
 * to the tile's actual neighbors. Tap a step to move/extend/delete it and
 * edit which Action it uses; `EncounterTimeline` below the canvas shows
 * *when* it happens and doubles as a live motion preview.
 *
 * **Every segment between two steps is a cubic bezier curve** (`bezier.ts`),
 * rendered as an SVG path instead of a straight line. Selecting a step
 * shows up to two small draggable handle dots (⬦, teal) connected to it by
 * a dashed stalk — one shaping the curve leaving it (skipped on the last
 * step), one shaping the curve arriving at it (skipped on the first step)
 * — dragging either bends the curve, clamped by the owning Unit's
 * `turnRate` relative to that segment's straight-line length.
 *
 * **Most steps' `time` is derived, not typed in.** `encounterTiming.ts`
 * computes it from the segment's arc length and the owning Unit's `speed`
 * — see that file's header for the full reasoning. `updateInstance` below
 * recomputes derived times after every mutation so this stays in sync
 * automatically; `handleRetimeStep` is what makes dragging a derived step
 * on the timeline still feel like "set the time" even though under the
 * hood it's solving for a speed adjustment instead.
 */
export default function EncounterEditor({ tile, units, encounter, onSave, onCancel, onDraftChange }: EncounterEditorProps) {
  const [draft, setDraft] = useState<EncounterDef>(encounter);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragPos, setDragPos] = useState<{ instanceId: string; stepId: string; pos: Vec2 } | null>(null);
  const [dragHandle, setDragHandle] = useState<HandleDrag>(null);
  const [dragAim, setDragAim] = useState<AimDrag>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [pickingAttackPartFor, setPickingAttackPartFor] = useState<string | null>(null);
  const [scrubTime, setScrubTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const error = validate(draft);

  // Ephemeral preview state (scrub position, play/pause) is intentionally
  // NOT part of `draft`/onDraftChange — it's a viewing aid, not authored
  // content, so it doesn't need to survive a reload like the actual steps do.
  const allStepTimes = draft.units.flatMap((u) => u.steps.map((s) => s.time));
  const maxTime = allStepTimes.length > 0 ? Math.max(...allStepTimes) + LAST_STEP_PREVIEW_WINDOW : 10;

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

  // Every mutation to an instance's steps runs through here so derived
  // times (encounterTiming.ts) always stay in sync with whatever changed —
  // a position drag, a handle drag, an action swap, a speedMultiplier
  // tweak all affect some step's arc-length/speed math, so recomputing
  // after every change (rather than only at specific call sites) is what
  // keeps a moving step's `time` honest without having to remember to do
  // it everywhere.
  function updateInstance(instanceId: string, updater: (instance: EncounterUnit) => EncounterUnit) {
    updateDraft({
      ...draft,
      units: draft.units.map((u) => {
        if (u.id !== instanceId) return u;
        const updated = updater(u);
        const unitDef = units.find((ud) => ud.id === updated.unitDefId);
        return recomputeStepTimes(updated, unitDef);
      }),
    });
  }

  /**
   * Dragging a step on the timeline. For a manually-timed step (first
   * step, or dwelling at the same position as its predecessor) this just
   * sets `time` directly, same as always. For a *derived* step, dragging
   * instead solves for the `speedMultiplier` the predecessor would need to
   * arrive exactly there (encounterTiming.ts's `speedMultiplierForDuration`)
   * and writes that onto the *predecessor* step — never onto the shared
   * Unit — so pacing is tunable per-placement without mutating the Unit's
   * reusable stats. `updateInstance`'s recompute then turns that
   * multiplier back into the step's actual `time`.
   */
  function handleRetimeStep(instanceId: string, stepId: string, draggedTime: number) {
    updateInstance(instanceId, (instance) => {
      const idx = instance.steps.findIndex((s) => s.id === stepId);
      const unitDef = units.find((u) => u.id === instance.unitDefId);
      if (idx <= 0 || !unitDef || !isStepTimeDerived(instance, stepId, unitDef)) {
        return updateStep(instance, stepId, { time: draggedTime });
      }
      const prev = instance.steps[idx - 1];
      const cur = instance.steps[idx];
      const arcLength = segmentArcLength(prev, cur, unitDef);
      const multiplier = speedMultiplierForDuration(arcLength, unitDef.speed, draggedTime - prev.time);
      return updateStep(instance, prev.id, { speedMultiplier: multiplier });
    });
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

  /** The step with position/handle overrides applied while a drag is in progress — used for rendering only, never written to `draft` until the drag ends. */
  function effectiveStep(instanceId: string, step: EncounterStep): EncounterStep {
    const pos = dragPos && dragPos.instanceId === instanceId && dragPos.stepId === step.id ? dragPos.pos : step.pos;
    const draggingThisHandle = dragHandle && dragHandle.instanceId === instanceId && dragHandle.stepId === step.id;
    const handleOut = draggingThisHandle && dragHandle.which === "out" ? dragHandle.offset : step.handleOut;
    const handleIn = draggingThisHandle && dragHandle.which === "in" ? dragHandle.offset : step.handleIn;
    return { ...step, pos, handleOut, handleIn };
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  function selectStep(instanceId: string, stepId: string) {
    setPendingDeleteKey(null);
    setPickingAttackPartFor(null);
    setSelection({ instanceId, kind: "step", stepId });
  }

  function selectAttack(instanceId: string, attackId: string) {
    setPendingDeleteKey(null);
    setPickingAttackPartFor(null);
    setSelection({ instanceId, kind: "attack", attackId });
  }

  function addUnitInstance(unitDefId: string) {
    const index = draft.units.length;
    // Staggered diagonally (not just horizontally) so each new instance's
    // label doesn't render directly on top of the previous one's — still
    // just a default, since the move handle can reposition either.
    const startPos: Vec2 = { x: (tile.footprint * TILE_UNIT) / 2 + index * 110, y: -TILE_UNIT * 0.6 - index * 30 };
    const instance = addStep(createEncounterUnit(unitDefId), startPos);
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
    const after = addStep(before);
    updateInstance(instanceId, () => after);
    const added = after.steps[after.steps.length - 1];
    if (added) selectStep(instanceId, added.id);
  }

  /** Adds an attack-track placement for `partId`, defaulting `time` to `atTime` and the weapon to that Part's first — a no-op if the Part has no Weapons yet (nothing to reference). */
  function addAttackToPart(instanceId: string, partId: string, atTime: number) {
    const before = draft.units.find((u) => u.id === instanceId);
    const unitDef = units.find((u) => u.id === before?.unitDefId);
    const part = unitDef?.parts.find((p) => p.id === partId);
    const weaponId = part?.weapons[0]?.id;
    if (!before || !weaponId) return;
    const after = addAttack(before, partId, weaponId, atTime);
    updateInstance(instanceId, () => after);
    setPickingAttackPartFor(null);
    const added = after.attacks[after.attacks.length - 1];
    if (added) selectAttack(instanceId, added.id);
  }

  /** Tapping "+ Attack" on a selected step: if the Unit has exactly one Part, add directly to it; otherwise show a small Part picker (mirrors "+ Add Unit"'s picker pattern). */
  function requestAddAttack(instanceId: string, unitDef: UnitDef | undefined, atTime: number) {
    if (!unitDef || unitDef.parts.length === 0) return;
    if (unitDef.parts.length === 1) {
      addAttackToPart(instanceId, unitDef.parts[0].id, atTime);
      return;
    }
    setPickingAttackPartFor(instanceId);
  }

  function deleteAttackEvent(instanceId: string, attackId: string) {
    updateInstance(instanceId, (i) => deleteAttack(i, attackId));
    setSelection(null);
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
  function endDrag() {
    if (!dragPos) return;
    updateInstance(dragPos.instanceId, (i) => moveStep(i, dragPos.stepId, dragPos.pos));
    setDragPos(null);
  }

  /** Begins dragging `which` handle of `stepId`, seeding the drag from its current resolved (possibly-defaulted, turnRate-clamped) absolute position so the dot doesn't jump when you first touch it. */
  function beginHandleDrag(instanceId: string, stepId: string, which: "in" | "out", e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const instance = draft.units.find((u) => u.id === instanceId);
    const idx = instance?.steps.findIndex((s) => s.id === stepId) ?? -1;
    if (!instance || idx === -1) return;
    const step = instance.steps[idx];
    const other = which === "out" ? instance.steps[idx + 1] : instance.steps[idx - 1];
    if (!other) return;
    const unitDef = units.find((u) => u.id === instance.unitDefId);
    const turnRate = unitDef?.turnRate ?? 1;
    const currentAbsolute = which === "out" ? resolveHandleOut(step, other.pos, turnRate) : resolveHandleIn(step, other.pos, turnRate);
    setDragHandle({ instanceId, stepId, which, offset: { x: currentAbsolute.x - step.pos.x, y: currentAbsolute.y - step.pos.y } });
  }
  function endHandleDrag() {
    if (!dragHandle) return;
    updateInstance(dragHandle.instanceId, (i) =>
      updateStep(i, dragHandle.stepId, dragHandle.which === "out" ? { handleOut: dragHandle.offset } : { handleIn: dragHandle.offset })
    );
    setDragHandle(null);
  }

  /** Seeds the drag from the attack's current (possibly-overridden) angle, same "don't jump on first touch" reasoning as beginHandleDrag. */
  function beginAimDrag(instanceId: string, attackId: string, e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const instance = draft.units.find((u) => u.id === instanceId);
    const attack = instance?.attacks.find((a) => a.id === attackId);
    if (!instance || !attack) return;
    const unitDef = units.find((u) => u.id === instance.unitDefId);
    const part = unitDef?.parts.find((p) => p.id === attack.partId);
    const weapon = part?.weapons.find((w) => w.id === attack.weaponId);
    setDragAim({ instanceId, attackId, angleDeg: attack.aimAngleOverride ?? weapon?.fixedAngleDeg ?? 0 });
  }
  function endAimDrag() {
    if (!dragAim) return;
    updateInstance(dragAim.instanceId, (i) => updateAttack(i, dragAim.attackId, { aimAngleOverride: dragAim.angleDeg }));
    setDragAim(null);
  }

  // Inverse of toStage() (defined below, after the bounding box it depends
  // on) — screen/pointer coords back to world coords. minX/minY matter
  // here: they're nonzero whenever anything in the bounding box sits left
  // of or above the tile frame's own (0,0) corner, which is the *default*
  // case for a freshly-added Unit instance (staggered above the frame with
  // negative Y). Omitting them was a real bug — dragging (a step's
  // position, or now a bezier handle) landed at the wrong world position
  // by exactly minX/minY whenever the canvas's bounding box didn't happen
  // to start at the origin, which a Playwright test with a non-numeric
  // assertion (visual-only) would never have caught.
  function toWorld(clientX: number, clientY: number): Vec2 | null {
    if (!stageRef.current) return null;
    const rect = stageRef.current.getBoundingClientRect();
    return { x: clientX - rect.left - PADDING + minX, y: clientY - rect.top - PADDING + minY };
  }

  function onStagePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const worldPos = toWorld(e.clientX, e.clientY);
    if (!worldPos) return;
    if (dragPos) {
      setDragPos({ ...dragPos, pos: worldPos });
    }
    if (dragHandle) {
      const instance = draft.units.find((u) => u.id === dragHandle.instanceId);
      const idx = instance?.steps.findIndex((s) => s.id === dragHandle.stepId) ?? -1;
      if (instance && idx !== -1) {
        const step = instance.steps[idx];
        const other = dragHandle.which === "out" ? instance.steps[idx + 1] : instance.steps[idx - 1];
        if (other) {
          const unitDef = units.find((u) => u.id === instance.unitDefId);
          const turnRate = unitDef?.turnRate ?? 1;
          const segmentLength = distanceBetween(step.pos, other.pos);
          const rawOffset: Vec2 = { x: worldPos.x - step.pos.x, y: worldPos.y - step.pos.y };
          setDragHandle({ ...dragHandle, offset: clampHandleOffset(rawOffset, turnRate * segmentLength) });
        }
      }
    }
    if (dragAim) {
      const instance = draft.units.find((u) => u.id === dragAim.instanceId);
      const attack = instance?.attacks.find((a) => a.id === dragAim.attackId);
      const unitDef = units.find((u) => u.id === instance?.unitDefId);
      const anchor = instance && attack ? attackAnchorWorld(instance, unitDef, attack) : null;
      if (anchor) {
        const angleDeg = (Math.atan2(worldPos.y - anchor.y, worldPos.x - anchor.x) * 180) / Math.PI;
        setDragAim({ ...dragAim, angleDeg });
      }
    }
  }
  function onStagePointerUp() {
    endDrag();
    endHandleDrag();
    endAimDrag();
  }

  // Bounding box spans every instance's every step PLUS the tile reference frame itself, so the frame is always visible even before any Unit is placed.
  const allPositions: Vec2[] = [
    { x: 0, y: 0 },
    { x: tile.footprint * TILE_UNIT, y: TILE_UNIT },
    ...draft.units.flatMap((inst) => inst.steps.map((s) => effectiveStep(inst.id, s).pos)),
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
  const selectedStep: EncounterStep | undefined = selection?.kind === "step" ? selectedInstance?.steps.find((s) => s.id === selection.stepId) : undefined;
  const selectedAttack: EncounterAttack | undefined = selection?.kind === "attack" ? selectedInstance?.attacks.find((a) => a.id === selection.attackId) : undefined;
  const selectedUnitDef = selectedInstance ? units.find((u) => u.id === selectedInstance.unitDefId) : undefined;
  const selectedIdx = selectedInstance && selectedStep ? selectedInstance.steps.findIndex((s) => s.id === selectedStep.id) : -1;
  const selectedNextStep = selectedInstance && selectedIdx >= 0 ? selectedInstance.steps[selectedIdx + 1] : undefined;
  const hasOutgoingSegment = selectedInstance && selectedNextStep ? isStepTimeDerived(selectedInstance, selectedNextStep.id, selectedUnitDef) : false;

  // Aim-handle geometry for a selected attack — only rendered for a
  // "fixed"-aim weapon, since "player"-aimed weapons have no fixed angle to
  // drag (they track/snapshot the player at runtime instead).
  const selectedAttackPart = selectedAttack ? selectedUnitDef?.parts.find((p) => p.id === selectedAttack.partId) : undefined;
  const selectedAttackWeapon = selectedAttackPart ? selectedAttackPart.weapons.find((w) => w.id === selectedAttack?.weaponId) : undefined;
  const selectedAttackAnchor = selectedInstance && selectedAttack ? attackAnchorWorld(selectedInstance, selectedUnitDef, selectedAttack) : null;
  const draggingThisAim = dragAim && selectedAttack && dragAim.attackId === selectedAttack.id;
  const selectedAimAngleDeg = draggingThisAim ? dragAim.angleDeg : (selectedAttack?.aimAngleOverride ?? selectedAttackWeapon?.fixedAngleDeg ?? 0);
  const aimHandleStage =
    selectedAttackAnchor && selectedAttackWeapon?.aimMode === "fixed"
      ? toStage({
          x: selectedAttackAnchor.x + AIM_HANDLE_LENGTH * Math.cos((selectedAimAngleDeg * Math.PI) / 180),
          y: selectedAttackAnchor.y + AIM_HANDLE_LENGTH * Math.sin((selectedAimAngleDeg * Math.PI) / 180),
        })
      : null;

  // Computed once, used both for the SVG stalk lines (visual only) and the
  // HTML drag-target buttons below (real touch targets — see file header:
  // raw SVG circles were both too small and too fiddly to hit on mobile).
  const handleDots: { which: "in" | "out"; stage: Vec2 }[] = [];
  if (selectedInstance && selectedStep) {
    const turnRate = selectedUnitDef?.turnRate ?? 1;
    const effSelected = effectiveStep(selectedInstance.id, selectedStep);
    const prevStep = selectedIdx > 0 ? effectiveStep(selectedInstance.id, selectedInstance.steps[selectedIdx - 1]) : undefined;
    if (prevStep) handleDots.push({ which: "in", stage: toStage(resolveHandleIn(effSelected, prevStep.pos, turnRate)) });
    if (selectedNextStep) {
      const effNext = effectiveStep(selectedInstance.id, selectedNextStep);
      handleDots.push({ which: "out", stage: toStage(resolveHandleOut(effSelected, effNext.pos, turnRate)) });
    }
  }
  const selectedNodeStage = selectedInstance && selectedStep ? toStage(effectiveStep(selectedInstance.id, selectedStep).pos) : null;

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
        Tap a step to select it. Tap the + (last step only) to add the next step; drag the ✥ handle to reposition, or the teal ⬦ handles to bend
        the curve leaving/arriving at it. Tap 🔫+ to add an attack anywhere on that Unit's timeline — it fires from wherever its path puts it at
        that time, not tied to a movement waypoint; a fixed-aim attack gets its own draggable handle. The dashed box is this tile's real
        footprint/edges, for reference. Most steps' timing is automatic — based on distance and speed — but the timeline below still lets you
        drag to adjust pacing, and Play/scrub previews motion (teal marker).
      </p>

      <div className="shmup-enemy-canvas-scroll">
        <div
          className="shmup-enemy-canvas-stage"
          ref={stageRef}
          style={{ width, height }}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerUp}
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
            {draft.units.flatMap((instance) => {
              const unitDef = units.find((u) => u.id === instance.unitDefId);
              const turnRate = unitDef?.turnRate ?? 1;
              return instance.steps.slice(1).map((step, i) => {
                const prev = effectiveStep(instance.id, instance.steps[i]);
                const cur = effectiveStep(instance.id, step);
                const { p0, p1, p2, p3 } = resolveSegment(prev, cur, turnRate);
                const a = toStage(p0);
                const b = toStage(p1);
                const c = toStage(p2);
                const d = toStage(p3);
                return (
                  <path
                    key={step.id}
                    d={`M ${a.x},${a.y} C ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
                    fill="none"
                    stroke="#ffcc88"
                    strokeWidth={2}
                    markerEnd="url(#shmup-arrow)"
                  />
                );
              });
            })}

            {selectedNodeStage &&
              handleDots.map(({ which, stage }) => (
                <line
                  key={which}
                  x1={selectedNodeStage.x}
                  y1={selectedNodeStage.y}
                  x2={stage.x}
                  y2={stage.y}
                  stroke="#66ffee"
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                />
              ))}
          </svg>

          {/* Bezier handle drag targets — real HTML buttons (not SVG shapes) so they're actually hittable on mobile, same reasoning as the ✥/+/✕ node controls below. */}
          {selectedInstance &&
            selectedStep &&
            handleDots.map(({ which, stage }) => (
              <button
                key={which}
                type="button"
                className="shmup-handle-btn"
                title={which === "out" ? "Drag to bend the curve leaving this step" : "Drag to bend the curve arriving at this step"}
                style={{ left: stage.x - HANDLE_RADIUS, top: stage.y - HANDLE_RADIUS }}
                onPointerDown={(e) => beginHandleDrag(selectedInstance.id, selectedStep.id, which, e)}
              />
            ))}

          {/* An attack's aim handle — same real-HTML-button pattern, one per selected fixed-aim attack, drag to set its firing angle. */}
          {selectedInstance && selectedAttack && aimHandleStage && (
            <button
              type="button"
              className="shmup-handle-btn"
              title="Drag to aim"
              style={{ left: aimHandleStage.x - HANDLE_RADIUS, top: aimHandleStage.y - HANDLE_RADIUS }}
              onPointerDown={(e) => beginAimDrag(selectedInstance.id, selectedAttack.id, e)}
            />
          )}

          {draft.units.flatMap((instance) => {
            const unitDef = units.find((u) => u.id === instance.unitDefId);
            const spriteUrl = unitDef ? resolveSpriteUrl(unitDef.spriteId, unitDef.customSprite) : null;
            return instance.steps.map((step) => {
              const pos = toStage(effectiveStep(instance.id, step).pos);
              const first = isFirstStep(instance, step.id);
              const last = isLastStep(instance, step.id);
              const isSelected = selection?.kind === "step" && selection.instanceId === instance.id && selection.stepId === step.id;
              return (
                <div key={step.id} className="shmup-enemy-node-wrap" style={{ left: pos.x - NODE_RADIUS, top: pos.y - NODE_RADIUS }}>
                  <button
                    type="button"
                    className={`shmup-enemy-node ${isSelected ? "shmup-enemy-node--selected" : ""} ${!step.visible ? "shmup-enemy-node--hidden" : ""}`}
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
                    {!step.visible && <span title="Hidden">👻</span>}
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
                        className="shmup-enemy-node__btn shmup-enemy-node__btn--attack"
                        title={unitDef && unitDef.parts.some((p) => p.weapons.length > 0) ? "Add an attack at this step's time" : "Add a Weapon to this Unit's Parts first (Units menu)"}
                        disabled={!unitDef || !unitDef.parts.some((p) => p.weapons.length > 0)}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestAddAttack(instance.id, unitDef, step.time);
                        }}
                      >
                        🔫+
                      </button>
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
                  {pickingAttackPartFor === instance.id && isSelected && unitDef && (
                    <div className="shmup-tile-picker shmup-part-picker">
                      {unitDef.parts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="shmup-btn shmup-btn--small"
                          disabled={p.weapons.length === 0}
                          title={p.weapons.length === 0 ? "This Part has no Weapons yet" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            addAttackToPart(instance.id, p.id, step.time);
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                      <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPickingAttackPartFor(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            });
          })}

          {draft.units.flatMap((instance) => {
            const unitDef = units.find((u) => u.id === instance.unitDefId);
            if (!unitDef) return [];
            return instance.attacks.map((attack) => {
              const part = unitDef.parts.find((p) => p.id === attack.partId);
              const weapon = part?.weapons.find((w) => w.id === attack.weaponId);
              const anchorWorld = attackAnchorWorld(instance, unitDef, attack);
              if (!anchorWorld) return null;
              const pos = toStage(anchorWorld);
              const isSelected = selection?.kind === "attack" && selection.instanceId === instance.id && selection.attackId === attack.id;
              const partSpriteUrl = part ? resolveSpriteUrl(part.spriteId, part.customSprite) : null;
              return (
                <div key={attack.id} className="shmup-attack-marker-wrap" style={{ left: pos.x - ATTACK_MARKER_RADIUS, top: pos.y - ATTACK_MARKER_RADIUS }}>
                  <button
                    type="button"
                    className={`shmup-attack-marker ${isSelected ? "shmup-attack-marker--selected" : ""}`}
                    style={partSpriteUrl ? { backgroundImage: `url(${partSpriteUrl})` } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAttack(instance.id, attack.id);
                    }}
                    title={`${part?.name ?? "?"}: ${weapon?.name ?? "(missing Weapon)"} @ ${attack.time.toFixed(1)}s`}
                  >
                    {!partSpriteUrl && "🔫"}
                  </button>
                  {isSelected && (
                    <div className="shmup-enemy-node__controls">
                      <button
                        type="button"
                        className="shmup-enemy-node__btn shmup-enemy-node__btn--delete"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAttackEvent(instance.id, attack.id);
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
            if (!preview || !preview.step.visible) return null;
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
        onSelectAttack={selectAttack}
        onRetimeStep={handleRetimeStep}
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
        <StepPanel
          step={selectedStep}
          timeDerived={isStepTimeDerived(selectedInstance, selectedStep.id, selectedUnitDef)}
          hasOutgoingSegment={hasOutgoingSegment}
          onChange={(patch) => updateInstance(selectedInstance.id, (i) => updateStep(i, selectedStep.id, patch))}
        />
      )}

      {selectedInstance && selectedAttack && (
        <AttackPanel
          unit={selectedUnitDef}
          attack={selectedAttack}
          onChange={(patch) => updateInstance(selectedInstance.id, (i) => updateAttack(i, selectedAttack.id, patch))}
        />
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
