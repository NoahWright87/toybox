import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import EncounterTileFrame from "./EncounterTileFrame";
import EncounterTimeline from "./EncounterTimeline";
import EncounterMinimap from "./EncounterMinimap";
import StepPanel from "./StepPanel";
import PartActionPanel from "./PartActionPanel";
import UnitScalingPanel from "./UnitScalingPanel";
import { Dial } from "../../components/Dial/Dial";
import { resolveSpriteUrl } from "./enemySprites";
import { effectiveHandleIn, effectiveHandleOut, limitsFor, solvePathCached } from "./pathSolver";
import { addStep, deleteStepsFrom, isFirstStep, moveStep, updateStep } from "./encounterSteps";
import { addPartAction, deletePartAction, seedPartActions, updatePartAction } from "./partActions";
import { isStepTimeDerived, recomputeStepTimes } from "./encounterTiming";
import { resolveInvincibleAt } from "./actionState";
import { createEncounterUnit, type EncounterDef, type EncounterStep, type EncounterUnit, type PartActionPlacement, type Vec2 } from "./encounterTypes";
import { computeInstanceHeadingDeg, computeInstancePreview, LAST_STEP_PREVIEW_WINDOW } from "./movementPreview";
import { resolveScaling, type UnitScaling } from "./unitScaling";
import { applyPingPong, resolveScalingSlots } from "./unitScalingShapes";
import { computeAttackBullets, computeAttackDurationMs, computeCameraBoundsRect, computePlayerRefLocalY, resolveActionFacingDeg, resolveBulletRadius, PLAYER_REFERENCE_HITBOX_RADIUS } from "./hitboxPreview";
import { airPinSec, isScrollLocked, pinShiftY, referenceShiftY, type AuthorLayer } from "./airFrame";
import { TILE_UNIT } from "./editorScale";
import type { TileDef } from "./types";
import type { ActionAttack, ActionDef, UnitDef } from "./unitTypes";

interface EncounterEditorProps {
  tile: TileDef;
  units: UnitDef[];
  encounter: EncounterDef;
  onSave: (encounter: EncounterDef) => void;
  onCancel: () => void;
  /** Saves this encounter and hands off to the real game to play it — see `playtestLaunch.ts`. The caller owns persisting, since the game reads TILES.DAT rather than this draft. */
  onPlaytest: (encounter: EncounterDef, difficulty: number) => void;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (encounter: EncounterDef) => void;
}

type Selection = { instanceId: string; kind: "step"; stepId: string } | { instanceId: string; kind: "partAction"; placementId: string } | null;
type HandleDrag = { instanceId: string; stepId: string; which: "in" | "out"; offset: Vec2 } | null;
/** Everything below the pinned timeline/viewport is tabbed instead of stacked inline (mobile scroll-and-lose-your-selection fix) — Basics/Add are always available, the third slot shows whichever node is currently selected. */
type EditorTab = "basics" | "add" | "step" | "partAction" | "scaling";

/** Every draggable handle a Scaling positioning shape can offer (unitScaling.ts's UnitScaling — curve/v/grid/ring, plus the ping-pong override axis). Only the currently-selected shape's handles render at once, per "Design Handoff v2" §8.2. */
type ScalingHandleId =
  | { kind: "curvePoint"; index: number }
  | { kind: "curveEnd" }
  | { kind: "vTip" }
  | { kind: "vArm" }
  | { kind: "gridCorner" }
  | { kind: "ringRadius" }
  | { kind: "pingPongOverride" };
type ScalingDrag = { instanceId: string; handle: ScalingHandleId; pos: Vec2 } | null;

/**
 * The right-hand corner of a V's open end, in world space — deliberately the
 * same construction `unitScalingShapes.ts`'s `vSlots` uses for its extreme
 * parameter, so this handle lands exactly on the outermost ghost slot instead
 * of near it. Every scaling shape's handles now sit on a real slot (curve's end
 * is its last slot, the grid corner is its last slot, the ring's radius handle
 * is its first), which is what made Curve the only one that "looked accurate".
 */
function vArmPos(origin: Vec2, s: UnitScaling): Vec2 {
  const len = Math.hypot(s.vTip.x, s.vTip.y) || 1;
  const perp: Vec2 = { x: -s.vTip.y / len, y: s.vTip.x / len };
  const half = s.vWidth / 2;
  return { x: origin.x + s.vTip.x + perp.x * half, y: origin.y + s.vTip.y + perp.y * half };
}

function sameScalingHandle(a: ScalingHandleId, b: ScalingHandleId): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "curvePoint" && b.kind === "curvePoint") return a.index === b.index;
  return true;
}

const NODE_DIAMETER = 56;
const NODE_RADIUS = NODE_DIAMETER / 2;
/** The live-preview marker (see movementPreview.ts) is smaller than a waypoint node so it visually reads as secondary, not another authored step. */
const PREVIEW_DIAMETER = 36;
const PREVIEW_RADIUS = PREVIEW_DIAMETER / 2;
/** Real HTML button now (not an SVG circle) — smaller than the 28px move/add/delete node controls, but still a legitimate touch target, unlike the ~12px SVG dot this replaced. */
const HANDLE_DIAMETER = 22;
const HANDLE_RADIUS = HANDLE_DIAMETER / 2;
const PADDING = 60;
/** Attack-track markers are smaller than a movement waypoint node — secondary to the path, same "reads as another layer, not another waypoint" reasoning as PREVIEW_DIAMETER. */
const PART_MARKER_DIAMETER = 32;
const PART_MARKER_RADIUS = PART_MARKER_DIAMETER / 2;
/** View (pan/zoom) range — ZOOM_MIN well below 1 is the explicit point: the old fixed-scale canvas could never show more than roughly one tile's worth of content at once, per Noah's usability note. Matches JigsawPuzzle.tsx's zoom-toward-cursor/pinch pattern, not NS Art's discrete-step one. Lower than it needs to be for a 1x1 tile so the widest (3x1) footprint still fits on the narrowest mobile viewport after editorScale.ts's TILE_UNIT increase — fitView's `* 1.15` margin plus a 3x1 tile at TILE_UNIT=720 needs roughly 0.145 on a ~380px-wide phone viewport. */
const ZOOM_MIN = 0.08;
const ZOOM_MAX = 3;
const PINCH_ZOOM_MIN_DIST = 1;
/** What each Scaling handle actually does — the canvas shows several dots at once per shape, and one shared "drag to shape this scaling group" tooltip left you guessing which drove what. */
const SCALING_HANDLE_TITLES: Record<ScalingHandleId["kind"], string> = {
  curvePoint: "Drag to bend the line the group spreads along",
  curveEnd: "Drag to set where the group's line ends",
  vTip: "Drag to set the V's depth and direction",
  vArm: "Drag to open or close the V",
  gridCorner: "Drag to size the block (width and depth)",
  ringRadius: "Drag to set the ring's radius",
  pingPongOverride: "Drag to set an asymmetric mirror axis",
};
/** Ceiling for the Scaling tab's preview-Difficulty slider (UnitScalingPanel's own PREVIEW_DIFFICULTY_MAX), and the value the preview starts at so the whole group is visible while you shape it. */
const SCALING_PREVIEW_DIFFICULTY_MAX = 100;
/** Ceiling on the on-canvas controls' 1/zoom counter-scale (see the stage's `--enc-counter-scale`). At ZOOM_MIN an uncapped 1/zoom is 12.5x, which would blow a node's control cluster far across the canvas and over its neighbours. 6x holds controls at their full authored screen size down to zoom ~0.17, which covers the fit-to-view zoom a phone lands on for every tile footprint; below that they shrink again, but that's a survey-the-whole-encounter zoom, not one you author at. */
const COUNTER_SCALE_MAX = 6;
/** Half the screen-space control HUD's extent — how far its anchor is kept from any canvas edge so the whole cluster (a 28px button ring, see `.shmup-enc-node-hud`) stays inside the clip box and remains tappable. */
const NODE_HUD_MARGIN = 40;
/** How far from its parent a newly appended step lands, in *screen* px (converted to world units against the live zoom by `nextStepPos`). Roughly one-and-a-bit node diameters — far enough to read as a separate waypoint, close enough to grab and drag immediately. */
const NEW_STEP_SCREEN_GAP = 76;
/** Ceiling for the E4 hitbox-preview mode's encounter-wide Difficulty slider — same range as UnitScalingPanel.tsx's per-instance preview slider, just driving every scaled instance in the encounter at once (specs/shmup-editor.todo.md's "Encounter-wide difficulty-preview slider" Remaining item). */
const HITBOX_PREVIEW_DIFFICULTY_MAX = 100;
/** How far the frame you *aren't* authoring fades back (airFrame.ts). Low enough to read as reference, high enough that you can still line an air path up against the terrain under it — the whole reason the other layer stays on screen at all. */
const OFF_LAYER_OPACITY = 0.3;
/** How far down the camera box a freshly-placed air Unit starts, as a fraction of its height — high enough to read as "just arrived", far enough in to be plainly on screen. See `addUnitInstance`. */
const AIR_ENTRY_DEPTH_FRACTION = 0.2;

function validate(encounter: EncounterDef): string | null {
  if (!encounter.name.trim()) return "Name is required.";
  if (encounter.weight <= 0) return "Weight must be positive.";
  return null;
}

function deleteKey(instanceId: string, stepId: string): string {
  return `${instanceId}:${stepId}`;
}

/**
 * A Part-action placement's anchor position in world space — wherever the
 * instance's bezier path (via computeInstancePreview) puts it at `atTime`,
 * plus the firing Part's offset. Falls back to the instance's first step
 * (still positionally meaningful, even before the instance has technically
 * "spawned") rather than nothing.
 *
 * **`atTime` defaults to the placement's own authored `time`**, which is
 * the right anchor for the *static* canvas marker (🔫) — "where does this
 * attack originate in the authored sequence." A *live* preview (the E4
 * hitbox preview's bullet origin) must instead pass the current scrub/
 * local time explicitly — a burst that repeats for several seconds should
 * keep emitting from wherever the instance actually is *right now*, not
 * stay frozen at its position back when the attack was first placed. Using
 * the placement's fixed `attack.time` for both was a real bug: shots
 * always looked like they came from the unit's spawn point regardless of
 * how far it had traveled since.
 */
