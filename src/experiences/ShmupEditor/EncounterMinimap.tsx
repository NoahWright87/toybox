import { useCallback, useEffect, useRef } from "react";
import type { Vec2 } from "./encounterTypes";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EncounterMinimapProps {
  /** The full extent of the encounter canvas's own stage-local coordinate space (same units EncounterEditor.tsx's `toStage` produces) — the minimap always shows this whole extent, scaled down to fit. */
  stageWidth: number;
  stageHeight: number;
  /** The tile's footprint outline, already in stage-local coordinates. */
  tileRectStage: Rect;
  /** Every step position across every instance, already in stage-local coordinates — rendered as small dots so the overall layout reads at a glance. */
  stepPointsStage: Vec2[];
  pan: Vec2;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  onPan: (pan: Vec2) => void;
}

const MINIMAP_MAX_W = 120;
const MINIMAP_MAX_H = 90;

/**
 * Small overview + click/drag-to-pan navigator (E3 #193 follow-up — the
 * canvas used to rely on native container scrolling, which fought with
 * dragging a unit: the stage's own size was derived from content including
 * whatever was mid-drag, so dragging near an edge could shift the whole
 * coordinate frame under the pointer. `EncounterEditor.tsx` now separates
 * "world content" (stage-local, stable) from "how you're viewing it"
 * (pan/zoom, a CSS transform) — this minimap is the navigation surface for
 * the latter, same pattern as `JigsawPuzzle.tsx`'s minimap, adapted from
 * native `scrollLeft`/`scrollTop` to an explicit `pan` state since this
 * canvas uses a transform instead of native scroll.
 */
export default function EncounterMinimap({ stageWidth, stageHeight, tileRectStage, stepPointsStage, pan, zoom, viewportWidth, viewportHeight, onPan }: EncounterMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);

  const scale = Math.min(MINIMAP_MAX_W / (stageWidth || 1), MINIMAP_MAX_H / (stageHeight || 1));
  const mmW = Math.max(1, Math.round(stageWidth * scale));
  const mmH = Math.max(1, Math.round(stageHeight * scale));

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== mmW || canvas.height !== mmH) {
      canvas.width = mmW;
      canvas.height = mmH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#180800";
    ctx.fillRect(0, 0, mmW, mmH);

    ctx.strokeStyle = "#ffcc88";
    ctx.lineWidth = 1;
    ctx.strokeRect(tileRectStage.x * scale + 0.5, tileRectStage.y * scale + 0.5, Math.max(1, tileRectStage.width * scale - 1), Math.max(1, tileRectStage.height * scale - 1));

    ctx.fillStyle = "rgba(255, 187, 51, 0.85)";
    for (const p of stepPointsStage) {
      ctx.fillRect(p.x * scale - 1, p.y * scale - 1, 2, 2);
    }

    ctx.strokeStyle = "#ff6b00";
    ctx.lineWidth = 1.5;
    ctx.strokeRect((-pan.x / zoom) * scale + 0.5, (-pan.y / zoom) * scale + 0.5, Math.max(2, (viewportWidth / zoom) * scale - 1), Math.max(2, (viewportHeight / zoom) * scale - 1));
  }, [mmW, mmH, scale, tileRectStage, stepPointsStage, pan, zoom, viewportWidth, viewportHeight]);

  useEffect(() => render(), [render]);

  function panToMinimapPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;
    const rect = canvas.getBoundingClientRect();
    const stageX = ((clientX - rect.left) / rect.width) * mmW / scale;
    const stageY = ((clientY - rect.top) / rect.height) * mmH / scale;
    onPan({ x: viewportWidth / 2 - stageX * zoom, y: viewportHeight / 2 - stageY * zoom });
  }

  return (
    <canvas
      ref={canvasRef}
      className="shmup-minimap"
      title="Mini-map — click or drag to pan"
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as Element).setPointerCapture(e.pointerId);
        draggingRef.current = true;
        panToMinimapPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        panToMinimapPoint(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    />
  );
}
