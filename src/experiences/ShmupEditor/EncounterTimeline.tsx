import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { partActionsForPart } from "./partActions";
import { isStepTimeDerived } from "./encounterTiming";
import { resolveInvincibleAt } from "./actionState";
import { actionCategoryColors } from "./actionCategory";
import { spawnDelayOffsetsSec } from "./unitScaling";
import { authorLayerOf, type AuthorLayer } from "./airFrame";
import type { EncounterUnit } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

type Selection = { instanceId: string; kind: "step"; stepId: string } | { instanceId: string; kind: "attack"; attackId: string } | null;

interface EncounterTimelineProps {
  units: EncounterUnit[];
  unitDefs: UnitDef[];
  maxTime: number;
  scrubTime: number;
  onScrub: (t: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  selection: Selection;
  onSelectStep: (instanceId: string, stepId: string) => void;
  onSelectAttack: (instanceId: string, attackId: string) => void;
  onRetimeStep: (instanceId: string, stepId: string, time: number) => void;
  /** Which reference frame the canvas is drawn in (airFrame.ts) — decides which tracks are authored in full and which collapse to timing hairlines. */
  authorLayer: AuthorLayer;
  onAuthorLayerChange: (layer: AuthorLayer) => void;
  /** Per-instance decouple moment from `computePinTimeSec`, for the pin markers on air tracks. Absent/null = this instance never leaves the tile frame. */
  pinSecByInstance: Map<string, number | null>;
}

const PX_PER_SEC = 50;
const STAGE_PADDING_LEFT = 12;

/**
 * Shared ruler across the whole encounter (specs/shmup-editor.md's
 * Encounter editor section) — one track per Unit instance, replacing the
 * old per-step Trigger dropdown as the primary way to say "when." All
 * instances share one clock (`time`, encounterTypes.ts), so this is a
 * single ruler with multiple tracks, not a separate scrubber per instance
 * — that's what lets two units' steps be visually lined up against each
 * other. Tap a step diamond to select it (same selection as the canvas);
 * a drag handle appears only when selected, mirroring the canvas's move
 * handle (EncounterEditor.tsx) rather than making every marker draggable
 * at all times. Tapping/dragging the ruler background scrubs the playhead.
 *
 * **The retime-drag handle only appears on a manually-timed step.** A
 * *derived* step's time comes from arc length / the referenced Action's
 * Movement % (encounterTiming.ts) — since Movement % now lives on the
 * shared, reusable Action rather than a per-placement field, there's no
 * longer a safe per-placement value to solve-and-write-back when dragging
 * (see that file's header). Retiming a moving segment means picking a
 * different Action for the step that starts it (Step tab), not dragging
 * its arrival marker.
 *
 * **The Ground/Air frame toggle lives here**, at the top with the ruler,
 * because it's a property of the whole view rather than of any selection —
 * see `airFrame.ts` and `EncounterEditor.tsx`'s `authorLayer`. Tracks in the
 * frame you aren't authoring collapse to a hairline: no label, no markers to
 * mis-tap, just enough to see where their events fall against the ones you
 * are authoring. That's the whole reason they stay on the ruler at all —
 * choreographing a strafing run against the turret it's meant to outrun
 * needs both timings side by side, even though their positions live in
 * different frames.
 */
export default function EncounterTimeline({
  units,
  unitDefs,
  maxTime,
  scrubTime,
  onScrub,
  playing,
  onTogglePlay,
  selection,
  onSelectStep,
  onSelectAttack,
  onRetimeStep,
  authorLayer,
  onAuthorLayerChange,
  pinSecByInstance,
}: EncounterTimelineProps) {
  const [dragTime, setDragTime] = useState<{ instanceId: string; stepId: string; time: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const width = Math.max(200, maxTime * PX_PER_SEC) + STAGE_PADDING_LEFT * 2;
  const ticks = Array.from({ length: Math.floor(maxTime) + 1 }, (_, i) => i);

  function timeFromClientX(clientX: number): number {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, (clientX - rect.left - STAGE_PADDING_LEFT) / PX_PER_SEC);
  }

  function beginScrub(e: ReactPointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setScrubbing(true);
    onScrub(timeFromClientX(e.clientX));
  }
  function onStagePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (scrubbing) onScrub(timeFromClientX(e.clientX));
    if (dragTime) setDragTime({ ...dragTime, time: timeFromClientX(e.clientX) });
  }
  function endStagePointer() {
    setScrubbing(false);
    if (dragTime) {
      onRetimeStep(dragTime.instanceId, dragTime.stepId, dragTime.time);
      setDragTime(null);
    }
  }

  function beginRetimeDrag(instanceId: string, stepId: string, time: number, e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragTime({ instanceId, stepId, time });
  }

  function stepTime(instanceId: string, step: { id: string; time: number }): number {
    return dragTime && dragTime.instanceId === instanceId && dragTime.stepId === step.id ? dragTime.time : step.time;
  }