function partActionAnchorWorld(instance: EncounterUnit, unitDef: UnitDef | undefined, attack: PartActionPlacement, atTime: number = attack.time): Vec2 | null {
  if (!unitDef) return null;
  const part = unitDef.parts.find((p) => p.id === attack.partId);
  if (!part) return null;
  const basePos = computeInstancePreview(instance, unitDef, atTime)?.pos ?? instance.steps[0]?.pos;
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
 * not authored here.
 *
 * **Layout: pinned timeline+viewport, everything else tabbed.** Noah's
 * report: scrolling down to a selected node's settings routinely scrolled
 * far enough to trigger the outside-tap deselect, making the settings
 * disappear right as you reached them. `EncounterTimeline` + the canvas
 * viewport now live in one `position: sticky` head pinned to the top of
 * the scroll container; everything that used to stack inline below the
 * canvas (Basics fields, the Unit picker, Step/Attack/Scaling settings) is
 * a tab instead, so there's rarely anything to scroll past at all.
 * Selecting a step/attack, or opening Scaling, auto-switches to that
 * tab — see `contextualTab`/`effectiveTab` below. An "embiggen" button on
 * the viewport takes it fullscreen when half the screen isn't enough
 * (`embiggen` state). Explanatory prose that used to sit inline as
 * `.shmup-hint` paragraphs now lives in the Help menu (`ShmupEditor.tsx`)
 * instead, per Noah's "remove all the muted explanatory text."
 *
 * **Every segment between two steps is a cubic bezier curve** (`bezier.ts`),
 * rendered as an SVG path instead of a straight line. Selecting a step
 * shows up to two small draggable handle dots (⬦, teal) connected to it by
 * a dashed stalk — one shaping the curve leaving it (skipped on the last
 * step), one shaping the curve arriving at it (skipped on the first step)
 * — dragging either bends the curve, live-clamped to what the owning
 * Unit's turning limits allow (`pathSolver.ts`).
 *
 * **The drawn curve is the solved path, not the raw handles.** Waypoints
 * are hard constraints; the shape between them is derived from the Unit's
 * `minSpeed`/`turnRateDegPerSec` (`turning.ts`). A jet given a right-angle
 * corner swings wide through it because that's the only way it can pass
 * through all three waypoints; a tank drives the legs straight and pivots
 * on the spot, paying for the corner in time instead. Nothing is ever
 * marked invalid — the editor solves for the closest flyable path and
 * draws that.
 *
 * **Most steps' `time` is derived, not typed in.** `encounterTiming.ts`
 * computes it from the segment's arc length and the owning Unit's `speed`
 * — see that file's header for the full reasoning. `updateInstance` below
 * recomputes derived times after every mutation so this stays in sync
 * automatically; `handleRetimeStep` is what makes dragging a derived step
 * on the timeline still feel like "set the time" even though under the
 * hood it's solving for a speed adjustment instead.
 *
 * **Scaling (E3 #193, unitScaling.ts) is a per-instance tab, not a new
 * kind of thing.** Tapping ⚖️ on an instance's first step opens its
 * Scaling tab and reveals that instance's positioning-shape handles
 * directly on this same canvas — a duplicate replays the instance's whole
 * step/attack sequence anchored to its own slot, so scaling never needs
 * its own separate placement UI.
 */
export default function EncounterEditor({ tile, units, encounter, onSave, onCancel, onPlaytest, onDraftChange }: EncounterEditorProps) {
  const [draft, setDraft] = useState<EncounterDef>(encounter);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragPos, setDragPos] = useState<{ instanceId: string; stepId: string; pos: Vec2 } | null>(null);
  const [dragHandle, setDragHandle] = useState<HandleDrag>(null);
  const [scalingDrag, setScalingDrag] = useState<ScalingDrag>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  /**
   * Starts at the ceiling, not 0. The Scaling tab's ghost slots render
   * `resolveScaling(scaling, scalingPreviewDifficulty).count` positions — and at
   * difficulty 0 that count is 1, so enabling scaling and picking a shape drew
   * exactly one dot. You had to find the Preview Difficulty slider at the bottom
   * of the panel before the shape you were editing appeared at all, which is a
   * large part of why these read as "not intuitive". Previewing the *full* group
   * is what you want while authoring the shape; the slider still sweeps down.
   */
  const [scalingPreviewDifficulty, setScalingPreviewDifficulty] = useState(SCALING_PREVIEW_DIFFICULTY_MAX);
  const [scrubTime, setScrubTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("basics");
  const [embiggen, setEmbiggen] = useState(false);
  /**
   * Trades canvas height for panel height. On a phone the pinned head
   * (timeline + canvas) took 421px of a 664px viewport, leaving a 175px slot —
   * 26% of the screen — to hold panels up to 470px tall, so *every* dial edit
   * meant scrolling. `embiggen` already covers the map-focused extreme; this is
   * the other one, for when you're working the dials and only need the map for
   * reference. Deliberately a shrink, not a hide: losing the map entirely is
   * what the old scroll-the-whole-page layout already did wrong.
   */
  const [panelExpanded, setPanelExpanded] = useState(false);
  /**
   * **Which reference frame the canvas is currently drawn in** (airFrame.ts).
   * Not saved anywhere — Layer is a property of the Unit definition
   * (unitTypes.ts), never of a placement; this only decides what you're
   * *looking at*, and it deliberately switches several things at once:
   *
   * - Ground: tile-local space, exactly as before. The tile is fixed and the
   *   camera box climbs it; air units are dimmed and drift up the tile once
   *   they pin.
   * - Air: the camera is fixed and the terrain slides down through it. Ground
   *   units and the tile itself are dimmed but stay visible, so an air path
   *   can still be lined up against what it's flying over.
   * - Doodads: geometrically identical to Ground (scenery is scroll-locked
   *   too, so there is no third reference frame — see `airFrame.ts`'s
   *   `AuthorLayer`). What it changes is the *roster* and the dimming: only
   *   doodad Units are offered, and the combat layers dim out of the way, so
   *   dressing a tile with scenery is its own pass rather than a search
   *   through the ground roster for the tank among the trees.
   *
   * Every mode shows the *other* layers rather than hiding them — separate to
   * author, together to check. The inactive layers are non-interactive though,
   * so a stray tap can't grab a dimmed node in a frame you aren't editing.
   */
  const [authorLayer, setAuthorLayer] = useState<AuthorLayer>(() => {
    // Open in the frame that actually holds this encounter's content. Ground
    // is the right default for an empty encounter and for anything mixed, but
    // a single-layer encounter opening in the wrong mode would show every one
    // of its units dimmed and unselectable, which reads as broken rather than
    // as a mode you need to switch out of. Applies to an all-doodad encounter
    // (a pure scenery pass) exactly as it does to an all-air one.
    const placed = encounter.units.map((u) => units.find((d) => d.id === u.unitDefId)).filter((d): d is UnitDef => !!d);
    const first = placed[0]?.layer;
    return first && placed.every((d) => d.layer === first) ? first : "ground";
  });
  // E4 low-fi hitbox/boundary preview mode (specs/shmup-editor.todo.md) —
  // an alternate rendering of the same scrubTime/playing timeline already
  // above, not a separate playback engine. Ephemeral viewing aid, same
  // "not part of draft/onDraftChange" reasoning as scrubTime itself.
  const [hitboxPreviewOn, setHitboxPreviewOn] = useState(false);
  const [hitboxPreviewDifficulty, setHitboxPreviewDifficulty] = useState(30);
  // View state (pan/zoom) — deliberately separate from `draft`: dragging a
  // unit must never move the view, and panning/zooming must never move a
  // unit. Refs mirror the state for use inside event handlers (wheel/pinch)
  // without stale closures, same pattern as JigsawPuzzle.tsx.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Vec2>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef<Vec2>({ x: 0, y: 0 });
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const arenaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bgPointersRef = useRef<Map<number, Vec2>>(new Map());
  const lastPinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const didFitViewRef = useRef(false);
  /** Set by `switchAuthorLayer` so the reframe happens on the render *after* the mode change, once the stage's bounding box has grown to match. */
  const pendingFitRef = useRef(false);
  const error = validate(draft);

  // Ephemeral preview state (scrub position, play/pause, scaling preview
  // Difficulty) is intentionally NOT part of `draft`/onDraftChange — a viewing
  // aid, not authored content, so it doesn't need to survive a reload like
  // the actual steps/scaling config do.
  const allStepTimes = draft.units.flatMap((u) => u.steps.map((s) => s.time));
  const maxTime = allStepTimes.length > 0 ? Math.max(...allStepTimes) + LAST_STEP_PREVIEW_WINDOW : 10;

  /**
   * When each air instance's frame is pinned — its own spawn moment
   * (airFrame.ts's `airPinSec`, mirroring the runtime). An air route is
   * rigid in screen space for its whole life, so this is just a lookup of
   * the first step's time rather than the tile-lifespan scan the old
   * pin-on-first-visible rule needed.
   */
  const pinSecByInstance = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const instance of draft.units) {
      map.set(instance.id, airPinSec(instance, units.find((u) => u.id === instance.unitDefId)?.layer));
    }
    return map;
  }, [draft.units, units]);

  /** Which authoring frame an instance belongs to — simply its Unit's layer (airFrame.ts). An unresolvable Unit falls back to ground so it still renders somewhere rather than vanishing. */
  function instanceAuthorLayer(instance: EncounterUnit): AuthorLayer {
    return units.find((u) => u.id === instance.unitDefId)?.layer ?? "ground";
  }

  /** True when an instance belongs to the frame that isn't currently being authored — dimmed, and inert to pointers. */
  function isOffLayer(instance: EncounterUnit): boolean {
    return instanceAuthorLayer(instance) !== authorLayer;
  }

  /**
   * The instance's decoupling offset at the current scrub (airFrame.ts's
   * `pinShiftY`). Added to an authored position this gives the *effective*
   * tile-local position — the space the player marker, attack anchors and
   * `facePlayer` aim already live in, so relative geometry stays correct.
   * The render-mode term (`refShiftY`) is applied separately and uniformly
   * to the whole scene; folding it in here would double-count it.
   */
  function instancePinShiftY(instance: EncounterUnit): number {
    const unitDef = units.find((u) => u.id === instance.unitDefId);
    return pinShiftY(unitDef ? isScrollLocked(unitDef.layer) : true, pinSecByInstance.get(instance.id) ?? null, scrubTime);
  }

  /**
   * The whole-scene translation that pins the camera in air mode. Applied
   * uniformly at render time to everything — tile frame, camera box, player
   * marker, every instance — so it never changes any relative geometry, only
   * what the viewport is anchored to.
   */
  const refShiftY = referenceShiftY(authorLayer, scrubTime);

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

  // Escape exits the embiggened viewport — a fullscreen overlay with no
  // other obvious way out shouldn't be a dead end.
  useEffect(() => {
    if (!embiggen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEmbiggen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [embiggen]);

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
  // it everywhere. Scaling-only patches pass through harmlessly (nothing
  // to recompute), so this stays the single mutation entry point.
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

  function updateScaling(instanceId: string, patch: Partial<UnitScaling>) {
    updateInstance(instanceId, (i) => ({ ...i, scaling: { ...i.scaling, ...patch } }));
  }

  /**
   * Dragging a step on the timeline. Only ever invoked for a manually-timed
   * step (first step, or dwelling at the same position as its predecessor)
   * — EncounterTimeline.tsx only renders the retime-drag handle for those,
   * since a *derived* step's time comes from arc length / the referenced
   * Action's Movement % (a shared, reusable value — see encounterTiming.ts's
   * file header for why there's no longer a safe per-placement multiplier
   * to solve-and-write-back for a derived step).
   */
  function handleRetimeStep(instanceId: string, stepId: string, draggedTime: number) {
    updateInstance(instanceId, (instance) => updateStep(instance, stepId, { time: draggedTime }));
  }

  useEffect(() => {
    if (!selection) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target instanceof Element ? e.target : null;
      // A button's own onClick already does the right thing — see shmup-editor.md's
      // Encounter editor section (collapsing the panel on pointerdown shifted layout
      // under an in-flight click and silently ate the Save action).
      if (target?.closest("button")) return;
      // Anywhere inside the canvas *viewport* keeps the selection, not just the
      // (usually smaller) transformed stage. The stage is only as big as its
      // content, so at a fit-to-view zoom it leaves a margin of visible-but-
      // off-stage canvas around itself — and a near-miss on a node control
      // landing in that margin used to silently deselect. Measured at ~16% of
      // taps aimed at a node button, which is what made "reselect the enemy,
      // then tap the scaling thing again" a constant tax.
      if (!target?.closest(".shmup-enemy-canvas-viewport") && !target?.closest(".shmup-enc-tabs") && !target?.closest(".shmup-timeline")) {
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

  /**
   * Hands this encounter to the real game. The preview's own Difficulty
   * dial comes along, so what you were just looking at is what gets played
   * — and since the game reads saved data rather than this draft, the
   * caller saves first (Noah: "for simplicity's sake, this can save the
   * encounter first").
   */
  function handlePlaytest() {
    if (validate(draft)) return;
    onPlaytest({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() }, hitboxPreviewDifficulty);
  }

  function selectStep(instanceId: string, stepId: string) {
    setPendingDeleteKey(null);
    setSelection({ instanceId, kind: "step", stepId });
    setActiveTab("step");
  }

  function selectPartAction(instanceId: string, placementId: string) {
    setPendingDeleteKey(null);
    setSelection({ instanceId, kind: "partAction", placementId });
    setActiveTab("partAction");
  }

  function addCurvePoint(instanceId: string) {
    updateInstance(instanceId, (i) => {
      const s = i.scaling;
      const last = s.curvePoints[s.curvePoints.length - 1] ?? { x: 0, y: 0 };
      const newPoint: Vec2 = { x: (last.x + s.curveEnd.x) / 2, y: (last.y + s.curveEnd.y) / 2 };
      return { ...i, scaling: { ...s, curvePoints: [...s.curvePoints, newPoint] } };
    });
  }
  function removeCurvePoint(instanceId: string, index: number) {
    updateInstance(instanceId, (i) => ({ ...i, scaling: { ...i.scaling, curvePoints: i.scaling.curvePoints.filter((_, idx) => idx !== index) } }));
  }

  function addUnitInstance(unitDefId: string) {
    const index = draft.units.length;
    const unitDef = units.find((u) => u.id === unitDefId);
    // Staggered diagonally (not just horizontally) so each new instance's
    // label doesn't render directly on top of the previous one's — still
    // just a default, since the move handle can reposition either.
    //
    // **Ground and air want different defaults**, because they arrive by
    // different routes. A ground unit is placed above the tile and scrolls in
    // with its terrain. An air unit is pinned to the screen from the moment it
    // spawns (airFrame.ts), so anything placed off-camera would simply sit
    // there off-camera forever — it starts *inside* the camera box instead,
    // near the top, so there's something to look at the moment you place it.
    // Authoring an entrance is then a deliberate act: drag this first step out
    // past the box and add the next one inside it.
    const startPos: Vec2 =
      unitDef?.layer === "air"
        ? {
            x: airCameraRect.x + airCameraRect.width / 2 + index * 110,
            y: airCameraRect.y + airCameraRect.height * AIR_ENTRY_DEPTH_FRACTION + index * 30,
          }
        : { x: (tile.footprint * TILE_UNIT) / 2 + index * 110, y: -TILE_UNIT * 0.6 - index * 30 };
    // Defaults to the Unit's own defaultActionId (unitTypes.ts) rather than
    // null — a freshly-placed Unit should already do *something* sensible
    // (fly/patrol/idle-and-shoot, whatever its author set as the default)
    // instead of sitting inert until you dig into the Step tab.
    const placed = addStep(createEncounterUnit(unitDefId), unitDef?.defaultActionId ?? null, startPos);
    // Every Part comes with the Unit, already scheduled with whatever it does
    // on spawn — a battleship arrives with all four turret tracks on the
    // timeline rather than as a hull you then have to attach guns to.
    const instance = seedPartActions(placed, unitDef, placed.steps[0]?.time ?? 0);
    updateDraft({ ...draft, units: [...draft.units, instance] });
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
    // Carries forward the previous step's own Action rather than defaulting
    // to null/inert — most sequences keep doing the same thing (e.g. "keep
    // flying and shooting") across several waypoints, so continuing is a
    // far more useful default than making every new step opt back in.
    const carriedActionId = before.steps[before.steps.length - 1]?.actionId ?? null;
    const after = addStep(before, carriedActionId, nextStepPos(before));
    updateInstance(instanceId, () => after);
    const added = after.steps[after.steps.length - 1];
    if (added) selectStep(instanceId, added.id);
  }

  /**
   * Where a newly appended step should land: a fixed *screen* distance from the
   * step it follows, continuing that instance's current direction of travel.
   *
   * `encounterSteps.ts`'s own default is a flat `TILE_UNIT` (720 world units) to
   * the right, which is zoom-blind — at the fit-to-view zoom a phone picks it
   * put the new node ~244px to the right inside a ~342px-wide canvas, so it
   * landed off the visible edge more often than not. You then had to pan around
   * to find the thing you'd just created before you could drag it anywhere,
   * which is the opposite of "it should appear under my cursor". Dividing a
   * screen-space gap by the live zoom keeps the new node the same comfortable
   * distance from its parent at every zoom level, and always on screen.
   */
  function nextStepPos(instance: EncounterUnit): Vec2 {
    const steps = instance.steps;
    const last = steps[steps.length - 1];
    if (!last) return { x: 0, y: 0 };
    const gapWorld = NEW_STEP_SCREEN_GAP / Math.max(zoomRef.current, ZOOM_MIN);
    const prev = steps.length > 1 ? steps[steps.length - 2] : undefined;
    // Continue the existing heading so appending to a path extends it rather
    // than kinking it back toward +x; a lone first step has no heading yet, so
    // "onward" is down-screen, the direction encounters actually travel.
    let dx = prev ? last.pos.x - prev.pos.x : 0;
    let dy = prev ? last.pos.y - prev.pos.y : 1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      dx = 0;
      dy = 1;
    } else {
      dx /= len;
      dy /= len;
    }
    return { x: last.pos.x + dx * gapWorld, y: last.pos.y + dy * gapWorld };
  }

  /**
   * Adds one Action placement to a Part's own track, **at the playhead**.
   *
   * This is the whole add flow now. It replaces the old 🔫+ button on a
   * step's control cluster, which had to exist only because a Part with no
   * placements had no track and therefore nothing to select — that button
   * carried a Part picker of its own, and framed the operation as "attach an
   * attack to this waypoint" when a Part's schedule has never had anything to
   * do with where the hull happens to have a waypoint.
   *
   * Now every Part is already on the timeline with its own lane (seeded by
   * `seedPartActions` when the Unit is placed), so adding is just "select a
   * dot on that lane, press +", exactly like appending a step. The playhead
   * supplies the time because it's the shared clock every track is
   * choreographed against, and the Part panel's Time dial adjusts it after.
   */
  function addPartActionAtPlayhead(instanceId: string, partId: string) {
    const before = draft.units.find((u) => u.id === instanceId);
    const unitDef = units.find((u) => u.id === before?.unitDefId);
    const part = unitDef?.parts.find((p) => p.id === partId);
    if (!before || !part) return;
    // A Part with no Actions still gets its placement, with a null actionId —
    // the Part panel's Action dropdown is then the place to give it one.
    // Refusing to add would leave an empty lane with no way forward, which is
    // the discoverability hole this whole change is closing.
    const after = addPartAction(before, partId, part.actions[0]?.id ?? null, scrubTime);
    updateInstance(instanceId, () => after);
    const added = after.partActions[after.partActions.length - 1];
    if (added) selectPartAction(instanceId, added.id);
  }

  function removePartActionPlacement(instanceId: string, placementId: string) {
    updateInstance(instanceId, (i) => deletePartAction(i, placementId));
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

  /**
   * The handle offset the path solver actually used for `which` side of
   * step `idx` — optionally after pretending that handle was dragged to
   * `proposed`. That "pretend" is how a drag stays honest: the dot follows
   * the pointer only as far as the Unit's turning circle allows
   * (`pathSolver.ts`), and refuses past it, instead of letting you author a
   * curve the Unit can't fly and quietly redrawing something else.
   */
  function solvedHandleOffset(instance: EncounterUnit, idx: number, which: "in" | "out", proposed?: Vec2): Vec2 | null {
    const unitDef = units.find((u) => u.id === instance.unitDefId);
    if (!unitDef) return proposed ?? null;
    const steps = instance.steps.map((s, i) => (i === idx && proposed ? { ...s, [which === "out" ? "handleOut" : "handleIn"]: proposed } : s));
    const solved = solvePathCached(steps, limitsFor(unitDef));
    return which === "out" ? effectiveHandleOut(solved, steps, idx) : effectiveHandleIn(solved, steps, idx);
  }

  /** Begins dragging `which` handle of `stepId`, seeding the drag from the handle's current solved position so the dot doesn't jump when you first touch it. */
  function beginHandleDrag(instanceId: string, stepId: string, which: "in" | "out", e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const instance = draft.units.find((u) => u.id === instanceId);
    const idx = instance?.steps.findIndex((s) => s.id === stepId) ?? -1;
    if (!instance || idx === -1) return;
    const other = which === "out" ? instance.steps[idx + 1] : instance.steps[idx - 1];
    if (!other) return;
    const offset = solvedHandleOffset(instance, idx, which);
    if (!offset) return;
    setDragHandle({ instanceId, stepId, which, offset });
  }
  function endHandleDrag() {
    if (!dragHandle) return;
    updateInstance(dragHandle.instanceId, (i) =>
      updateStep(i, dragHandle.stepId, dragHandle.which === "out" ? { handleOut: dragHandle.offset } : { handleIn: dragHandle.offset })
    );
    setDragHandle(null);
  }

  function beginScalingDrag(instanceId: string, handle: ScalingHandleId, currentAbsolute: Vec2, e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setScalingDrag({ instanceId, handle, pos: currentAbsolute });
  }
  /** Converts the drag's final absolute world position back into whichever offset/number field `handle` represents, per unitScaling.ts's "handle fields are offsets from the instance's own position" convention. */
  function endScalingDrag() {
    if (!scalingDrag) return;
    const { instanceId, handle, pos } = scalingDrag;
    const instance = draft.units.find((u) => u.id === instanceId);
    const origin = instance?.steps[0]?.pos;
    if (instance && origin) {
      const offset: Vec2 = { x: pos.x - origin.x, y: pos.y - origin.y };
      updateScaling(instanceId, scalingPatchForHandle(instance.scaling, handle, offset, pos));
    }
    setScalingDrag(null);
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
  //
  // Uses `arenaRef` (the outer, untransformed viewport) rather than
  // `stageRef` (the inner element the pan/zoom CSS transform is actually
  // applied to) — subtracting `pan` and dividing by `zoom` explicitly,
  // same math as JigsawPuzzle.tsx's piece-drag world-coordinate
  // conversion, rather than reading them back out of a transformed
  // element's own (harder-to-reason-about) getBoundingClientRect().
  /**
   * The total render shift currently applied to whichever instance is being
   * dragged — `toWorld` has to undo it, or the authored position would be
   * off by exactly the frame offset.
   *
   * This is what makes air-mode authoring do the intuitive thing: scrub to
   * the moment you care about, drag the gunship to where it should be *on
   * screen*, and the tile-local position that gets stored is whatever puts
   * it there at that instant.
   */
  function activeDragShiftY(): number {
    const id = dragPos?.instanceId ?? dragHandle?.instanceId ?? scalingDrag?.instanceId ?? null;
    if (!id) return 0;
    const instance = draft.units.find((u) => u.id === id);
    return instance ? instancePinShiftY(instance) + refShiftY : 0;
  }

  function toWorld(clientX: number, clientY: number): Vec2 | null {
    if (!arenaRef.current) return null;
    const rect = arenaRef.current.getBoundingClientRect();
    const stageX = (clientX - rect.left - panRef.current.x) / zoomRef.current;
    const stageY = (clientY - rect.top - panRef.current.y) / zoomRef.current;
    return { x: stageX - PADDING + minX, y: stageY - PADDING + minY - activeDragShiftY() };
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
          const rawOffset: Vec2 = { x: worldPos.x - step.pos.x, y: worldPos.y - step.pos.y };
          // Clamped live rather than only on release: the offset stored here is
          // already the one the Unit can fly, so the dot, the drawn curve and
          // the value written back on release can never disagree.
          const offset = solvedHandleOffset(instance, idx, dragHandle.which, rawOffset);
          if (offset) setDragHandle({ ...dragHandle, offset });
        }
      }
    }
    if (scalingDrag) {
      setScalingDrag({ ...scalingDrag, pos: worldPos });
    }
  }
  function onStagePointerUp() {
    endDrag();
    endHandleDrag();
    endScalingDrag();
  }

  /** Zoom toward a specific screen point (where the cursor/pinch-midpoint is) rather than the stage's origin, so the thing you're looking at stays under the pointer instead of the view jumping. Same formula as JigsawPuzzle.tsx's applyZoom. */
  const applyZoom = useCallback((newZoom: number, screenCx: number, screenCy: number) => {
    const oldZoom = zoomRef.current;
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    if (clamped === oldZoom) return;
    const nextPan = {
      x: screenCx - (screenCx - panRef.current.x) * (clamped / oldZoom),
      y: screenCy - (screenCy - panRef.current.y) * (clamped / oldZoom),
    };
    zoomRef.current = clamped;
    panRef.current = nextPan;
    setZoom(clamped);
    setPan(nextPan);
  }, []);

  /**
   * Background pan + pinch-zoom, tracked entirely independently of the
   * step/handle/attack/scaling drags above — those are captured by the
   * specific button that starts them (`setPointerCapture` + `stopPropagation`),
   * so a background gesture (this handler) only ever sees pointers that
   * never touched an interactive element in the first place. One finger
   * pans; a second added mid-gesture starts a pinch (matching
   * JigsawPuzzle.tsx's `handleArenaPointerDown/Move/Up`).
   */
  function onArenaPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // A raw pointerdown on the zoom buttons/minimap/corner controls (or any
    // future control layered over the arena) bubbles up to this handler
    // before the browser finishes the click — if we steal pointer capture
    // here first, the control's own onClick never fires. Those elements
    // handle their own events, so background pan/pinch tracking must
    // ignore them entirely.
    if ((e.target as HTMLElement).closest("button, canvas, input, select")) return;
    bgPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (bgPointersRef.current.size === 2) {
      const [a, b] = [...bgPointersRef.current.values()];
      lastPinchRef.current = { dist: Math.max(PINCH_ZOOM_MIN_DIST, Math.hypot(b.x - a.x, b.y - a.y)), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
    } else {
      lastPinchRef.current = null;
    }
  }
  function onArenaPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!bgPointersRef.current.has(e.pointerId)) return;
    const prev = bgPointersRef.current.get(e.pointerId)!;
    bgPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...bgPointersRef.current.values()];
    const arena = arenaRef.current;
    if (!arena) return;

    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.max(PINCH_ZOOM_MIN_DIST, Math.hypot(b.x - a.x, b.y - a.y));
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const last = lastPinchRef.current;
      if (last) {
        const rect = arena.getBoundingClientRect();
        const oldZoom = zoomRef.current;
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZoom * (dist / last.dist)));
        const cx = midX - rect.left;
        const cy = midY - rect.top;
        const nextPan = {
          x: cx - (cx - panRef.current.x) * (newZoom / oldZoom) + (midX - last.midX),
          y: cy - (cy - panRef.current.y) * (newZoom / oldZoom) + (midY - last.midY),
        };
        zoomRef.current = newZoom;
        panRef.current = nextPan;
        setZoom(newZoom);
        setPan(nextPan);
      }
      lastPinchRef.current = { dist, midX, midY };
    } else {
      const nextPan = { x: panRef.current.x + (e.clientX - prev.x), y: panRef.current.y + (e.clientY - prev.y) };
      panRef.current = nextPan;
      setPan(nextPan);
      lastPinchRef.current = null;
    }
  }
  function onArenaPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    bgPointersRef.current.delete(e.pointerId);
    if (bgPointersRef.current.size < 2) lastPinchRef.current = null;
  }

  // Ctrl/Cmd+wheel to zoom, toward the cursor — a native (not React
  // synthetic) listener because preventDefault on a wheel event requires
  // `{ passive: false }`, which React's onWheel prop can't reliably attach.
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    function handler(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = arena!.getBoundingClientRect();
      applyZoom(zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - rect.left, e.clientY - rect.top);
    }
    arena.addEventListener("wheel", handler, { passive: false });
    return () => arena.removeEventListener("wheel", handler);
  }, [applyZoom]);

  // Tracks the viewport's own rendered size (for the minimap's viewport-rectangle overlay and for centering pan math) since it's a fixed CSS size, not content-derived.
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(arena);
    return () => observer.disconnect();
  }, []);

  const tileWidthPx = tile.footprint * TILE_UNIT;

  // Every scaling handle's currently-resolved absolute (world) position for
  // `instance`, keyed by handle id — used both for rendering (dashed stalk
  // lines + drag-target buttons) and for seeding a fresh drag from the
  // right spot. Only the instance's *own* `scaling.shape` contributes
  // handles, per "Design Handoff v2" §8.2 (contextual, not all-shapes-at-once).
  function scalingHandlesFor(instance: EncounterUnit, includeLiveDrag = true): { handle: ScalingHandleId; pos: Vec2 }[] {
    const origin = instance.steps[0]?.pos;
    if (!origin) return [];
    const s = instance.scaling;
    const handles: { handle: ScalingHandleId; pos: Vec2 }[] = [];
    if (s.shape === "curve") {
      s.curvePoints.forEach((p, index) => handles.push({ handle: { kind: "curvePoint", index }, pos: { x: origin.x + p.x, y: origin.y + p.y } }));
      handles.push({ handle: { kind: "curveEnd" }, pos: { x: origin.x + s.curveEnd.x, y: origin.y + s.curveEnd.y } });
    } else if (s.shape === "v") {
      // Tip = the midpoint of the V's open end (its spine), arm = the open
      // end's right corner, which is exactly where the outermost ghost slot
      // sits (`vSlots` maps its extreme parameter to that point). Before this,
      // V offered *only* the tip handle — a dot floating in the middle of the
      // V's opening, on no part of the shape — and its width was a dial with no
      // canvas presence at all.
      handles.push({ handle: { kind: "vTip" }, pos: { x: origin.x + s.vTip.x, y: origin.y + s.vTip.y } });
      handles.push({ handle: { kind: "vArm" }, pos: vArmPos(origin, s) });
    } else if (s.shape === "grid") {
      // One corner, not two edge midpoints: a corner is both the intuitive
      // box-resize grip and an actual ghost slot (the last one `gridSlots`
      // emits). The Width/Depth dials still drive each axis independently.
      handles.push({ handle: { kind: "gridCorner" }, pos: { x: origin.x + s.gridWidth / 2, y: origin.y + s.gridDepth / 2 } });
    } else if (s.shape === "ring") {
      // One handle only. The ring is always centred on the instance itself, so
      // a centre handle sat exactly under the unit's own sprite — unreachable,
      // and controlling something nobody wanted to move.
      handles.push({ handle: { kind: "ringRadius" }, pos: { x: origin.x + s.ringRadius, y: origin.y } });
    }
    if (s.pingPong) {
      handles.push({ handle: { kind: "pingPongOverride" }, pos: { x: s.pingPongOverride ?? tileWidthPx / 2, y: -TILE_UNIT * 0.35 } });
    }
    if (!includeLiveDrag) return handles;
    return handles.map(({ handle, pos }) =>
      scalingDrag && scalingDrag.instanceId === instance.id && sameScalingHandle(scalingDrag.handle, handle) ? { handle, pos: scalingDrag.pos } : { handle, pos }
    );
  }

  const selectedInstance = selection ? draft.units.find((u) => u.id === selection.instanceId) : undefined;
  const selectedStep: EncounterStep | undefined = selection?.kind === "step" ? selectedInstance?.steps.find((s) => s.id === selection.stepId) : undefined;
  const selectedPlacement: PartActionPlacement | undefined = selection?.kind === "partAction" ? selectedInstance?.partActions.find((a) => a.id === selection.placementId) : undefined;
  const selectedUnitDef = selectedInstance ? units.find((u) => u.id === selectedInstance.unitDefId) : undefined;
  /** The Unit roster the "+ Add" tab offers — whichever frame is being authored. Layer is a Unit-definition property (unitTypes.ts), so this filters the picker only; nothing about the placement records it. */
  const addableUnits = units.filter((u) => u.layer === authorLayer);

  /**
   * Tabs on offer right now. Step/Attack are still selection-contextual (they
   * edit one specific node), but **Scaling is offered for the whole time an
   * instance is selected** rather than only after you hit the ⚖️ button on the
   * canvas. That button was a 9.5px target at a phone's fit-to-view zoom, and
   * being the *only* way in meant a near-miss (which usually deselected the
   * unit outright) cost you the selection and the trip both — "tap a tiny
   * purple button to set scaling stats when it could just be a tab below
   * that's always on". ⚖️ survives as a shortcut, not as the only door.
   */
  const availableTabs: EditorTab[] = ["basics", "add"];
  if (selection?.kind === "step") availableTabs.push("step");
  if (selection?.kind === "partAction") availableTabs.push("partAction");
  // Scaling is a difficulty-response concept — "throw more of these at a
  // stronger player" — which scenery has no part in. A doodad is set
  // dressing: it doesn't scale with difficulty, so the tab is withheld
  // rather than shown offering a knob that shouldn't be turned.
  if (selectedInstance && selectedUnitDef?.layer !== "doodad") availableTabs.push("scaling");
  // Auto-focus the tab matching a freshly selected node, but never strand the
  // user on a tab that no longer exists (its node got deleted / nothing is
  // selected) — fall back to whatever the selection does offer, else Basics.
  const contextualTab: EditorTab | null = selection?.kind === "step" ? "step" : selection?.kind === "partAction" ? "partAction" : null;
  const effectiveTab: EditorTab = availableTabs.includes(activeTab) ? activeTab : (contextualTab ?? "basics");
  /** Scaling handles + ghost slots are on-canvas *because the Scaling tab is open* — one source of truth, so the tab strip and the canvas can never disagree about whether you're in scaling mode. */
  const scalingPanelOpen = !!selectedInstance && effectiveTab === "scaling";

  // Bounding box spans every instance's every step, every visible scaling
  // handle/ghost-slot, PLUS the tile reference frame itself, so the frame
  // is always visible even before any Unit is placed.
  const scalingOpenInstance = scalingPanelOpen ? selectedInstance : undefined;
  const scalingGhostSlots = scalingOpenInstance
    ? applyPingPong(
        resolveScalingSlots(
          scalingOpenInstance.scaling,
          scalingOpenInstance.steps[0]?.pos ?? { x: 0, y: 0 },
          resolveScaling(scalingOpenInstance.scaling, selectedUnitDef?.cost ?? 1, scalingPreviewDifficulty).count
        ),
        scalingOpenInstance.scaling,
        tileWidthPx
      )
    : [];
  // Deliberately uses *committed* positions only (`s.pos`, not
  // `effectiveStep(...)`'s live-drag override; `scalingHandlesFor`'s
  // `includeLiveDrag=false`) — this is the fix for the canvas-scrolls-
  // while-dragging bug: recomputing the coordinate frame's origin
  // (`minX`/`minY` below) from a position that's still moving mid-gesture
  // meant every pointermove could shift where "world (0,0)" lands on
  // screen, which visually reads as the canvas sliding under the drag.
  // Content that's actually been placed still grows the frame normally —
  // this only defers that growth until the drag/handle actually commits.
  /**
   * The camera box's fixed position in air mode. `computeCameraBoundsRect`
   * at t=0 *is* that rectangle: the box's own tile-local y moves by
   * `-scroll(t)` and `refShiftY` adds exactly that back, so its rendered
   * position is constant and equal to its t=0 one. Pre-computing it here
   * (rather than special-casing air mode at each use) lets the bounding box
   * below reserve room for it without depending on the scrub.
   */
  const airCameraRect = computeCameraBoundsRect(tile.footprint, 0);
  const allPositions: Vec2[] = [
    { x: 0, y: 0 },
    { x: tile.footprint * TILE_UNIT, y: TILE_UNIT },
    ...draft.units.flatMap((inst) => inst.steps.map((s) => s.pos)),
    ...(scalingOpenInstance ? scalingHandlesFor(scalingOpenInstance, false).map((h) => h.pos) : []),
    ...scalingGhostSlots,
    // Air mode authors against the camera, which sits a whole tile-height
    // below the tile itself (at clock zero the tile is entirely above the
    // screen). Without this the box would fall outside the stage and
    // fit-to-view would frame the wrong thing. Added only in air mode: in
    // ground mode it would stretch the stage to nearly three screen-heights
    // and zoom every tile out for no reason.
    ...(authorLayer === "air"
      ? [
          { x: airCameraRect.x, y: airCameraRect.y },
          { x: airCameraRect.x + airCameraRect.width, y: airCameraRect.y + airCameraRect.height },
        ]
      : []),
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

  /** `toStage` plus a vertical frame offset — the render-time half of airFrame.ts. Pass an instance's `instancePinShiftY(...) + refShiftY`, or just `refShiftY` for anything belonging to the tile itself. */
  function toStageAt(pos: Vec2, shiftY: number): Vec2 {
    const stage = toStage(pos);
    return { x: stage.x, y: stage.y + shiftY };
  }

  /** Everything an instance's own rendering needs: its frame offset (pin term + mode term) and whether it's the dimmed, inert layer right now. */
  function renderFrameFor(instance: EncounterUnit): { shiftY: number; offLayer: boolean } {
    return { shiftY: instancePinShiftY(instance) + refShiftY, offLayer: isOffLayer(instance) };
  }

  // Fits the whole stage (tile + everything placed on it) into the
  // viewport once, the first time both are known — mirrors
  // JigsawPuzzle.tsx's `fitView`. Only runs once per mount (not on every
  // content change) so panning/zooming while authoring isn't fought by an
  // auto-refit; opening a *different* encounter remounts this component
  // fresh via React's key-less-prop-change re-render, which is fine here
  // since `encounter`/`tile` are effectively identity props for this view.
  /** Centres and zooms the view on a rectangle given in *stage* coordinates, with the same 1.15 breathing margin the mount-time fit has always used. */
  function fitToStageRect(rect: { x: number; y: number; width: number; height: number }) {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    const fitZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(viewportSize.width / (rect.width * 1.15), viewportSize.height / (rect.height * 1.15))));
    const nextPan = {
      x: viewportSize.width / 2 - (rect.x + rect.width / 2) * fitZoom,
      y: viewportSize.height / 2 - (rect.y + rect.height / 2) * fitZoom,
    };
    zoomRef.current = fitZoom;
    panRef.current = nextPan;
    setZoom(fitZoom);
    setPan(nextPan);
  }

  useEffect(() => {
    if (didFitViewRef.current) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    didFitViewRef.current = true;
    fitToStageRect({ x: 0, y: 0, width, height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.width, viewportSize.height]);

  /**
   * Reframe when the authoring frame changes — air mode's subject is the
   * camera box, which sits a whole tile-height below the tile and is
   * completely outside a ground-mode fit.
   *
   * Deferred into an effect rather than done in the toggle handler on
   * purpose: the stage's bounding box only grows to include the camera box
   * *after* `authorLayer` has changed, so fitting inline would measure the
   * old stage and frame the wrong region.
   */
  useEffect(() => {
    if (!pendingFitRef.current) return;
    pendingFitRef.current = false;
    if (authorLayer === "air") {
      const topLeft = toStage({ x: airCameraRect.x, y: airCameraRect.y });
      fitToStageRect({ x: topLeft.x, y: topLeft.y, width: airCameraRect.width, height: airCameraRect.height });
    } else {
      fitToStageRect({ x: 0, y: 0, width, height });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorLayer]);

  /**
   * Switching frames also drops the selection. A node in the frame you just
   * left is dimmed and inert, so leaving it selected would leave the Step
   * tab editing something you can no longer see or grab.
   */
  function switchAuthorLayer(next: AuthorLayer) {
    if (next === authorLayer) return;
    pendingFitRef.current = true;
    setSelection(null);
    setPendingDeleteKey(null);
    setAuthorLayer(next);
  }

  /** Converts a scaling drag's final absolute position into a UnitScaling patch, per-handle-kind. */
  function scalingPatchForHandle(scaling: UnitScaling, handle: ScalingHandleId, offset: Vec2, absolute: Vec2): Partial<UnitScaling> {
    switch (handle.kind) {
      case "curvePoint":
        return { curvePoints: scaling.curvePoints.map((p, idx) => (idx === handle.index ? offset : p)) };
      case "curveEnd":
        return { curveEnd: offset };
      case "vTip":
        return { vTip: offset };
      case "vArm": {
        // Width is the arm's perpendicular distance from the apex->tip spine,
        // doubled (the V is symmetric about it), so dragging the corner in or
        // out opens and closes the formation.
        const len = Math.hypot(scaling.vTip.x, scaling.vTip.y) || 1;
        const perp: Vec2 = { x: -scaling.vTip.y / len, y: scaling.vTip.x / len };
        const fromTip: Vec2 = { x: offset.x - scaling.vTip.x, y: offset.y - scaling.vTip.y };
        return { vWidth: Math.max(0, Math.abs(fromTip.x * perp.x + fromTip.y * perp.y) * 2) };
      }
      case "gridCorner":
        return { gridWidth: Math.max(0, Math.abs(offset.x) * 2), gridDepth: Math.max(0, Math.abs(offset.y) * 2) };
      case "ringRadius":
        // `offset` is already relative to the instance, which is the centre.
        return { ringRadius: Math.max(1, Math.hypot(offset.x, offset.y)) };
      case "pingPongOverride":
        return { pingPongOverride: absolute.x };
      default:
        return {};
    }
  }

  const selectedIdx = selectedInstance && selectedStep ? selectedInstance.steps.findIndex((s) => s.id === selectedStep.id) : -1;
  const selectedNextStep = selectedInstance && selectedIdx >= 0 ? selectedInstance.steps[selectedIdx + 1] : undefined;

  // Computed once, used both for the SVG stalk lines (visual only) and the
  // HTML drag-target buttons below (real touch targets — see file header:
  // raw SVG circles were both too small and too fiddly to hit on mobile).
  /** The selected instance's own frame offset — its handles, node HUD anchor and scaling shape all have to travel with it. */
  const selectedShiftY = selectedInstance ? renderFrameFor(selectedInstance).shiftY : 0;

  const handleDots: { which: "in" | "out"; stage: Vec2 }[] = [];
  if (selectedInstance && selectedStep && !scalingPanelOpen && selectedUnitDef) {
    // Solved against the *effective* (mid-drag) steps, so the dots sit on the
    // curve actually being drawn rather than on the pre-drag one.
    const effSteps = selectedInstance.steps.map((s) => effectiveStep(selectedInstance.id, s));
    const solved = solvePathCached(effSteps, limitsFor(selectedUnitDef));
    const here = effSteps[selectedIdx].pos;
    const push = (which: "in" | "out", offset: Vec2 | null) => {
      if (offset) handleDots.push({ which, stage: toStageAt({ x: here.x + offset.x, y: here.y + offset.y }, selectedShiftY) });
    };
    if (selectedIdx > 0) push("in", effectiveHandleIn(solved, effSteps, selectedIdx));
    if (selectedNextStep) push("out", effectiveHandleOut(solved, effSteps, selectedIdx));
  }
  const selectedNodeStage = selectedInstance && selectedStep ? toStageAt(effectiveStep(selectedInstance.id, selectedStep).pos, selectedShiftY) : null;
  /**
   * The selected node's position in *viewport* pixels — where the screen-space
   * control HUD anchors (see `.shmup-enc-node-hud` in the JSX below). Clamped by
   * NODE_HUD_MARGIN so the cluster is always fully inside the canvas even when
   * its node is at (or panned beyond) an edge: an off-edge control is not just
   * unhittable, a near-miss on one used to land outside the canvas and silently
   * drop the selection.
   */
  const selectedNodeHud: Vec2 | null =
    selectedNodeStage && viewportSize.width > 0
      ? {
          x: Math.max(NODE_HUD_MARGIN, Math.min(viewportSize.width - NODE_HUD_MARGIN, selectedNodeStage.x * zoom + pan.x)),
          y: Math.max(NODE_HUD_MARGIN, Math.min(viewportSize.height - NODE_HUD_MARGIN, selectedNodeStage.y * zoom + pan.y)),
        }
      : null;

  /**
   * 1/zoom, capped — see the stage's `--enc-counter-scale`. Also applied to SVG
   * stroke widths, which are in stage units and so thinned with the zoom exactly
   * like the buttons did: the movement path's 2px and the scaling stalks' 1.5px
   * rendered at 0.35px and 0.26px at a phone's fit-to-view zoom, i.e. as good as
   * invisible. Multiplying holds them at their authored *screen* thickness.
   */
  const counterScale = Math.min(COUNTER_SCALE_MAX, 1 / zoom);

  const scalingHandleEntries = scalingPanelOpen && selectedInstance ? scalingHandlesFor(selectedInstance) : [];
  const scalingOriginStage = scalingPanelOpen && selectedInstance?.steps[0] ? toStageAt(selectedInstance.steps[0].pos, selectedShiftY) : null;

  const framePos = toStageAt({ x: 0, y: 0 }, refShiftY);
  const tileRectStage = { x: framePos.x, y: framePos.y, width: tileWidthPx, height: TILE_UNIT };
  // The minimap is an overview of the authored layout, not of the current
  // scrub, so it deliberately plots unshifted positions — a map whose
  // contents slid around during playback would be useless for navigation.
  const minimapTileRectStage = { ...toStage({ x: 0, y: 0 }), width: tileWidthPx, height: TILE_UNIT };
  const stepPointsStage = draft.units.flatMap((inst) => inst.steps.map((s) => toStage(s.pos)));

  // E4 hitbox/boundary preview (hitboxPreview.ts) — a static reference
  // point standing in for the player (no live player exists at authoring
  // time), placed low in the tile the same way a vertical shmup's own ship
  // sits near the bottom of the screen. World space, so it composes
  // directly with attack anchors/aim math below.
  // Both of these MOVE with the scrub, because the level scrolls: the tile
  // enters at the top of the screen and slides down out of it, so the
  // camera band climbs the tile and the player's ship climbs through it
  // from below. A static marker (which is what this was) is only ever one
  // frame of that. Geometry comes from the game's own shared scroll model.
  // Both belong to the tile/camera rather than to any instance, so they take
  // the bare mode term. In ground mode that's zero and they climb the tile as
  // before; in air mode it cancels their own motion exactly, which is what
  // "the viewport is locked" means.
  const playerRefWorld: Vec2 = { x: tileWidthPx / 2, y: computePlayerRefLocalY(scrubTime) };
  const playerRefStage = toStageAt(playerRefWorld, refShiftY);
  const cameraRectWorld = computeCameraBoundsRect(tile.footprint, scrubTime);
  const cameraBoundsTopLeft = toStageAt({ x: cameraRectWorld.x, y: cameraRectWorld.y }, refShiftY);
  // toStage is a pure translation (zoom is a CSS transform on the whole
  // stage), so world sizes carry straight through.
  const cameraBoundsStage = { x: cameraBoundsTopLeft.x, y: cameraBoundsTopLeft.y, width: cameraRectWorld.width, height: cameraRectWorld.height };

  const hitboxEnemyMarkers: { key: string; stage: Vec2; sizePx: number; layer: AuthorLayer; offLayer: boolean }[] = [];
  const hitboxBulletMarkers: { key: string; stage: Vec2; diameterPx: number; alpha: number; offLayer: boolean }[] = [];
  if (hitboxPreviewOn) {
    for (const instance of draft.units) {
      const unitDef = units.find((u) => u.id === instance.unitDefId);
      if (!unitDef) continue;
      // Split deliberately: `pinY` moves the instance into its effective
      // tile-local position (so bullet aim against the player marker stays
      // correct once it decouples), `refShiftY` is the uniform scene
      // translation applied last, at render.
      const pinY = instancePinShiftY(instance);
      const instanceLayer = unitDef.layer;
      const offLayer = instanceLayer !== authorLayer;
      const originPos = instance.steps[0]?.pos ?? computeInstancePreview(instance, unitDef, scrubTime)?.pos ?? { x: 0, y: 0 };
      // Scaled duplicates fire the exact same authored step/attack sequence
      // as the base instance, each anchored to its own slot — so every
      // duplicate's live position and every one of its attacks' anchors are
      // just the base instance's own preview position/anchor, offset by
      // that slot's delta from the instance's own authored position. Same
      // "duplicates replay the whole sequence independently" model E3's
      // Scaling tab already establishes; this is that model evaluated live
      // at the current scrub time instead of as static ghost dots.
      //
      // **`spawnDelayMs` staggers each duplicate's own local clock** —
      // slot index N spawns `N * spawnDelayMs` after the base instance
      // (slot 0, no delay). `dupLocalTime` maps the shared global
      // `scrubTime` back onto that duplicate's own sequence-relative
      // clock, so `computeInstancePreview`/`partActionAnchorWorld` (which
      // operate purely in authored/local time — the same values on the
      // timeline) don't need to know anything shifted; only the "what
      // global instant does this correspond to" mapping changes per slot.
      // Before its own delayed spawn instant, `computeInstancePreview`
      // returns null (dupLocalTime before the first step's time) and the
      // slot simply doesn't render yet — matches a real staggered spawn
      // queue rather than every duplicate popping in at once.
      const count = instance.scaling.maxCount > 1 ? resolveScaling(instance.scaling, unitDef.cost, hitboxPreviewDifficulty).count : 1;
      const slots = applyPingPong(resolveScalingSlots(instance.scaling, originPos, count), instance.scaling, tileWidthPx);
      slots.forEach((slot, slotIdx) => {
        const dupLocalTime = scrubTime - (instance.scaling.spawnDelayMs * slotIdx) / 1000;
        const dupPreview = computeInstancePreview(instance, unitDef, dupLocalTime);
        if (!dupPreview || dupPreview.invincible) return;
        const delta: Vec2 = { x: slot.x - originPos.x, y: slot.y - originPos.y };
        const dupPos: Vec2 = { x: dupPreview.pos.x + delta.x, y: dupPreview.pos.y + delta.y + pinY };
        // Scenery has no hitbox at runtime (`EncounterRunner.ts`'s
        // `isCollidableLayer`), so drawing one here would be the editor
        // promising a collision the game never performs — the exact
        // shows-X-does-Y drift this preview exists to catch.
        if (instanceLayer !== "doodad") {
          hitboxEnemyMarkers.push({ key: `${instance.id}-${slotIdx}`, stage: toStageAt(dupPos, refShiftY), sizePx: unitDef.size * 2, layer: instanceLayer, offLayer });
        }
        const headingDeg = computeInstanceHeadingDeg(instance, unitDef, dupLocalTime);

        function pushAttackBullets(key: string, facing: Pick<ActionDef, "facing" | "fixedFacingDeg">, attack: ActionAttack, anchor: Vec2, elapsedMs: number) {
          // `anchor` and `playerRefWorld` are both effective tile-local here,
          // so a "facePlayer" attack from a pinned air unit aims from where
          // it actually is rather than from where it was authored.
          const aimDeg = resolveActionFacingDeg(facing, anchor, playerRefWorld, headingDeg);
          const durationMs = computeAttackDurationMs(attack);
          const bulletDiameterPx = resolveBulletRadius(attack, units) * 2;
          computeAttackBullets(attack, aimDeg, durationMs, elapsedMs).forEach((b, bi) => {
            hitboxBulletMarkers.push({
              key: `${key}-${bi}`,
              stage: toStageAt({ x: anchor.x + b.x, y: anchor.y + b.y }, refShiftY),
              diameterPx: bulletDiameterPx,
              alpha: b.alpha,
              offLayer,
            });
          });
        }

        // The base Unit's own attack, if its currently-active step references an Action with one — anchored at the instance's own current (interpolated) position, no Part offset.
        const activeAction = dupPreview.step.actionId ? unitDef.actions.find((a) => a.id === dupPreview.step.actionId) : undefined;
        if (activeAction?.attack) {
          pushAttackBullets(`${instance.id}-${slotIdx}-base`, activeAction, activeAction.attack, dupPos, (dupLocalTime - dupPreview.step.time) * 1000);
        }

        // Every Part's independent attack track — anchored at the instance's
        // *current* (dupLocalTime) position, not the placement's own fixed
        // `attack.time`, so a still-firing burst tracks the unit as it
        // keeps moving instead of appearing to shoot from its spawn point.
        for (const attack of instance.partActions) {
          const part = unitDef.parts.find((p) => p.id === attack.partId);
          const action = part?.actions.find((a) => a.id === attack.actionId);
          const baseAnchor = part && action?.attack ? partActionAnchorWorld(instance, unitDef, attack, dupLocalTime) : null;
          if (!part || !action?.attack || !baseAnchor) continue;
          const anchor: Vec2 = { x: baseAnchor.x + delta.x, y: baseAnchor.y + delta.y + pinY };
          pushAttackBullets(`${instance.id}-${slotIdx}-${attack.id}`, action, action.attack, anchor, (dupLocalTime - attack.time) * 1000);
        }
      });
    }
  }

  return (
    <div className={`shmup-enemy-form shmup-enc-fill${panelExpanded ? " shmup-enc-fill--panel" : ""}`}>
      <div className="shmup-enc-sticky-head">
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
          onSelectPartAction={selectPartAction}
          onAddPartAction={addPartActionAtPlayhead}
          onRetimeStep={handleRetimeStep}
          authorLayer={authorLayer}
          onAuthorLayerChange={switchAuthorLayer}
        />

        <div className={`shmup-enc-viewport-pin${embiggen ? " shmup-enc-viewport-pin--embiggen" : ""}`}>
          <div
            className="shmup-enemy-canvas-viewport"
            ref={arenaRef}
            onPointerDown={onArenaPointerDown}
            onPointerMove={(e) => {
              onArenaPointerMove(e);
              onStagePointerMove(e);
            }}
            onPointerUp={(e) => {
              onArenaPointerUp(e);
              onStagePointerUp();
            }}
            onPointerCancel={(e) => {
              onArenaPointerUp(e);
              onStagePointerUp();
            }}
          >
            <div
              className="shmup-enemy-canvas-stage"
              ref={stageRef}
              style={
                {
                  width,
                  height,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                  // Counter-scale factor for the *single* on-canvas controls
                  // that still live inside this scaled stage: bezier/scaling
                  // handles, the selected attack marker's ✕, and the selected
                  // node's own sprite. At a phone's fit-to-view zoom an
                  // authored 28px button rendered at 9.5px on screen (4.3px
                  // zoomed all the way out) — physically untappable.
                  // Multiplying by 1/zoom holds them at their authored *screen*
                  // size, capped at COUNTER_SCALE_MAX so ZOOM_MIN doesn't
                  // inflate them absurdly.
                  //
                  // A selected step's whole button *cluster* is deliberately
                  // NOT here — see `.shmup-enc-node-hud` below. One uniform
                  // scale inflates a cluster's ring spread along with its
                  // buttons, which pushed the outer ones past this stage's clip
                  // edge; that cluster renders in screen space instead.
                  "--enc-counter-scale": counterScale,
                } as CSSProperties
              }
            >
              {/* In air mode the tile is no longer the thing you're authoring against — it slides down through a fixed camera, dimmed, as terrain reference. */}
              <div className={authorLayer === "air" ? "shmup-enc-offlayer" : undefined} style={{ position: "absolute", left: framePos.x, top: framePos.y }}>
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
                  const { shiftY, offLayer } = renderFrameFor(instance);
                  // The drawn curve is the solved one — what this Unit can
                  // physically fly through these waypoints, swing-wide detours
                  // and all (pathSolver.ts), not the raw handles.
                  const effSteps = instance.steps.map((s) => effectiveStep(instance.id, s));
                  const solved = unitDef ? solvePathCached(effSteps, limitsFor(unitDef)) : null;
                  return instance.steps.slice(1).map((step, i) => {
                    const segment = solved?.segments[i];
                    if (!segment) return null;
                    const { p0, p1, p2, p3 } = segment;
                    const a = toStageAt(p0, shiftY);
                    const b = toStageAt(p1, shiftY);
                    const c = toStageAt(p2, shiftY);
                    const d = toStageAt(p3, shiftY);
                    return (
                      <path
                        key={step.id}
                        d={`M ${a.x},${a.y} C ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
                        fill="none"
                        stroke="#ffcc88"
                        strokeWidth={2 * counterScale}
                        opacity={offLayer ? OFF_LAYER_OPACITY : undefined}
                        markerEnd={offLayer ? undefined : "url(#shmup-arrow)"}
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
                      strokeWidth={1.5 * counterScale}
                      strokeDasharray="3,3"
                    />
                  ))}

                {/* Scaling shape stalks — origin to each handle, dashed, same visual language as bezier handle stalks. */}
                {scalingOriginStage &&
                  scalingHandleEntries.map(({ handle, pos }, i) => {
                    const stage = toStageAt(pos, selectedShiftY);
                    // Each stalk hangs off whatever the handle is measured
                    // *from*, not always the instance origin: a ring's radius
                    // from its centre, a V's arm from its tip.
                    const anchorKind = handle.kind === "vArm" ? "vTip" : null;
                    const anchorStage =
                      anchorKind && selectedInstance
                        ? toStageAt(scalingHandlesFor(selectedInstance).find((h) => h.handle.kind === anchorKind)?.pos ?? pos, selectedShiftY)
                        : scalingOriginStage;
                    return (
                      <line
                        key={i}
                        x1={anchorStage.x}
                        y1={anchorStage.y}
                        x2={stage.x}
                        y2={stage.y}
                        stroke="#ffbb33"
                        strokeWidth={1.5 * counterScale}
                        strokeDasharray="3,3"
                      />
                    );
                  })}
              </svg>

              {/* Bezier handle drag targets — real HTML buttons (not SVG shapes) so they're actually hittable on mobile, same reasoning as the ✥/+/✕ node controls below. */}
              {selectedInstance &&
                selectedStep &&
                handleDots.map(({ which, stage }) => (
                  <button
                    key={which}
                    type="button"
                    className="shmup-handle-btn"
                    title={which === "out" ? "Bend outgoing curve" : "Bend incoming curve"}
                    style={{ left: stage.x - HANDLE_RADIUS, top: stage.y - HANDLE_RADIUS }}
                    onPointerDown={(e) => beginHandleDrag(selectedInstance.id, selectedStep.id, which, e)}
                  />
                ))}

              {/* A scaling positioning-shape's handles — one set per shape kind (Curve/V/Grid/Ring), only while that instance's Scaling tab is open. */}
              {selectedInstance &&
                scalingHandleEntries.map(({ handle, pos }, i) => {
                  const stage = toStageAt(pos, selectedShiftY);
                  const title = SCALING_HANDLE_TITLES[handle.kind];
                  return (
                    <button
                      key={i}
                      type="button"
                      className="shmup-handle-btn shmup-handle-btn--scaling"
                      title={title}
                      style={{ left: stage.x - HANDLE_RADIUS, top: stage.y - HANDLE_RADIUS }}
                      onPointerDown={(e) => beginScalingDrag(selectedInstance.id, handle, pos, e)}
                    />
                  );
                })}

              {/* Ghost slot preview — where duplicates would land at the panel's preview-Difficulty count, dim and non-interactive. */}
              {scalingGhostSlots.map((p, i) => {
                const stage = toStageAt(p, selectedShiftY);
                return <div key={i} className="shmup-scaling-ghost-dot" style={{ left: stage.x, top: stage.y }} />;
              })}

              {draft.units.flatMap((instance) => {
                const unitDef = units.find((u) => u.id === instance.unitDefId);
                const spriteUrl = unitDef ? resolveSpriteUrl(unitDef.spriteId, unitDef.customSprite) : null;
                const { shiftY, offLayer } = renderFrameFor(instance);
                return instance.steps.map((step) => {
                  const pos = toStageAt(effectiveStep(instance.id, step).pos, shiftY);
                  const first = isFirstStep(instance, step.id);
                  const isSelected = selection?.kind === "step" && selection.instanceId === instance.id && selection.stepId === step.id;
                  const invincible = unitDef ? resolveInvincibleAt(instance.steps, unitDef.actions, step.time) : false;
                  return (
                    <div key={step.id} className={`shmup-enemy-node-wrap${offLayer ? " shmup-enc-offlayer shmup-enc-offlayer--inert" : ""}`} style={{ left: pos.x - NODE_RADIUS, top: pos.y - NODE_RADIUS }}>
                      <button
                        type="button"
                        className={`shmup-enemy-node ${isSelected ? "shmup-enemy-node--selected" : ""} ${invincible ? "shmup-enemy-node--hidden" : ""}`}
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
                        {invincible && <span title="Invincible">🛡️</span>}
                        {instance.scaling.maxCount > 1 && <span title="Scaling enabled">⚖️</span>}
                      </div>

                      {/* The control cluster for a selected step is NOT rendered here —
                          it lives in a screen-space HUD outside the zoomed stage
                          (`.shmup-enc-node-hud` below), so its buttons keep a real
                          touch size at any zoom without the ring spread inflating
                          past the canvas edge. */}
                    </div>
                  );
                });
              })}

              {draft.units.flatMap((instance) => {
                const unitDef = units.find((u) => u.id === instance.unitDefId);
                if (!unitDef) return [];
                const { shiftY, offLayer } = renderFrameFor(instance);
                return instance.partActions.map((placement) => {
                  const part = unitDef.parts.find((p) => p.id === placement.partId);
                  const action = part?.actions.find((a) => a.id === placement.actionId);
                  const anchorWorld = partActionAnchorWorld(instance, unitDef, placement);
                  if (!anchorWorld) return null;
                  const pos = toStageAt(anchorWorld, shiftY);
                  const isSelected = selection?.kind === "partAction" && selection.instanceId === instance.id && selection.placementId === placement.id;
                  const partSpriteUrl = part ? resolveSpriteUrl(part.spriteId, part.customSprite) : null;
                  return (
                    <div
                      key={placement.id}
                      className={`shmup-part-marker-wrap${offLayer ? " shmup-enc-offlayer shmup-enc-offlayer--inert" : ""}`}
                      style={{ left: pos.x - PART_MARKER_RADIUS, top: pos.y - PART_MARKER_RADIUS }}
                    >
                      <button
                        type="button"
                        className={`shmup-part-marker ${isSelected ? "shmup-part-marker--selected" : ""}`}
                        style={partSpriteUrl ? { backgroundImage: `url(${partSpriteUrl})` } : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectPartAction(instance.id, placement.id);
                        }}
                        title={`${part?.name ?? "?"}: ${action?.name ?? "(no Action)"} @ ${placement.time.toFixed(1)}s`}
                      >
                        {!partSpriteUrl && "◈"}
                      </button>
                      {isSelected && (
                        <div className="shmup-part-marker__controls">
                          {/* Same +/✕ pair a selected step gets. + appends another placement to this same Part's track at the playhead. */}
                          <button
                            type="button"
                            className="shmup-enemy-node__btn shmup-enemy-node__btn--add"
                            title={`Add another ${part?.name ?? "Part"} Action at the playhead`}
                            onClick={(e) => {
                              e.stopPropagation();
                              addPartActionAtPlayhead(instance.id, placement.partId);
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="shmup-enemy-node__btn shmup-enemy-node__btn--delete"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePartActionPlacement(instance.id, placement.id);
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

              {!hitboxPreviewOn &&
                draft.units.map((instance) => {
                  const unitDef = units.find((u) => u.id === instance.unitDefId);
                  const preview = computeInstancePreview(instance, unitDef, scrubTime);
                  if (!preview || preview.invincible) return null;
                  const spriteUrl = unitDef ? resolveSpriteUrl(unitDef.spriteId, unitDef.customSprite) : null;
                  const { shiftY, offLayer } = renderFrameFor(instance);
                  const pos = toStageAt(preview.pos, shiftY);
                  return (
                    <div
                      key={`preview-${instance.id}`}
                      className={`shmup-enemy-preview-dot${offLayer ? " shmup-enc-offlayer" : ""}`}
                      style={{ left: pos.x - PREVIEW_RADIUS, top: pos.y - PREVIEW_RADIUS, backgroundImage: spriteUrl ? `url(${spriteUrl})` : undefined }}
                      title={`${unitDef?.name ?? "?"} @ ${scrubTime.toFixed(1)}s`}
                    />
                  );
                })}

              {/*
                The camera box is normally part of the hitbox preview, but in
                air mode it's the thing being authored *against* — every air
                position is really "where on screen, and when" — so it's drawn
                unconditionally there. Without it the air canvas is an empty
                black field with nothing to place anything relative to.
              */}
              {authorLayer === "air" && !hitboxPreviewOn && (
                <div
                  className="shmup-hitbox-camera-bounds shmup-hitbox-camera-bounds--locked"
                  style={{ left: cameraBoundsStage.x, top: cameraBoundsStage.y, width: cameraBoundsStage.width, height: cameraBoundsStage.height }}
                  title="The screen. Locked in air mode — the terrain scrolls past it."
                />
              )}

              {hitboxPreviewOn && (
                <>
                  {/* Tile bounds — thick yellow, the tile's real footprint. Camera/playable bounds — dotted, roughly what's visible on screen at once (hitboxPreview.ts's computeCameraBoundsRect). Player reference — a static green circle at real hitboxRadiusNormal scale standing in for the (not simulated) player ship. */}
                  <div className={`shmup-hitbox-tile-bounds${authorLayer === "air" ? " shmup-enc-offlayer" : ""}`} style={{ left: tileRectStage.x, top: tileRectStage.y, width: tileRectStage.width, height: tileRectStage.height }} />
                  <div
                    className={`shmup-hitbox-camera-bounds${authorLayer === "air" ? " shmup-hitbox-camera-bounds--locked" : ""}`}
                    style={{ left: cameraBoundsStage.x, top: cameraBoundsStage.y, width: cameraBoundsStage.width, height: cameraBoundsStage.height }}
                  />
                  <div
                    className="shmup-hitbox-player"
                    style={{
                      left: playerRefStage.x - PLAYER_REFERENCE_HITBOX_RADIUS,
                      top: playerRefStage.y - PLAYER_REFERENCE_HITBOX_RADIUS,
                      width: PLAYER_REFERENCE_HITBOX_RADIUS * 2,
                      height: PLAYER_REFERENCE_HITBOX_RADIUS * 2,
                    }}
                    title="Reference player hitbox (not simulated — a static stand-in)"
                  />
                  {/* Ground and air read as different outlines (red vs. amber) so a crowded preview still says which frame each box belongs to — the two behave completely differently once the scroll starts, and at real hitbox scale they're otherwise identical rectangles. */}
                  {hitboxEnemyMarkers.map((m) => (
                    <div
                      key={m.key}
                      className={`shmup-hitbox-enemy shmup-hitbox-enemy--${m.layer}${m.offLayer ? " shmup-enc-offlayer" : ""}`}
                      style={{ left: m.stage.x - m.sizePx / 2, top: m.stage.y - m.sizePx / 2, width: m.sizePx, height: m.sizePx }}
                    />
                  ))}
                  {hitboxBulletMarkers.map((m) => (
                    <div
                      key={m.key}
                      className={`shmup-hitbox-bullet${m.offLayer ? " shmup-enc-offlayer" : ""}`}
                      style={{ left: m.stage.x - m.diameterPx / 2, top: m.stage.y - m.diameterPx / 2, width: m.diameterPx, height: m.diameterPx, opacity: m.alpha }}
                    />
                  ))}
                </>
              )}
            </div>

            {/*
              Selected-step control HUD. A sibling of the transformed stage for
              the same reason the corner overlays are: anything inside that stage
              gets multiplied by the zoom, and at a phone's fit-to-view zoom the
              authored 28px buttons rendered at 9.5px. Counter-scaling them in
              place doesn't work either — one uniform scale inflates the ring's
              *spread* along with the buttons, which pushed the outer controls
              past the viewport's clip edge and made them unhittable.

              Rendering in screen space instead lets the button size and the ring
              spread be chosen independently, both in real pixels, and lets the
              cluster be clamped inside the canvas so no control is ever off the
              edge — near-misses land on inert canvas rather than deselecting.

              Hidden entirely while the Scaling tab is open: those controls edit
              one *step*, but a scaling shape's own handles and ghost slots start
              right next to the instance, so the cluster sat directly on top of
              the thing you were there to drag.
            */}
            {selectedNodeHud && selectedInstance && selectedStep && !scalingPanelOpen && (
              <div className="shmup-enc-node-hud" style={{ left: selectedNodeHud.x, top: selectedNodeHud.y }}>
                <div className="shmup-enemy-node__controls">
                  <button
                    type="button"
                    className="shmup-enemy-node__btn shmup-enemy-node__btn--move"
                    title="Drag to move"
                    onPointerDown={(e) => beginDrag(selectedInstance.id, selectedStep.id, selectedStep.pos, e)}
                  >
                    ✥
                  </button>
                  {selectedIdx === selectedInstance.steps.length - 1 && (
                    <button
                      type="button"
                      className="shmup-enemy-node__btn shmup-enemy-node__btn--add"
                      title="Add next step"
                      onClick={(e) => {
                        e.stopPropagation();
                        addNextStep(selectedInstance.id);
                      }}
                    >
                      +
                    </button>
                  )}
                  <button
                    type="button"
                    className="shmup-enemy-node__btn shmup-enemy-node__btn--delete"
                    title={selectedIdx === 0 ? "Remove this Unit from the encounter" : "Delete"}
                    onClick={(e) => {
                      e.stopPropagation();
                      requestDeleteStep(selectedInstance.id, selectedStep.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Corner overlays — siblings of the transformed stage, not children of it, so they stay fixed-size/fixed-position regardless of the current zoom. */}
            <div className="shmup-canvas-corner shmup-canvas-corner--top-left">
              <button
                type="button"
                className={`shmup-canvas-corner-btn ${hitboxPreviewOn ? "shmup-btn--active" : ""}`}
                onClick={() => setHitboxPreviewOn((v) => !v)}
                title="Low-fi hitbox/boundary preview"
              >
                ⊡
              </button>
              {hitboxPreviewOn && (
                <Dial label="Diff." value={hitboxPreviewDifficulty} onChange={setHitboxPreviewDifficulty} min={0} max={HITBOX_PREVIEW_DIFFICULTY_MAX} size={32} />
              )}
            </div>
            <div className="shmup-canvas-corner shmup-canvas-corner--top-right">
              <button
                type="button"
                className="shmup-canvas-corner-btn shmup-canvas-corner-btn--play"
                onClick={handlePlaytest}
                disabled={Boolean(error)}
                title="Play test — save and play this encounter in the game"
              >
                ▶
              </button>
              <button type="button" className="shmup-canvas-corner-btn" onClick={() => setEmbiggen((v) => !v)} title={embiggen ? "Shrink" : "Embiggen — fullscreen"}>
                {embiggen ? "⤡" : "⛶"}
              </button>
            </div>

            <div className="shmup-canvas-zoom-btns">
              {/* zoomRef.current, not the `zoom` state closure — a rapid run of clicks (or clicks that land before React re-renders) would otherwise all divide/multiply the same stale value instead of compounding. */}
              <button
                type="button"
                className="shmup-canvas-zoom-btn"
                onClick={() => applyZoom(zoomRef.current / 1.3, viewportSize.width / 2, viewportSize.height / 2)}
                disabled={zoom <= ZOOM_MIN}
                title="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="shmup-canvas-zoom-btn"
                onClick={() => applyZoom(zoomRef.current * 1.3, viewportSize.width / 2, viewportSize.height / 2)}
                disabled={zoom >= ZOOM_MAX}
                title="Zoom in"
              >
                +
              </button>
            </div>
            <EncounterMinimap
              stageWidth={width}
              stageHeight={height}
              tileRectStage={minimapTileRectStage}
              stepPointsStage={stepPointsStage}
              pan={pan}
              zoom={zoom}
              viewportWidth={viewportSize.width}
              viewportHeight={viewportSize.height}
              onPan={setPan}
            />
          </div>
        </div>
      </div>

      <div className="shmup-enc-tabs">
        <div className="shmup-enc-tabbar">
          <button type="button" className={`shmup-enc-tab-btn ${effectiveTab === "basics" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setActiveTab("basics")}>
            Basics
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${effectiveTab === "add" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setActiveTab("add")}>
            + Add
          </button>
          {availableTabs.includes("step") && (
            <button type="button" className={`shmup-enc-tab-btn ${effectiveTab === "step" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setActiveTab("step")}>
              Step
            </button>
          )}
          {availableTabs.includes("partAction") && (
            <button type="button" className={`shmup-enc-tab-btn ${effectiveTab === "partAction" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setActiveTab("partAction")}>
              Part
            </button>
          )}
          {availableTabs.includes("scaling") && (
            <button type="button" className={`shmup-enc-tab-btn ${effectiveTab === "scaling" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setActiveTab("scaling")}>
              Scaling
            </button>
          )}
          <button
            type="button"
            className="shmup-enc-tab-btn shmup-enc-tab-btn--grow"
            onClick={() => setPanelExpanded((v) => !v)}
            title={panelExpanded ? "Shrink this panel, give the height back to the map" : "Grow this panel — shrinks the map to a reference strip"}
            aria-pressed={panelExpanded}
          >
            {panelExpanded ? "▼" : "▲"}
          </button>
        </div>

        <div className="shmup-enc-tab-content">
          {effectiveTab === "basics" && (
            <div className="shmup-panel">
              <label className="shmup-field shmup-field--inline">
                <span>Name</span>
                <input type="text" className="shmup-input" value={draft.name} onChange={(e) => updateDraft({ ...draft, name: e.target.value })} />
              </label>
              <div className="shmup-dial-grid">
                <Dial label="Weight" value={draft.weight} onChange={(v) => updateDraft({ ...draft, weight: v })} step={0.1} showNudgeButtons />
              </div>
            </div>
          )}

          {/* The roster follows the frame toggle rather than offering its own filter — you add into the frame you're looking at, so two controls for one decision would only let them disagree. One roster per layer, doodads included (airFrame.ts's AuthorLayer). */}
          {effectiveTab === "add" && (
            <div className="shmup-panel">
              <div className="shmup-tile-picker">
                {addableUnits.length === 0 ? (
                  <p className="shmup-readout">No {authorLayer} Units yet — create one via the Units menu (set its Layer to {authorLayer}).</p>
                ) : (
                  addableUnits.map((u) => {
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
              </div>
            </div>
          )}

          {effectiveTab === "step" && selectedInstance && selectedStep && (
            <>
              {pendingDeleteKey === deleteKey(selectedInstance.id, selectedStep.id) ? (
                <div className="shmup-panel shmup-panel--confirm">
                  <p className="shmup-readout">{isFirstStep(selectedInstance, selectedStep.id) ? "Remove this Unit from the encounter?" : "Delete this step onward?"}</p>
                  <div className="shmup-btn-row">
                    <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => requestDeleteStep(selectedInstance.id, selectedStep.id)}>
                      Confirm
                    </button>
                    <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteKey(null)}>
                      Keep
                    </button>
                  </div>
                </div>
              ) : (
                <StepPanel
                  step={selectedStep}
                  unitDef={selectedUnitDef}
                  timeDerived={isStepTimeDerived(selectedInstance, selectedStep.id, selectedUnitDef)}
                  onChange={(patch) => updateInstance(selectedInstance.id, (i) => updateStep(i, selectedStep.id, patch))}
                />
              )}
            </>
          )}

          {effectiveTab === "partAction" && selectedInstance && selectedPlacement && (
            <PartActionPanel unit={selectedUnitDef} instance={selectedInstance} placement={selectedPlacement} onChange={(patch) => updateInstance(selectedInstance.id, (i) => updatePartAction(i, selectedPlacement.id, patch))} />
          )}

          {scalingPanelOpen && selectedInstance && (
            <UnitScalingPanel
              scaling={selectedInstance.scaling}
              unitCost={selectedUnitDef?.cost ?? 1}
              previewDifficulty={scalingPreviewDifficulty}
              onPreviewDifficultyChange={setScalingPreviewDifficulty}
              onChange={(patch) => updateScaling(selectedInstance.id, patch)}
              onAddCurvePoint={() => addCurvePoint(selectedInstance.id)}
              onRemoveCurvePoint={(index) => removeCurvePoint(selectedInstance.id, index)}
            />
          )}
        </div>
      </div>

      <div className="shmup-enc-footer">
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
    </div>
  );
}
