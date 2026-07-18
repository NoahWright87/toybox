import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import "./Dial.css";

const SWEEP_DEG = 270;
const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE_TOLERANCE_PX = 6;

interface DialProps {
  value: number;
  onChange: (value: number) => void;
  /** Both provided = clamped mode: the pointer sweeps a fixed 270° arc between them. Omit both for unclamped (free-spin) mode. */
  min?: number;
  max?: number;
  step?: number;
  /** Value restored by right-click (desktop) or a long-press (mobile). Defaults to `min` if clamped, 0 if unclamped. */
  defaultValue?: number;
  /** Face diameter, px. */
  size?: number;
  /** Vertical drag distance, px, per one `step` increment — lower is more sensitive. */
  pixelsPerStep?: number;
  label?: string;
  showNudgeButtons?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}

/**
 * FL-Studio-style rotary control (shmup-editor.todo.md, E3 #193 follow-up —
 * built for the Scaling panel's minCostPerInstance/maxCount, but deliberately
 * generic so any Doors 97 app can reuse it). The interaction is a **vertical
 * drag, not a circular one** — dragging up increases, down decreases,
 * regardless of where on the face you grab; tracking the pointer's actual
 * angle around the knob's center is the naive version of this control and is
 * notoriously fiddly (it demands the pointer trace a precise arc at exactly
 * the knob's radius), which is why no serious audio/DAW software does it
 * that way. The knob's own rendered angle is purely a readout, never an
 * input.
 *
 * **Clamped vs. unclamped** are genuinely different behaviors, not one
 * mechanism with an optional bound: clamped mode has real endpoints to sweep
 * a fixed 270° arc between (`-135deg` at `min` to `+135deg` at `max`), so the
 * angle is always a faithful readout of position-in-range. Unclamped mode
 * has no endpoints to map to at all — trying to force one onto an unbounded
 * range would be arbitrary and misleading — so it only animates a live
 * "spinning" readout while a drag is actually in progress (proportional to
 * this gesture's motion so far) and rests at neutral otherwise; the real
 * value lives in the numeric readout below, not the needle.
 *
 * Reset (right-click, or press-and-hold ~550ms without moving past a small
 * tolerance — the touch equivalent of right-click) and direct text entry
 * (tap the numeric readout) are both always available alongside dragging.
 */
export function Dial({ value, onChange, min, max, step = 1, defaultValue, size = 44, pixelsPerStep = 4, label, showNudgeButtons = false, formatValue, className }: DialProps) {
  const clamped = min !== undefined && max !== undefined;
  const resetValue = defaultValue ?? (clamped ? min! : 0);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [dragSpinDeg, setDragSpinDeg] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const longPressRef = useRef<{ timer: number; startX: number; startY: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function resolve(raw: number): number {
    const stepped = Math.round(raw / step) * step;
    return clamped ? Math.min(max!, Math.max(min!, stepped)) : stepped;
  }

  function cancelLongPress() {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }

  function beginDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startValue: value };
    const startX = e.clientX;
    const startY = e.clientY;
    longPressRef.current = {
      startX,
      startY,
      timer: window.setTimeout(() => {
        onChange(resolve(resetValue));
        dragRef.current = null;
        longPressRef.current = null;
      }, LONG_PRESS_MS),
    };
  }

  function onDragMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (longPressRef.current) {
      const dx = e.clientX - longPressRef.current.startX;
      const dy = e.clientY - longPressRef.current.startY;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelLongPress();
    }
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY; // up = positive = increase
    if (!clamped) setDragSpinDeg(Math.max(-720, Math.min(720, dy * 3)));
    onChange(resolve(dragRef.current.startValue + Math.round(dy / pixelsPerStep) * step));
  }

  function endDrag() {
    cancelLongPress();
    dragRef.current = null;
    setDragSpinDeg(null);
  }

  function handleContextMenu(e: ReactMouseEvent) {
    e.preventDefault();
    onChange(resolve(resetValue));
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      onChange(resolve(value + step));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(resolve(value - step));
    } else if (e.key === "Home" && clamped) {
      e.preventDefault();
      onChange(min!);
    } else if (e.key === "End" && clamped) {
      e.preventDefault();
      onChange(max!);
    }
  }

  function startEditing() {
    setEditValue(String(value));
    setEditing(true);
  }
  function commitEdit() {
    const parsed = Number(editValue);
    if (Number.isFinite(parsed)) onChange(resolve(parsed));
    setEditing(false);
  }

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const angle = clamped ? -SWEEP_DEG / 2 + ((value - min!) / (max! - min! || 1)) * SWEEP_DEG : (dragSpinDeg ?? 0);
  const display = formatValue ? formatValue(value) : String(Math.round(value * 100) / 100);

  return (
    <div className={`win95-dial${className ? ` ${className}` : ""}`}>
      {label && <span className="win95-dial__label">{label}</span>}
      <div className="win95-dial__row">
        {showNudgeButtons && (
          <button type="button" className="win95-dial__nudge" onClick={() => onChange(resolve(value - step))} title="Decrease">
            −
          </button>
        )}
        <button
          type="button"
          className="win95-dial__face"
          style={{ width: size, height: size }}
          onPointerDown={beginDrag}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onContextMenu={handleContextMenu}
          onKeyDown={handleKeyDown}
          title="Drag up/down to adjust. Right-click (or press and hold) to reset."
        >
          <span className="win95-dial__pointer" style={{ height: size / 2 - 3, transform: `rotate(${angle}deg)` }} />
        </button>
        {showNudgeButtons && (
          <button type="button" className="win95-dial__nudge" onClick={() => onChange(resolve(value + step))} title="Increase">
            +
          </button>
        )}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          className="win95-dial__value-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            else if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <button type="button" className="win95-dial__value" onClick={startEditing} title="Click to type a value">
          {display}
        </button>
      )}
    </div>
  );
}
