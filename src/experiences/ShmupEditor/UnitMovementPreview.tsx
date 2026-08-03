import { useEffect, useMemo, useRef } from "react";
import { buildDemoLap, sampleDemoLap, type DemoLap } from "./unitMovementPreview";

interface UnitMovementPreviewProps {
  spriteUrl: string | null;
  /** px/sec ceiling along the path. */
  speed: number;
  /** px/sec floor — 0 means it can stop, and therefore pivot. */
  minSpeed: number;
  turnRateDegPerSec: number;
  /** Hitbox radius, world units — drawn to the same scale as the path, so the ring/sprite relationship is honest. */
  size: number;
}

const CANVAS_SIZE = 220;
/** World units across the canvas. Sized to hold the demo circuit (±150) plus the widest swing any seeded Unit takes through the hairpin, with margin so even a battleship's loop doesn't graze the frame — a jet reaches ~245 out from centre, against this view's 290. */
const WORLD_VIEW = 580;
const SCALE = CANVAS_SIZE / WORLD_VIEW;
const ORIGIN = CANVAS_SIZE / 2;

/**
 * Mirrors games/shmup's `TUNING.encounters.artToHitboxRatio` (3) — the game
 * derives a Unit's display size from its authored hitbox radius, since
 * `size` is the only authored number that says how big a thing is. Copied
 * rather than imported: `spriteScale.ts` pulls in the whole `TUNING` object,
 * which is game-only (see `editorScale.ts` on why `scrollModel.ts` is the
 * single exception to the no-shared-code stance).
 */
const ART_TO_HITBOX = 3;
/** Mirrors games/shmup's `ART_FACING_DEG` — the enemy art is drawn nose-up, while every angle here is 0 = +x/right, 90 = +y/down. */
const ART_FACING_DEG = -90;

/** Ghost dots trailing the Unit. Spaced in *time*, so the trail stretches out on its own as speed climbs and collapses to nothing during a pivot. */
const TRAIL_COUNT = 7;
const TRAIL_STEP_SEC = 0.055;

/** Fallback marker size (px) for a Unit with no sprite chosen yet. */
const MARKER_RADIUS = 9;

/**
 * Live animated visualization of how a Unit *handles* — Noah's request for
 * the Stats tab, same rationale as `ActionPreview.tsx` on the Action side.
 *
 * It flies the Unit around a fixed demo circuit solved by the very same
 * `pathSolver.ts` an encounter uses (`unitMovementPreview.ts`), so this
 * isn't an illustration of the stats, it's a rehearsal of them: a tank
 * drives the circuit's legs straight and visibly stops to rotate at each
 * corner, while a jet swings wide through the corners it can't turn on the
 * spot. Tuning Min speed from 0 to anything above it switches the Unit
 * between those two behaviors on screen, which is the fastest way to
 * understand what the stat does.
 *
 * The circuit deliberately mixes turn difficulties — a 180 at the far end
 * of the diagonal, two 135s, three 90s, and long straights between them
 * (`unitMovementPreview.ts`) — so a Unit that takes a gentle bend happily
 * but wallows through a hairpin looks different from one that doesn't.
 *
 * The dashed ring is the Unit's own turning circle (`minTurnRadius`) — the
 * tightest curve it can hold, drawn to the same scale as the path, so
 * "this thing corners like a battleship" is a thing you can see rather
 * than infer.
 */
