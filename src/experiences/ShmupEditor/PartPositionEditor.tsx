import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Vec2 } from "./encounterTypes";

interface PartPositionEditorProps {
  bodySpriteUrl: string | null;
  bodyLabel: string;
  partSpriteUrl: string | null;
  offset: Vec2;
  onChange: (offset: Vec2) => void;
}

const CANVAS_SIZE = 260;
const BODY_BOX = 150;
const PART_BOX = 64;
const NUDGE_STEP = 4;

/**
 * Visual "where does this Part sit on the Unit" editor (Noah's request —
 * the plain numeric X/Y offset fields gave no way to actually *see* where
 * a turret would land). Renders the owning Unit's body sprite dimmed as a
 * reference (same 0.45 opacity convention `.shmup-enemy-node--hidden`
 * already uses for "ghosted"), the Part's own sprite on top at its
 * current offset, draggable directly, plus four arrow-nudge buttons for
 * pixel-precise adjustment without needing a steady thumb. The numeric
 * fields (PartEditor.tsx) stay too — this is additive, not a replacement,
 * for typing an exact value.
 *
 * A flat 1:1 px-per-offset-unit mapping, centered on the canvas — no
 * PADDING/bounding-box math needed like EncounterEditor.tsx's canvas,
 * since this is a small fixed-size widget, not a scrolling world space.
 */
export default function PartPositionEditor({ bodySpriteUrl, bodyLabel, partSpriteUrl, offset, onChange }: PartPositionEditorProps) {
  const [dragOffset, setDragOffset] = useState<Vec2 | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const effective = dragOffset ?? offset;

  function beginDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragOffset(offset);
  }
  function onStagePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOffset || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left - CANVAS_SIZE / 2, y: e.clientY - rect.top - CANVAS_SIZE / 2 });
  }
  function endDrag() {
    if (!dragOffset) return;
    onChange(dragOffset);
    setDragOffset(null);
  }

  function nudge(dx: number, dy: number) {
    onChange({ x: offset.x + dx, y: offset.y + dy });
  }

  return (
    <div className="shmup-part-position">
      <div
        className="shmup-part-position__stage"
        ref={stageRef}
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        onPointerMove={onStagePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="shmup-part-position__body"
          style={{
            width: BODY_BOX,
            height: BODY_BOX,
            left: CANVAS_SIZE / 2 - BODY_BOX / 2,
            top: CANVAS_SIZE / 2 - BODY_BOX / 2,
            backgroundImage: bodySpriteUrl ? `url(${bodySpriteUrl})` : undefined,
          }}
          title={bodyLabel}
        >
          {!bodySpriteUrl && "●"}
        </div>
        <div className="shmup-part-position__crosshair" style={{ left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2 }} />
        <button
          type="button"
          className="shmup-part-position__part"
          style={{
            width: PART_BOX,
            height: PART_BOX,
            left: CANVAS_SIZE / 2 + effective.x - PART_BOX / 2,
            top: CANVAS_SIZE / 2 + effective.y - PART_BOX / 2,
            backgroundImage: partSpriteUrl ? `url(${partSpriteUrl})` : undefined,
          }}
          title="Drag to reposition this Part"
          onPointerDown={beginDrag}
        >
          {!partSpriteUrl && "●"}
        </button>
      </div>

      <div className="shmup-part-position__nudge">
        <button type="button" className="shmup-btn shmup-btn--small" title="Nudge up" onClick={() => nudge(0, -NUDGE_STEP)}>
          ↑
        </button>
        <div className="shmup-btn-row">
          <button type="button" className="shmup-btn shmup-btn--small" title="Nudge left" onClick={() => nudge(-NUDGE_STEP, 0)}>
            ←
          </button>
          <button type="button" className="shmup-btn shmup-btn--small" title="Nudge right" onClick={() => nudge(NUDGE_STEP, 0)}>
            →
          </button>
        </div>
        <button type="button" className="shmup-btn shmup-btn--small" title="Nudge down" onClick={() => nudge(0, NUDGE_STEP)}>
          ↓
        </button>
      </div>
    </div>
  );
}
