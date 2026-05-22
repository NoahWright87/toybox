import { useEffect, useRef, useCallback, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./Pinball.css";

interface Props {
  onQuit?: () => void;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const W = 320;
const H = 560;
const WALL = 12;
const FLIPPER_Y = H - 60;        // 500
const FLIPPER_LEN = 52;
const FLIPPER_THICK = 7;
const LEFT_FLIPPER_X  = 100;
const RIGHT_FLIPPER_X = 220;
const PLUNGER_X = W - WALL - 6;  // 302 — visual plunger only
const DRAIN_Y = H - 20;          // 540
const SLING_THICK = 5;

// ── Launch channel ────────────────────────────────────────────────────────────
// The right edge of the main playfield. Ball travels up this channel to the top.
const CHANNEL_X   = 284;  // left wall of the launch channel
const CHANNEL_TOP = 55;   // above this y the channel opens into the field
// Two mid-channel exits the ball can drop through on a partial launch
const EXIT1_TOP = 225;
const EXIT1_BOT = 262;
const EXIT2_TOP = 345;
const EXIT2_BOT = 388;

// ── Physics constants ─────────────────────────────────────────────────────────
const GRAVITY      = 0.15;
const BALL_R       = 7;
const FLIPPER_POWER = 11;
const BUMPER_BOUNCE = 1.2;
const SPEED_CAP    = 12;

// ── Colors ────────────────────────────────────────────────────────────────────
const COL_BG         = "#0a0018";
const COL_WALL       = "#5b2d8e";
const COL_FLIPPER    = "#cc4400";
const COL_BUMPER     = "#ff6b00";
const COL_BUMPER_LIT = "#ffff00";
const COL_SLING      = "#cc4400";
const COL_SLING_LIT  = "#ffff00";
const COL_LANE       = "#5b2d8e";
const COL_LANE_LIT   = "#ff6b00";
const COL_SCORE      = "#ff6b00";
const COL_PLUNGER    = "#808080";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Bumper {
  x: number;
  y: number;
  r: number;
  lit: number;
  value: number;
}

interface Slingshot {
  x1: number; y1: number;
  x2: number; y2: number;
  lit: number;
  value: number;
}

interface Lane {
  x: number;
  y: number;
  w: number;
  h: number;
  lit: boolean;
  value: number;
}

interface Flipper {
  cx: number;
  cy: number;
  dir: 1 | -1;
  angle: number;
  targetAngle: number;
  restAngle: number;
  upAngle: number;
}

interface GameState {
  ball: Ball | null;
  flippers: [Flipper, Flipper];
  bumpers: Bumper[];
  slingshots: Slingshot[];
  lanes: Lane[];
  score: number;
  lives: number;
  phase: "idle" | "launch" | "play" | "lost-ball" | "game-over";
  plungerCharge: number;
  hiScore: number;
  bonusMultiplier: number;
  tilt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inChannelGap(y: number): boolean {
  return (y > EXIT1_TOP - BALL_R && y < EXIT1_BOT + BALL_R) ||
         (y > EXIT2_TOP - BALL_R && y < EXIT2_BOT + BALL_R);
}

function makeBumpers(): Bumper[] {
  return [
    // upper cluster (all left of CHANNEL_X)
    { x: 108, y: 135, r: 15, lit: 0, value: 100 },
    { x: 188, y: 128, r: 15, lit: 0, value: 100 },
    { x: 150, y: 192, r: 15, lit: 0, value: 100 },
    // mid row
    { x: 75,  y: 255, r: 12, lit: 0, value: 75  },
    { x: 220, y: 255, r: 12, lit: 0, value: 75  },
    { x: 150, y: 312, r: 12, lit: 0, value: 75  },
    // lower row
    { x: 108, y: 368, r: 10, lit: 0, value: 50  },
    { x: 192, y: 368, r: 10, lit: 0, value: 50  },
    // side guide posts
    { x: 50,  y: 192, r:  7, lit: 0, value: 25  },
    { x: 240, y: 195, r:  7, lit: 0, value: 25  },
  ];
}

function makeSlingshots(): Slingshot[] {
  return [
    // left slingshot
    { x1: WALL + 6,          y1: FLIPPER_Y - 105,
      x2: LEFT_FLIPPER_X - 10, y2: FLIPPER_Y - 10, lit: 0, value: 30 },
    // right slingshot — inside the main field, well left of the channel
    { x1: CHANNEL_X - 22,    y1: FLIPPER_Y - 105,
      x2: RIGHT_FLIPPER_X + 10, y2: FLIPPER_Y - 10, lit: 0, value: 30 },
  ];
}

function makeLanes(): Lane[] {
  return [80, 140, 200].map((x, i) => ({
    x, y: 80, w: 20, h: 8, lit: false, value: 500 * (i + 1),
  }));
}

function makeFlippers(): [Flipper, Flipper] {
  return [
    { cx: LEFT_FLIPPER_X,  cy: FLIPPER_Y, dir:  1,
      angle: 0.5,          targetAngle: 0.5,       restAngle: 0.5,       upAngle: -0.45 },
    { cx: RIGHT_FLIPPER_X, cy: FLIPPER_Y, dir: -1,
      angle: Math.PI-0.5,  targetAngle: Math.PI-0.5, restAngle: Math.PI-0.5, upAngle: Math.PI+0.45 },
  ];
}

function makeInitialState(hiScore: number): GameState {
  return {
    ball: null,
    flippers: makeFlippers(),
    bumpers: makeBumpers(),
    slingshots: makeSlingshots(),
    lanes: makeLanes(),
    score: 0,
    lives: 3,
    phase: "idle",
    plungerCharge: 0,
    hiScore,
    bonusMultiplier: 1,
    tilt: 0,
  };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
function closestPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): [number, number] {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return [ax, ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return [ax + t * dx, ay + t * dy];
}

function reflectVelocity(
  vx: number, vy: number,
  nx: number, ny: number,
  restitution: number
): [number, number] {
  const dot = vx * nx + vy * ny;
  return [vx - (1 + restitution) * dot * nx, vy - (1 + restitution) * dot * ny];
}

// ── Draw helpers ──────────────────────────────────────────────────────────────
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Pinball({ onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<GameState>(makeInitialState(0));
  const keysRef   = useRef({ left: false, right: false, space: false });
  const rafRef    = useRef<number>(0);
  const divRef    = useRef<HTMLDivElement>(null);

  const getHiScore = () => {
    try { return parseInt(localStorage.getItem("pinball_hi") ?? "0", 10) || 0; } catch { return 0; }
  };
  const saveHiScore = (s: number) => {
    try { localStorage.setItem("pinball_hi", String(s)); } catch { /* ignore */ }
  };

  const resetGame = useCallback(() => {
    stateRef.current = makeInitialState(getHiScore());
    divRef.current?.focus();
  }, []);

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "Game",
      items: [
        { label: "New Game", onClick: () => resetGame() },
        { separator: true },
        { label: "Quit", onClick: () => onQuit?.() },
      ],
    },
  ], [resetGame, onQuit]);
  useWindowMenus(menus);

  // ── Game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    stateRef.current.hiScore = getHiScore();

    function flipperEndpoint(f: Flipper): [number, number] {
      return [f.cx + Math.cos(f.angle) * FLIPPER_LEN, f.cy + Math.sin(f.angle) * FLIPPER_LEN];
    }

    function collideBallFlipper(ball: Ball, f: Flipper) {
      const [ex, ey] = flipperEndpoint(f);
      const [cx, cy] = closestPointOnSegment(ball.x, ball.y, f.cx, f.cy, ex, ey);
      const dx = ball.x - cx, dy = ball.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BALL_R + FLIPPER_THICK) {
        const nx = dx / dist, ny = dy / dist;
        ball.x = cx + nx * (BALL_R + FLIPPER_THICK + 0.5);
        ball.y = cy + ny * (BALL_R + FLIPPER_THICK + 0.5);
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const [rvx, rvy] = reflectVelocity(ball.vx, ball.vy, nx, ny, 0.6);
        const isMovingUp = f.angle !== f.targetAngle && f.targetAngle === f.upAngle;
        const boost = isMovingUp ? FLIPPER_POWER : Math.max(speed, 4);
        const mag = Math.sqrt(rvx * rvx + rvy * rvy) || 1;
        ball.vx = (rvx / mag) * boost;
        ball.vy = (rvy / mag) * boost;
      }
    }

    function collideBallSlingshot(ball: Ball, sl: Slingshot, gs: GameState) {
      const [cx, cy] = closestPointOnSegment(ball.x, ball.y, sl.x1, sl.y1, sl.x2, sl.y2);
      const dx = ball.x - cx, dy = ball.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BALL_R + SLING_THICK && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        ball.x = cx + nx * (BALL_R + SLING_THICK + 0.5);
        ball.y = cy + ny * (BALL_R + SLING_THICK + 0.5);
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const [rvx, rvy] = reflectVelocity(ball.vx, ball.vy, nx, ny, 0.7);
        const mag = Math.sqrt(rvx * rvx + rvy * rvy) || 1;
        ball.vx = (rvx / mag) * Math.max(speed, 5) * 1.2;
        ball.vy = (rvy / mag) * Math.max(speed, 5) * 1.2;
        sl.lit = 14;
        gs.score += sl.value * gs.bonusMultiplier;
      }
    }

    function update(gs: GameState) {
      const keys = keysRef.current;
      const [lf, rf] = gs.flippers;

      const FLIP_SPEED = 0.22;
      lf.targetAngle = keys.left  ? lf.upAngle : lf.restAngle;
      rf.targetAngle = keys.right ? rf.upAngle : rf.restAngle;
      for (const f of [lf, rf]) {
        if (Math.abs(f.angle - f.targetAngle) < FLIP_SPEED) f.angle = f.targetAngle;
        else f.angle += Math.sign(f.targetAngle - f.angle) * FLIP_SPEED;
      }

      if (gs.phase === "idle") {
        if (keys.space) { gs.phase = "launch"; gs.plungerCharge = 0; }
        return;
      }
      if (gs.phase === "launch") {
        gs.plungerCharge = Math.min(1, gs.plungerCharge + 0.025);
        if (!keys.space) {
          // Ball enters the channel just left of the right wall
          const speed = 4 + gs.plungerCharge * 9;
          gs.ball = { x: CHANNEL_X + BALL_R + 4, y: FLIPPER_Y - 20, vx: -0.3, vy: -speed };
          gs.phase = "play";
          gs.plungerCharge = 0;
        }
        return;
      }
      if (gs.phase === "lost-ball") { gs.phase = "idle"; return; }
      if (gs.phase === "game-over" || !gs.ball) return;

      const b = gs.ball;
      b.vy += GRAVITY;
      b.x  += b.vx;
      b.y  += b.vy;

      // ── Left wall ──────────────────────────────────────────────────────────
      if (b.x - BALL_R < WALL) {
        b.x = WALL + BALL_R;
        b.vx = Math.abs(b.vx) * 0.6;
      }

      // ── Right wall (applies everywhere — inside channel and main field) ────
      if (b.x + BALL_R > W - WALL) {
        b.x = W - WALL - BALL_R;
        b.vx = -Math.abs(b.vx) * 0.6;
      }

      // ── Top wall ───────────────────────────────────────────────────────────
      if (b.y - BALL_R < WALL) {
        b.y = WALL + BALL_R;
        b.vy = Math.abs(b.vy) * 0.55;
      }

      // ── Launch channel divider ─────────────────────────────────────────────
      // Below CHANNEL_TOP the divider is solid except at the two exit gaps.
      if (b.y > CHANNEL_TOP && !inChannelGap(b.y)) {
        if (b.x > CHANNEL_X && b.x - BALL_R < CHANNEL_X) {
          // Ball in channel trying to pass left through solid wall → bounce right
          b.x = CHANNEL_X + BALL_R + 0.5;
          b.vx = Math.abs(b.vx) * 0.55;
        } else if (b.x <= CHANNEL_X && b.x + BALL_R > CHANNEL_X) {
          // Ball in main field trying to pass right into channel → bounce left
          b.x = CHANNEL_X - BALL_R - 0.5;
          b.vx = -Math.abs(b.vx) * 0.55;
        }
      }

      // ── Arch: kick ball left when it crests the channel top ───────────────
      // This redirects a full-power launch into the main field smoothly.
      if (b.x > CHANNEL_X && b.y < CHANNEL_TOP + 24) {
        b.vx = Math.min(b.vx, -2.5);
      }

      // ── Bumpers ────────────────────────────────────────────────────────────
      for (const bump of gs.bumpers) {
        const dx = b.x - bump.x, dy = b.y - bump.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BALL_R + bump.r) {
          const nx = dx / dist, ny = dy / dist;
          b.x = bump.x + nx * (BALL_R + bump.r + 1);
          b.y = bump.y + ny * (BALL_R + bump.r + 1);
          const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          b.vx = nx * Math.max(speed, 4) * BUMPER_BOUNCE;
          b.vy = ny * Math.max(speed, 4) * BUMPER_BOUNCE;
          bump.lit = 12;
          gs.score += bump.value * gs.bonusMultiplier;
        }
        if (bump.lit > 0) bump.lit--;
      }

      // ── Slingshots ─────────────────────────────────────────────────────────
      for (const sl of gs.slingshots) {
        collideBallSlingshot(b, sl, gs);
        if (sl.lit > 0) sl.lit--;
      }

      // ── Lane targets ───────────────────────────────────────────────────────
      for (const lane of gs.lanes) {
        if (!lane.lit &&
          b.x > lane.x && b.x < lane.x + lane.w &&
          b.y - BALL_R < lane.y + lane.h && b.y + BALL_R > lane.y) {
          lane.lit = true;
          gs.score += lane.value * gs.bonusMultiplier;
          b.vy = Math.abs(b.vy) * 0.55;
          if (gs.lanes.every((l) => l.lit)) {
            gs.bonusMultiplier++;
            gs.lanes.forEach((l) => { l.lit = false; });
          }
        }
      }

      // ── Flippers ───────────────────────────────────────────────────────────
      collideBallFlipper(b, lf);
      collideBallFlipper(b, rf);

      // ── Drain ──────────────────────────────────────────────────────────────
      if (b.y > DRAIN_Y) {
        gs.ball = null;
        gs.lives--;
        if (gs.lives <= 0) {
          gs.phase = "game-over";
          if (gs.score > gs.hiScore) { gs.hiScore = gs.score; saveHiScore(gs.score); }
        } else {
          gs.phase = "lost-ball";
          gs.bumpers    = makeBumpers();
          gs.slingshots = makeSlingshots();
          gs.flippers   = makeFlippers();
        }
      }

      // ── Speed cap ──────────────────────────────────────────────────────────
      const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (spd > SPEED_CAP) { b.vx = (b.vx / spd) * SPEED_CAP; b.vy = (b.vy / spd) * SPEED_CAP; }
    }

    // ── Draw ─────────────────────────────────────────────────────────────────
    function draw(gs: GameState) {
      ctx.fillStyle = COL_BG;
      ctx.fillRect(0, 0, W, H);

      // Outer walls
      ctx.fillStyle = COL_WALL;
      ctx.fillRect(0, 0, WALL, H);
      ctx.fillRect(W - WALL, 0, WALL, H);
      ctx.fillRect(0, 0, W, WALL);

      // Launch channel divider — drawn as segments with visible gaps
      ctx.fillStyle = COL_WALL;
      ctx.fillRect(CHANNEL_X, CHANNEL_TOP, 4, EXIT1_TOP - CHANNEL_TOP);           // top segment
      ctx.fillRect(CHANNEL_X, EXIT1_BOT,   4, EXIT2_TOP - EXIT1_BOT);             // middle segment
      ctx.fillRect(CHANNEL_X, EXIT2_BOT,   4, DRAIN_Y   - EXIT2_BOT);             // bottom segment

      // Gap exit indicators (small arrow-notches in the wall)
      ctx.fillStyle = "#cc4400";
      ctx.fillRect(CHANNEL_X - 3, EXIT1_TOP, 3, EXIT1_BOT - EXIT1_TOP);
      ctx.fillRect(CHANNEL_X - 3, EXIT2_TOP, 3, EXIT2_BOT - EXIT2_TOP);

      // Drain gutter shading
      ctx.fillStyle = "#2a0040";
      ctx.beginPath();
      ctx.moveTo(WALL, FLIPPER_Y + 10);
      ctx.lineTo(LEFT_FLIPPER_X - 30, DRAIN_Y);
      ctx.lineTo(WALL, DRAIN_Y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(CHANNEL_X, FLIPPER_Y + 10);
      ctx.lineTo(RIGHT_FLIPPER_X + 30, DRAIN_Y);
      ctx.lineTo(CHANNEL_X, DRAIN_Y);
      ctx.closePath();
      ctx.fill();

      // Slingshots
      for (const sl of gs.slingshots) {
        const lit = sl.lit > 0;
        ctx.beginPath();
        ctx.moveTo(sl.x1, sl.y1);
        ctx.lineTo(sl.x2, sl.y2);
        ctx.strokeStyle = lit ? COL_SLING_LIT : COL_SLING;
        ctx.lineWidth = SLING_THICK * 2;
        ctx.lineCap = "round";
        ctx.stroke();
        if (lit) {
          ctx.shadowColor = COL_SLING_LIT;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.lineCap = "butt";
      }

      // Lane targets
      for (const lane of gs.lanes) {
        ctx.fillStyle = lane.lit ? COL_LANE_LIT : COL_LANE;
        drawRoundedRect(ctx, lane.x, lane.y, lane.w, lane.h, 3);
        ctx.fill();
        if (lane.lit) {
          ctx.shadowColor = COL_LANE_LIT;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = "#fff";
        ctx.font = "5px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(lane.value / 100) + "x", lane.x + lane.w / 2, lane.y - 3);
      }

      // Bumpers
      for (const bump of gs.bumpers) {
        const lit = bump.lit > 0;
        ctx.beginPath();
        ctx.arc(bump.x, bump.y, bump.r, 0, Math.PI * 2);
        ctx.fillStyle = lit ? COL_BUMPER_LIT : COL_BUMPER;
        ctx.fill();
        if (lit) {
          ctx.shadowColor = COL_BUMPER_LIT;
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = lit ? "#fff" : "#cc4400";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (bump.r >= 10) {
          ctx.fillStyle = lit ? "#000" : "#fff";
          ctx.font = "6px 'Press Start 2P', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(bump.value), bump.x, bump.y);
          ctx.textBaseline = "alphabetic";
        }
      }

      // Score
      ctx.fillStyle = COL_SCORE;
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(gs.score).padStart(7, "0"), CHANNEL_X - 4, WALL + 24);
      ctx.font = "6px 'Press Start 2P', monospace";
      ctx.fillStyle = "#7b3dbe";
      ctx.fillText("HI " + String(gs.hiScore).padStart(7, "0"), CHANNEL_X - 4, WALL + 36);
      if (gs.bonusMultiplier > 1) {
        ctx.fillStyle = COL_BUMPER_LIT;
        ctx.font = "7px 'Press Start 2P', monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${gs.bonusMultiplier}x`, WALL + 8, WALL + 24);
      }
      ctx.textAlign = "left";

      // Flippers
      for (const f of gs.flippers) {
        const [ex, ey] = flipperEndpoint(f);
        ctx.beginPath();
        ctx.moveTo(f.cx, f.cy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = COL_FLIPPER;
        ctx.lineWidth = FLIPPER_THICK * 2;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.strokeStyle = "#ff9966";
        ctx.lineWidth = FLIPPER_THICK * 2 - 3;
        ctx.stroke();
        ctx.lineCap = "butt";
      }

      // Plunger (visual only — inside the channel)
      if (gs.phase === "launch" || gs.phase === "idle") {
        const plungerY = FLIPPER_Y + 20 + gs.plungerCharge * 30;
        ctx.strokeStyle = COL_PLUNGER;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(PLUNGER_X, plungerY - 10);
        ctx.lineTo(PLUNGER_X, FLIPPER_Y + 50);
        ctx.stroke();
        if (gs.phase === "launch") {
          ctx.fillStyle = COL_FLIPPER;
          ctx.font = "6px 'Press Start 2P', monospace";
          ctx.textAlign = "right";
          ctx.fillText("PULL!", CHANNEL_X - 2, FLIPPER_Y + 30);
          ctx.textAlign = "left";
        }
        ctx.lineCap = "butt";
      }

      // Ball
      if (gs.ball) {
        const b = gs.ball;
        const grad = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(1, "#a0a0a0");
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#606060";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Idle overlay
      if (gs.phase === "idle") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(WALL, FLIPPER_Y - 100, CHANNEL_X - WALL - 4, 60);
        ctx.fillStyle = "#ff6b00";
        ctx.font = "9px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        const cx = (WALL + CHANNEL_X) / 2;
        ctx.fillText("PINBALL", cx, FLIPPER_Y - 66);
        ctx.fillStyle = "#c0c0c0";
        ctx.font = "6px 'Press Start 2P', monospace";
        ctx.fillText("SPACE / LAUNCH btn", cx, FLIPPER_Y - 50);
        ctx.fillText("Z/← Left  X/→ Right", cx, FLIPPER_Y - 36);
        ctx.textAlign = "left";
      }

      // Game over overlay
      if (gs.phase === "game-over") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(WALL, H / 2 - 60, CHANNEL_X - WALL - 4, 110);
        ctx.fillStyle = "#ff6b00";
        ctx.font = "12px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        const cx = (WALL + CHANNEL_X) / 2;
        ctx.fillText("GAME OVER", cx, H / 2 - 24);
        ctx.fillStyle = "#ffd700";
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.fillText(String(gs.score).padStart(7, "0"), cx, H / 2);
        ctx.fillStyle = "#c0c0c0";
        ctx.font = "6px 'Press Start 2P', monospace";
        ctx.fillText("SPACE to play again", cx, H / 2 + 24);
        ctx.textAlign = "left";
      }
    }

    function loop() {
      update(stateRef.current);
      draw(stateRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Key handling ─────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const gs = stateRef.current;
    if (e.key === "z" || e.key === "Z" || e.key === "ArrowLeft")  { e.preventDefault(); keysRef.current.left  = true; }
    if (e.key === "x" || e.key === "X" || e.key === "ArrowRight") { e.preventDefault(); keysRef.current.right = true; }
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (gs.phase === "game-over") { resetGame(); return; }
      keysRef.current.space = true;
    }
  }, [resetGame]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "z" || e.key === "Z" || e.key === "ArrowLeft")  keysRef.current.left  = false;
    if (e.key === "x" || e.key === "X" || e.key === "ArrowRight") keysRef.current.right = false;
    if (e.key === " " || e.key === "Spacebar") keysRef.current.space = false;
  }, []);

  // ── Touch / pointer controls ──────────────────────────────────────────────────
  const handleLeftDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    keysRef.current.left = true;
  }, []);
  const handleLeftUp = useCallback(() => { keysRef.current.left = false; }, []);

  const handleRightDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    keysRef.current.right = true;
  }, []);
  const handleRightUp = useCallback(() => { keysRef.current.right = false; }, []);

  const handleLaunchDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const gs = stateRef.current;
    if (gs.phase === "game-over") { resetGame(); return; }
    keysRef.current.space = true;
  }, [resetGame]);
  const handleLaunchUp = useCallback(() => { keysRef.current.space = false; }, []);

  const livesArr = Array.from({ length: 3 }, (_, i) => i < stateRef.current.lives);

  return (
    <div
      ref={divRef}
      className="pinball"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onClick={() => divRef.current?.focus()}
    >
      <div className="pinball__wrap">
        <div className="pinball__canvas-wrap">
          <canvas ref={canvasRef} className="pinball__canvas" width={W} height={H} />
        </div>
      </div>
      <div className="pinball__hud">
        <span className="pinball__hud-score">
          SCORE {String(stateRef.current.score).padStart(7, "0")}
        </span>
        <div className="pinball__hud-balls">
          {livesArr.map((used, i) => (
            <div key={i} className={`pinball__ball-pip${!used ? " pinball__ball-pip--used" : ""}`} />
          ))}
        </div>
      </div>
      <div className="pinball__touch-controls">
        <button className="pinball__touch-btn pinball__touch-btn--left"
          onPointerDown={handleLeftDown} onPointerUp={handleLeftUp} onPointerCancel={handleLeftUp}>
          ◀ LEFT
        </button>
        <button className="pinball__touch-btn pinball__touch-btn--launch"
          onPointerDown={handleLaunchDown} onPointerUp={handleLaunchUp} onPointerCancel={handleLaunchUp}>
          LAUNCH
        </button>
        <button className="pinball__touch-btn pinball__touch-btn--right"
          onPointerDown={handleRightDown} onPointerUp={handleRightUp} onPointerCancel={handleRightUp}>
          RIGHT ▶
        </button>
      </div>
    </div>
  );
}
