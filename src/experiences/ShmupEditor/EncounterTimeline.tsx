import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { partActionsForPart } from "./partActions";
import { isStepTimeDerived } from "./encounterTiming";
import { resolveInvincibleAt } from "./actionState";
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
            return (
              <div key={instance.id} className="shmup-timeline__track">
                <div className="shmup-timeline__track-label">{unitDef?.name ?? "?"}</div>
                <div className="shmup-timeline__lane">
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
                    return (
                      <div key={step.id} className="shmup-timeline__step-wrap" style={{ left }}>
                        <button
                          type="button"
                          className={`shmup-timeline__step ${isSelected ? "shmup-timeline__step--selected" : ""} ${invincible ? "shmup-timeline__step--hidden" : ""}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStep(instance.id, step.id);
                          }}
                          title={invincible ? "Invincible" : undefined}
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
                        return (
                          <button
                            key={placement.id}
                            type="button"
                            className={`shmup-timeline__attack ${isSelected ? "shmup-timeline__attack--selected" : ""}`}
                            style={{ left }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAttack(instance.id, placement.id);
                            }}
                            title={action?.name ?? "(missing Action)"}
                          />
                        );
                      })}
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