export default function UnitMovementPreview({ spriteUrl, speed, minSpeed, turnRateDegPerSec, size }: UnitMovementPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const clockRef = useRef(0);
  const lastFrameRef = useRef(performance.now());

  const lap = useMemo(() => buildDemoLap({ speed, minSpeed, turnRateDegPerSec }), [speed, minSpeed, turnRateDegPerSec]);

  // The rAF loop is set up once and reads the current lap through this ref;
  // restarting it on every dial tick would reset the animation mid-circuit.
  const lapRef = useRef<DemoLap>(lap);
  lapRef.current = lap;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    if (!spriteUrl) {
      spriteRef.current = null;
      return;
    }
    const img = new Image();
    img.src = spriteUrl;
    spriteRef.current = img;
  }, [spriteUrl]);

  useEffect(() => {
    let raf: number;
    lastFrameRef.current = performance.now();
    function frame(now: number) {
      // Clamped so a backgrounded tab doesn't resume with one huge jump.
      clockRef.current += Math.min(0.1, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) draw(ctx, lapRef.current, sizeRef.current, spriteRef.current, clockRef.current);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="shmup-unit-motion">
      <canvas ref={canvasRef} className="shmup-unit-motion__canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
      <span className="shmup-unit-motion__caption">{caption(lap, speed)}</span>
    </div>
  );
}

function caption(lap: DemoLap, speed: number): string {
  if (speed <= 0) return "Speed 0 — holds position, turns on the spot";
  const lapTime = `${lap.totalSec.toFixed(1)}s per lap`;
  if (lap.pivots) {
    // The circuit's corners are deliberately not all equal, so quote the
    // worst of them — the 180 — rather than implying one flat rate.
    const worst = Math.max(...lap.legs.map((leg) => leg.pivotSec), 0);
    return `${lapTime} · pivots corners (up to ${worst.toFixed(1)}s)`;
  }
  return `${lapTime} · turns no tighter than ${Math.round(lap.minTurnRadius)}`;
}

function toCanvas(x: number, y: number): { x: number; y: number } {
  return { x: ORIGIN + x * SCALE, y: ORIGIN + y * SCALE };
}

function draw(ctx: CanvasRenderingContext2D, lap: DemoLap, size: number, sprite: HTMLImageElement | null, clock: number) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#180800";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.imageSmoothingEnabled = false;

  const now = sampleDemoLap(lap, clock);
  const here = toCanvas(now.pos.x, now.pos.y);

  // The Unit's own turning circle, parked against its current position so it
  // reads as "this is the tightest turn it could make from right here".
  if (lap.minTurnRadius > 0) {
    // Deliberately a different colour *and* a different dash rhythm to the
    // path below — at this size two similar dashed circles read as one shape.
    ctx.strokeStyle = "rgba(167, 116, 240, 0.65)";
    ctx.setLineDash([1, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(here.x, here.y, lap.minTurnRadius * SCALE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The solved circuit — the path this Unit can actually fly through the waypoints.
  ctx.strokeStyle = "rgba(255, 204, 136, 0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  for (const { segment } of lap.legs) {
    const p0 = toCanvas(segment.p0.x, segment.p0.y);
    const p1 = toCanvas(segment.p1.x, segment.p1.y);
    const p2 = toCanvas(segment.p2.x, segment.p2.y);
    const p3 = toCanvas(segment.p3.x, segment.p3.y);
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // The authored waypoints themselves — the fixed points every version of the path has to pass through.
  ctx.fillStyle = "rgba(102, 255, 238, 0.6)";
  for (const { segment } of lap.legs) {
    const p = toCanvas(segment.p0.x, segment.p0.y);
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }

  // Motion trail — long at speed, gone entirely while pivoting.
  for (let i = TRAIL_COUNT; i >= 1; i--) {
    const behind = sampleDemoLap(lap, clock - TRAIL_STEP_SEC * i);
    const p = toCanvas(behind.pos.x, behind.pos.y);
    ctx.fillStyle = `rgba(204, 68, 0, ${0.4 * (1 - i / (TRAIL_COUNT + 1))})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hitbox ring at true scale against the path.
  ctx.strokeStyle = "rgba(255, 107, 0, 0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(here.x, here.y, Math.max(1.5, size * SCALE), 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(here.x, here.y);
  ctx.rotate(((now.headingDeg - ART_FACING_DEG) * Math.PI) / 180);
  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const box = Math.max(8, size * ART_TO_HITBOX * SCALE);
    ctx.drawImage(sprite, -box / 2, -box / 2, box, box);
  } else {
    // No sprite chosen yet — a plain arrowhead still shows position and facing.
    ctx.fillStyle = "#cc4400";
    ctx.strokeStyle = "#ffcc88";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -MARKER_RADIUS);
    ctx.lineTo(MARKER_RADIUS * 0.7, MARKER_RADIUS * 0.8);
    ctx.lineTo(0, MARKER_RADIUS * 0.4);
    ctx.lineTo(-MARKER_RADIUS * 0.7, MARKER_RADIUS * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