  return (
    <div className="shmup-timeline">
      <div className="shmup-timeline__toolbar">
        <button type="button" className="shmup-btn shmup-btn--small" onClick={onTogglePlay}>
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <span className="shmup-timeline__readout">{scrubTime.toFixed(1)}s</span>
        <div className="shmup-timeline__layer-toggle">
          <button
            type="button"
            className={`shmup-btn shmup-btn--small ${authorLayer === "ground" ? "shmup-btn--active" : ""}`}
            onClick={() => onAuthorLayerChange("ground")}
            aria-pressed={authorLayer === "ground"}
            title="Ground frame — the tile holds still and the camera climbs it. Air units are dimmed."
          >
            Ground
          </button>
          <button
            type="button"
            className={`shmup-btn shmup-btn--small ${authorLayer === "air" ? "shmup-btn--active" : ""}`}
            onClick={() => onAuthorLayerChange("air")}
            aria-pressed={authorLayer === "air"}
            title="Air frame — the camera holds still and the terrain slides beneath it. Ground units and the tile are dimmed."
          >
            Air
          </button>
        </div>
      </div>
      <div className="shmup-timeline__scroll">
        <div
          className="shmup-timeline__stage"
          ref={stageRef}
          style={{ width }}
          onPointerDown={beginScrub}
          onPointerMove={onStagePointerMove}
          onPointerUp={endStagePointer}
          onPointerCancel={endStagePointer}
        >
          <div className="shmup-timeline__ruler">
            {ticks.map((t) => (
              <div key={t} className="shmup-timeline__tick" style={{ left: t * PX_PER_SEC + STAGE_PADDING_LEFT }}>
                {t}s
              </div>
            ))}
          </div>

          {units.map((instance) => {
            const unitDef = unitDefs.find((u) => u.id === instance.unitDefId);
            const offLayer = (unitDef ? authorLayerOf(unitDef.layer) : "ground") !== authorLayer;
            // A track in the frame you aren't authoring is reduced to bare
            // timing hairlines — no label, no sprite, no Part sub-lanes, and
            // nothing selectable. It exists purely so you can line your own
            // events up against it; anything more would be clutter competing
            // with the track you're actually editing.
            if (offLayer) {
              return (
                <div key={instance.id} className="shmup-timeline__track shmup-timeline__track--compact">
                  <div className="shmup-timeline__lane shmup-timeline__lane--compact" title={`${unitDef?.name ?? "?"} (other frame)`}>
                    {instance.steps.map((step) => (
                      <div key={step.id} className="shmup-timeline__hairline" style={{ left: stepTime(instance.id, step) * PX_PER_SEC + STAGE_PADDING_LEFT }} />
                    ))}
                    {instance.partActions.map((placement) => (
                      <div key={placement.id} className="shmup-timeline__hairline shmup-timeline__hairline--attack" style={{ left: placement.time * PX_PER_SEC + STAGE_PADDING_LEFT }} />
                    ))}
                  </div>
                </div>
              );
            }
            // Where this instance decouples from the scrolling tile frame
            // (airFrame.ts). Only meaningful while authoring air — it's the
            // moment its authored path stops being relative to the terrain,
            // which is otherwise invisible on a ruler of plain times.
            const pinSec = authorLayer === "air" ? pinSecByInstance.get(instance.id) ?? null : null;
            // Scaled duplicates beyond the base instance (slot 0, already drawn
            // below) spawn staggered by spawnDelayMs — ghost markers show
            // where each later slot's copy of the same step/attack lands,
            // per shmup-editor.todo.md's "spawn delay ... not drawn on the
            // timeline UI yet." Zero delay means every slot lands on slot 0
            // exactly, so there's nothing distinct to ghost.
            const ghostOffsets =
              instance.scaling.maxCount > 1 && instance.scaling.spawnDelayMs > 0
                ? spawnDelayOffsetsSec(instance.scaling, instance.scaling.maxCount).slice(1)
                : [];
            return (
              <div key={instance.id} className="shmup-timeline__track">
                <div className="shmup-timeline__track-label">{unitDef?.name ?? "?"}</div>
                <div className="shmup-timeline__lane">
                  {/* The pin: where this air unit stops riding the terrain and holds screen position. Everything left of it is the fly-in. */}
                  {pinSec !== null && (
                    <div
                      className="shmup-timeline__pin"
                      style={{ left: pinSec * PX_PER_SEC + STAGE_PADDING_LEFT }}
                      title={`Decouples from the scrolling terrain at ${pinSec.toFixed(1)}s — flies in before this, holds screen position after`}
                    />
                  )}
                  <svg className="shmup-timeline__lane-svg" width={width} height={28}>
                    {instance.steps.slice(1).map((step, i) => {
                      const prev = instance.steps[i];
                      const x1 = stepTime(instance.id, prev) * PX_PER_SEC + STAGE_PADDING_LEFT;
                      const x2 = stepTime(instance.id, step) * PX_PER_SEC + STAGE_PADDING_LEFT;
                      return <line key={step.id} x1={x1} y1={14} x2={x2} y2={14} stroke="#ffcc88" strokeWidth={2} />;
                    })}
                  </svg>
                  {instance.steps.map((step) => {
                    const isSelected = selection?.kind === "step" && selection.instanceId === instance.id && selection.stepId === step.id;
                    const left = stepTime(instance.id, step) * PX_PER_SEC + STAGE_PADDING_LEFT;
                    const invincible = unitDef ? resolveInvincibleAt(instance.steps, unitDef.actions, step.time) : false;
                    const derived = isStepTimeDerived(instance, step.id, unitDef);
                    const action = unitDef?.actions.find((a) => a.id === step.actionId);
                    const colors = actionCategoryColors(action);
                    const setsInvincible = action?.setsInvincible != null;
                    return (
                      <div key={step.id} className="shmup-timeline__step-wrap" style={{ left }}>
                        <button
                          type="button"
                          className={`shmup-timeline__step ${isSelected ? "shmup-timeline__step--selected" : ""} ${invincible ? "shmup-timeline__step--hidden" : ""} ${setsInvincible ? "shmup-timeline__marker--sets-invincible" : ""}`}
                          style={{ backgroundColor: colors.fill, borderColor: isSelected ? undefined : colors.border }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStep(instance.id, step.id);
                          }}
                          title={[action?.name, invincible ? "Invincible" : null].filter(Boolean).join(" — ") || undefined}
                        />
                        {isSelected && !derived && (
                          <button
                            type="button"
                            className="shmup-timeline__step-handle"
                            title="Drag to retime"
                            onPointerDown={(e) => beginRetimeDrag(instance.id, step.id, step.time, e)}
                          >
                            ⟷
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {/* Ghost copies of every step for each scaled duplicate slot beyond the base instance — see ghostOffsets above. Non-interactive: a ghost isn't a distinct authored object to select/retime, just a preview of where slot N's copy of this step lands once spawnDelayMs staggers it in. */}
                  {ghostOffsets.flatMap((offset, slotIdx) =>
                    instance.steps.map((step) => {
                      const action = unitDef?.actions.find((a) => a.id === step.actionId);
                      const colors = actionCategoryColors(action);
                      const left = (stepTime(instance.id, step) + offset) * PX_PER_SEC + STAGE_PADDING_LEFT;
                      return (
                        <div key={`ghost-${slotIdx}-${step.id}`} className="shmup-timeline__step-wrap" style={{ left }} title={`Duplicate slot ${slotIdx + 2} of ${instance.scaling.maxCount}`}>
                          <div className="shmup-timeline__step shmup-timeline__marker--ghost" style={{ backgroundColor: colors.fill, borderColor: colors.border }} />
                        </div>
                      );
                    })
                  )}
                </div>

                {/* One extra lane per Part that has at least one placed Action — independent per-part tracks, so a battleship's three turrets show up as three separate rows, not merged into one. */}
                {unitDef?.parts
                  .filter((part) => partActionsForPart(instance, part.id).length > 0)
                  .map((part) => (
                    <div key={part.id} className="shmup-timeline__lane shmup-timeline__lane--attack">
                      <div className="shmup-timeline__track-sublabel">{part.name}</div>
                      {partActionsForPart(instance, part.id).map((placement) => {
                        const isSelected = selection?.kind === "attack" && selection.instanceId === instance.id && selection.attackId === placement.id;
                        const action = part.actions.find((a) => a.id === placement.actionId);
                        const left = placement.time * PX_PER_SEC + STAGE_PADDING_LEFT;
                        const colors = actionCategoryColors(action);
                        const setsInvincible = action?.setsInvincible != null;
                        return (
                          <button
                            key={placement.id}
                            type="button"
                            className={`shmup-timeline__attack ${isSelected ? "shmup-timeline__attack--selected" : ""} ${setsInvincible ? "shmup-timeline__marker--sets-invincible" : ""}`}
                            style={{ left, backgroundColor: colors.fill, borderColor: isSelected ? undefined : colors.border }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAttack(instance.id, placement.id);
                            }}
                            title={action?.name ?? "(missing Action)"}
                          />
                        );
                      })}
                      {ghostOffsets.flatMap((offset, slotIdx) =>
                        partActionsForPart(instance, part.id).map((placement) => {
                          const action = part.actions.find((a) => a.id === placement.actionId);
                          const colors = actionCategoryColors(action);
                          const left = (placement.time + offset) * PX_PER_SEC + STAGE_PADDING_LEFT;
                          return (
                            <div
                              key={`ghost-${slotIdx}-${placement.id}`}
                              className="shmup-timeline__attack shmup-timeline__marker--ghost"
                              style={{ left, backgroundColor: colors.fill, borderColor: colors.border }}
                              title={`Duplicate slot ${slotIdx + 2} of ${instance.scaling.maxCount}`}
                            />
                          );
                        })
                      )}
                    </div>
                  ))}
              </div>
            );
          })}

          <div className="shmup-timeline__playhead" style={{ left: scrubTime * PX_PER_SEC + STAGE_PADDING_LEFT }} />
        </div>
      </div>
    </div>
  );
}
