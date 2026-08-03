import { useEffect, useMemo, useRef } from "react";
import { demoLoopSegments, lapSeconds, sampleLoop, type DemoSegment } from "./unitMovementPreview";

interface UnitMovementPreviewProps {
  spriteUrl: string | null;
  /** px/sec along the path — 0 holds position. */
  speed: number;
  turnRate: number;
  /** Hitbox radius, world units — drawn to the same scale as the path, so the ring/sprite relationship is honest. */
  size: number;
}

const CANVAS_SIZE = 220;
/** World units across the canvas. Sized to still contain the circuit at the largest `turnRate` the demo handles reach to, so cranking the knob never flies the Unit off the edge. */
const WORLD_VIEW = 340;
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

/** Ghost dots trailing the Unit. Spaced in *time*, not distance, so the trail stretches out on its own as speed climbs — that's the point of it. */
const TRAIL_COUNT = 7;
const TRAIL_STEP_SEC = 0.055;

/** Fallback marker size (px) for a Unit with no sprite chosen yet. */
const MARKER_RADIUS = 9;

interface Frame {
  segments: DemoSegment[];
  speed: number;
  size: number;
}

/**
 * Live animated visualization of a Unit's `speed`/`turnRate`/hitbox `size`
 * — Noah's request for the Stats tab, same rationale as `ActionPreview.tsx`
 * on the Action side: the numbers alone don't tell you what they feel like.
 * The Unit laps a fixed synthetic circuit forever (`unitMovementPreview.ts`)
 * with its nose pointed along the curve, so turning the Speed knob visibly
 * speeds it up (and lengthens its motion trail) while Turn rate bends the
 * circuit's corners from a hard-cornered diamond into wide swooping arcs.
 *
 * Travelled distance is **accumulated per frame** (`distance += speed * dt`)
 * rather than recomputed as `speed * elapsed`. Both look identical at a
 * constant speed, but only the accumulating one keeps the Unit where it is
 * when you drag the Speed dial — the closed-form version teleports it
 * around the loop on every change, which reads as a glitch, not as a
 * speed-up.
 */
export default function UnitMovementPreview({ spriteUrl, speed, turnRate, size }: UnitMovementPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const distanceRef = useRef(0);
  const lastFrameRef = useRef(performance.now());

  const segments = useMemo(() => demoLoopSegments(turnRate), [turnRate]);
  const lap = useMemo(() => lapSeconds(segments, speed), [segments, speed]);

  // The rAF loop is set up once and reads the current values through this
  // ref — restarting it on every dial tick (ActionPreview's approach, fine
  // for a preview with no accumulated state) would reset the animation
  // clock mid-lap here.
  const frameRef = useRef<Frame>({ segments, speed, size });
  frameRef.current = { segments, speed, size };

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
      const dt = Math.min(0.1, (now - lastFrameRef.current) / 1000); // clamped so a backgrounded tab doesn't resume with one huge jump
      lastFrameRef.current = now;
      const state = frameRef.current;
      distanceRef.current += state.speed * dt;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) draw(ctx, state, spriteRef.current, distanceRef.current);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="shmup-unit-motion">
      <canvas ref={canvasRef} className="shmup-unit-motion__canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
      <span className="shmup-unit-motion__caption">{lap === null ? "Speed 0 — holds position" : `${lap.toFixed(1)}s per lap`}</span>
    </div>
  );
}

function toCanvas(x: number, y: number): { x: number; y: number } {
  return { x: ORIGIN + x * SCALE, y: ORIGIN + y * SCALE };
}

function draw(ctx: CanvasRenderingContext2D, { segments, speed, size }: Frame, sprite: HTMLImageElement | null, distance: number) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#180800";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.imageSmoothingEnabled = false;

  // The circuit itself — dashed, dim, the same "reference geometry" treatment ActionPreview gives its arc boundary lines.
  ctx.strokeStyle = "rgba(255, 204, 136, 0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  for (const segment of segments) {
    const p0 = toCanvas(segment.p0.x, segment.p0.y);
    const p1 = toCanvas(segment.p1.x, segment.p1.y);
    const p2 = toCanvas(segment.p2.x, segment.p2.y);
    const p3 = toCanvas(segment.p3.x, segment.p3.y);
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Waypoint markers, so the corners the turn rate is rounding off are visible as corners.
  ctx.fillStyle = "rgba(102, 255, 238, 0.55)";
  for (const segment of segments) {
    const p = toCanvas(segment.p0.x, segment.p0.y);
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }

  // Motion trail — grows with speed, vanishes entirely at a standstill.
  for (let i = TRAIL_COUNT; i >= 1; i--) {
    const behind = sampleLoop(segments, distance - speed * TRAIL_STEP_SEC * i);
    const p = toCanvas(behind.pos.x, behind.pos.y);
    ctx.fillStyle = `rgba(204, 68, 0, ${0.4 * (1 - i / (TRAIL_COUNT + 1))})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const { pos, headingDeg } = sampleLoop(segments, distance);
  const here = toCanvas(pos.x, pos.y);

  // Hitbox ring at true scale against the path — cranking Hitbox size visibly grows it relative to the sprite it sits under.
  ctx.strokeStyle = "rgba(255, 107, 0, 0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(here.x, here.y, Math.max(1.5, size * SCALE), 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(here.x, here.y);
  ctx.rotate(((headingDeg - ART_FACING_DEG) * Math.PI) / 180);
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
