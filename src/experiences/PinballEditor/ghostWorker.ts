import * as Matter from "matter-js";
import type { Board } from "../Pinball/boardTypes";
import { sampleRailCenterline, RAIL_WALL_OFFSET, RAIL_WALL_THICK } from "../Pinball/railUtils";

// ── Constants (must match Pinball.tsx) ────────────────────────────────────────

const BALL_R = 10;
const DT = 1000 / 60;
const SUBSTEPS = 2;
const SUB_DT = DT / SUBSTEPS;
const GRAVITY = 1.2;
const SPAWN_INTERVAL_TICKS = 30; // ~500 ms at 60 fps

const FLIPPER_REST_L = 0.5;
const FLIPPER_UP_L = -0.45;
const FLIPPER_REST_R = -0.5;
const FLIPPER_UP_R = 0.45;
const FLIPPER_SPEED = 18;
const LAUNCH_MAX_VY = 35;

const CAT_BALL = 0x0001;
const CAT_STATIC = 0x0002;

// ── State ─────────────────────────────────────────────────────────────────────

interface GhostFlipper {
  body: Matter.Body;
  side: "left" | "right";
  pivotX: number;
  pivotY: number;
  length: number;
  angle: number;
  restAngle: number;
  upAngle: number;
  isUp: boolean;
  nextChangeTick: number;
}

interface ActiveBall {
  id: number;
  body: Matter.Body;
  prevX: number;
  prevY: number;
}

let engine: Matter.Engine | null = null;
let board: Board | null = null;
let ghostFlippers: GhostFlipper[] = [];
let activeBalls: ActiveBall[] = [];
let nextBallId = 0;
let tick = 0;
let lastSpawnTick = -9999;

let targetKind = "";
let targetCx = 0;
let targetCy = 0;

let intervalId: ReturnType<typeof setInterval> | null = null;

// ── Flipper helpers ───────────────────────────────────────────────────────────

function placeFlipper(f: GhostFlipper) {
  const cx = f.side === "left"
    ? f.pivotX + (f.length / 2) * Math.cos(f.angle)
    : f.pivotX - (f.length / 2) * Math.cos(f.angle);
  const cy = f.pivotY + (f.length / 2) * Math.sin(f.angle);
  Matter.Body.setPosition(f.body, { x: cx, y: cy });
  Matter.Body.setAngle(f.body, f.angle);
}

// ── World setup ───────────────────────────────────────────────────────────────

function buildWorld(b: Board) {
  if (engine) Matter.Engine.clear(engine);
  engine = Matter.Engine.create({ gravity: { x: 0, y: GRAVITY } });
  board = b;
  ghostFlippers = [];
  activeBalls = [];
  tick = 0;
  lastSpawnTick = -9999;

  const W = b.width, H = b.height;
  const sOpts = {
    isStatic: true,
    restitution: 0.4,
    friction: 0.1,
    collisionFilter: { category: CAT_STATIC, mask: CAT_BALL },
  };

  // Boundary — no bottom wall so balls drain out
  Matter.Composite.add(engine.world, [
    Matter.Bodies.rectangle(W / 2, -6, W + 24, 12, sOpts),
    Matter.Bodies.rectangle(-6, H / 2, 12, H, sOpts),
    Matter.Bodies.rectangle(W + 6, H / 2, 12, H, sOpts),
  ]);

  for (const w of b.walls)
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(w.x, w.y, w.w, w.h, { ...sOpts, angle: w.angle ?? 0 }));
  for (const bmp of b.bumpers)
    Matter.Composite.add(engine.world, Matter.Bodies.circle(bmp.x, bmp.y, bmp.r, { ...sOpts, restitution: 1.5, friction: 0 }));
  for (const p of b.posts)
    Matter.Composite.add(engine.world, Matter.Bodies.circle(p.x, p.y, p.r, { ...sOpts, restitution: 0.6, friction: 0.05 }));
  for (const s of b.slingshots)
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, { ...sOpts, angle: s.angle ?? 0, restitution: 1.2, friction: 0 }));
  for (const t of b.targets)
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(t.x, t.y, t.w, t.h, { ...sOpts, angle: t.angle ?? 0, restitution: 0.6, friction: 0 }));

  // Rails
  for (const rail of b.rails ?? []) {
    const samples = sampleRailCenterline(rail.points);
    for (let i = 0; i < samples.length - 1; i++) {
      const s0 = samples[i], s1 = samples[i + 1];
      const cx = (s0.x + s1.x) / 2, cy = (s0.y + s1.y) / 2;
      const segLen = Math.hypot(s1.x - s0.x, s1.y - s0.y) + 1;
      const angle = Math.atan2(s1.y - s0.y, s1.x - s0.x);
      const nx = -Math.sin(angle), ny = Math.cos(angle);
      for (const side of [-1, 1]) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.rectangle(
            cx + nx * side * RAIL_WALL_OFFSET,
            cy + ny * side * RAIL_WALL_OFFSET,
            segLen, RAIL_WALL_THICK,
            { ...sOpts, angle, restitution: 0.3, friction: 0.05 }
          )
        );
      }
    }
  }

  // Plunger lane divider
  const pl = b.plunger;
  Matter.Composite.add(engine.world,
    Matter.Bodies.rectangle(pl.x - BALL_R - 6, (pl.topY + pl.bottomY) / 2, 8, pl.bottomY - pl.topY, sOpts)
  );

  // Kinematic flippers — randomly activate during simulation
  for (const f of b.flippers) {
    const restAngle = f.side === "left" ? FLIPPER_REST_L : FLIPPER_REST_R;
    const upAngle   = f.side === "left" ? FLIPPER_UP_L   : FLIPPER_UP_R;
    const cx = f.side === "left"
      ? f.pivotX + (f.length / 2) * Math.cos(restAngle)
      : f.pivotX - (f.length / 2) * Math.cos(restAngle);
    const cy = f.pivotY + (f.length / 2) * Math.sin(restAngle);
    const body = Matter.Bodies.rectangle(cx, cy, f.length, 8, {
      isStatic: true,
      restitution: 0.3,
      friction: 0.05,
      angle: restAngle,
      collisionFilter: { category: CAT_STATIC, mask: CAT_BALL },
    });
    Matter.Composite.add(engine.world, body);
    ghostFlippers.push({
      body, side: f.side,
      pivotX: f.pivotX, pivotY: f.pivotY,
      length: f.length,
      angle: restAngle, restAngle, upAngle,
      isUp: false,
      // stagger initial flips so both flippers don't move in sync
      nextChangeTick: 10 + Math.floor(Math.random() * 40),
    });
  }
}

