import React, { useRef } from "react";
import "./ResizeHandles.css";

type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface ResizeHandlesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (pos: { x: number; y: number }, size: { width: number; height: number }) => void;
  minWidth?: number;
  minHeight?: number;
  disabled?: boolean;
}

const DIRECTIONS: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

export default function ResizeHandles({
  containerRef,
  onResize,
  minWidth = 200,
  minHeight = 150,
  disabled = false,
}: ResizeHandlesProps) {
  const startRef = useRef<{
    pointerX: number;
    pointerY: number;
    pos: { x: number; y: number };
    size: { width: number; height: number };
    dir: Direction;
  } | null>(null);

  function handlePointerDown(e: React.PointerEvent, dir: Direction) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const parentEl = el.offsetParent as HTMLElement | null;
    const parentRect = parentEl ? parentEl.getBoundingClientRect() : { left: 0, top: 0 };

    startRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      pos: { x: rect.left - parentRect.left, y: rect.top - parentRect.top },
      size: { width: rect.width, height: rect.height },
      dir,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;

    const { pointerX, pointerY, pos, size, dir } = startRef.current;
    const dx = e.clientX - pointerX;
    const dy = e.clientY - pointerY;

    const hasN = dir === "n" || dir === "ne" || dir === "nw";
    const hasS = dir === "s" || dir === "se" || dir === "sw";
    const hasE = dir === "e" || dir === "ne" || dir === "se";
    const hasW = dir === "w" || dir === "nw" || dir === "sw";

    let newX = pos.x;
    let newY = pos.y;
    let newW = size.width;
    let newH = size.height;

    if (hasE) newW = Math.max(minWidth, size.width + dx);
    if (hasS) newH = Math.max(minHeight, size.height + dy);
    if (hasW) {
      const w = Math.max(minWidth, size.width - dx);
      newX = pos.x + size.width - w;
      newW = w;
    }
    if (hasN) {
      const h = Math.max(minHeight, size.height - dy);
      newY = pos.y + size.height - h;
      newH = h;
    }

    onResize({ x: newX, y: newY }, { width: newW, height: newH });
  }

  function handlePointerUp() {
    startRef.current = null;
  }

  if (disabled) return null;

  return (
    <div
      className="resize-handles"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {DIRECTIONS.map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-handle--${dir}`}
          onPointerDown={(e) => handlePointerDown(e, dir)}
        />
      ))}
    </div>
  );
}