// ── Spawn a single ghost ball ─────────────────────────────────────────────────

function spawnBall() {
  if (!engine || !board || targetKind === "") return;

  const bOpts = {
    restitution: 0.5, friction: 0.01, frictionAir: 0.008, density: 0.005,
    collisionFilter: { category: CAT_BALL, mask: CAT_STATIC },
  };
  const W = board.width, H = board.height;

  if (targetKind === "plunger") {
    const charge = 0.3 + Math.random() * 0.7; // 30–100 %
    const vy = -(charge * LAUNCH_MAX_VY * (board.plunger.launchPower ?? 1.0) + 4);
    const body = Matter.Bodies.circle(board.ballStartX, board.ballStartY, BALL_R, bOpts);
    Matter.Body.setVelocity(body, { x: 0, y: vy });
    Matter.Composite.add(engine.world, body);
    activeBalls.push({ id: nextBallId++, body, prevX: board.ballStartX, prevY: board.ballStartY });
  } else {
    const angle = Math.random() * Math.PI * 2;
    const bx = targetCx + 180 * Math.cos(angle);
    const by = targetCy + 180 * Math.sin(angle);
    if (bx < -BALL_R || bx > W + BALL_R || by < -BALL_R * 3 || by > H + BALL_R) return;
    const speed = 8 + Math.random() * 17;
    const baseAngle = Math.atan2(targetCy - by, targetCx - bx);
    const spread = (Math.random() - 0.5) * 0.3;
    const body = Matter.Bodies.circle(bx, by, BALL_R, bOpts);
    Matter.Body.setVelocity(body, { x: Math.cos(baseAngle + spread) * speed, y: Math.sin(baseAngle + spread) * speed });
    Matter.Composite.add(engine.world, body);
    activeBalls.push({ id: nextBallId++, body, prevX: bx, prevY: by });
  }
}

// ── Simulation tick ───────────────────────────────────────────────────────────

function step() {
  if (!engine || !board) return;
  tick++;

  // Animate flippers randomly
  for (const f of ghostFlippers) {
    if (tick >= f.nextChangeTick) {
      if (f.isUp) {
        f.isUp = false;
        // Wait 300–1300 ms before flipping again
        f.nextChangeTick = tick + 18 + Math.floor(Math.random() * 60);
      } else {
        f.isUp = true;
        // Hold up 167–417 ms
        f.nextChangeTick = tick + 10 + Math.floor(Math.random() * 15);
      }
    }
    const target = f.isUp ? f.upAngle : f.restAngle;
    const diff = target - f.angle;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), FLIPPER_SPEED / 60);
    f.angle += step;
    placeFlipper(f);
  }

  // Spawn a new ball every ~500 ms
  if (targetKind !== "" && tick - lastSpawnTick >= SPAWN_INTERVAL_TICKS) {
    spawnBall();
    lastSpawnTick = tick;
  }

  // Step physics (2 substeps for better collision accuracy)
  for (let i = 0; i < SUBSTEPS; i++) Matter.Engine.update(engine, SUB_DT);

  // Collect trail segments and cull dead balls
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const W = board.width, H = board.height;
  const dead: ActiveBall[] = [];

  for (const ball of activeBalls) {
    const pos = ball.body.position;
    segments.push({ x1: ball.prevX, y1: ball.prevY, x2: pos.x, y2: pos.y });
    ball.prevX = pos.x;
    ball.prevY = pos.y;
    if (pos.y > H + BALL_R || pos.x < -BALL_R * 2 || pos.x > W + BALL_R * 2) {
      dead.push(ball);
    }
  }

  if (segments.length > 0) {
    self.postMessage({ type: "segments", segments });
  }

  for (const ball of dead) {
    Matter.Composite.remove(engine.world, ball.body);
    activeBalls.splice(activeBalls.indexOf(ball), 1);
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: "setup"; board: Board }
    | { type: "setTarget"; kind: string; cx: number; cy: number }
    | { type: "clearBalls" }
    | { type: "stop" };

  switch (msg.type) {
    case "setup":
      buildWorld(msg.board);
      if (intervalId === null) {
        intervalId = setInterval(step, DT);
      }
      break;

    case "setTarget":
      targetKind = msg.kind;
      targetCx = msg.cx;
      targetCy = msg.cy;
      break;

    case "clearBalls":
      if (engine) for (const b of activeBalls) Matter.Composite.remove(engine.world, b.body);
      activeBalls = [];
      break;

    case "stop":
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
      if (engine) for (const b of activeBalls) Matter.Composite.remove(engine.world, b.body);
      activeBalls = [];
      break;
  }
};
