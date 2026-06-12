// ── Constants ─────────────────────────────────────────────────────────────────
export const LOGICAL_W = 480;
export const LOGICAL_H = 720;

export const COLS = 8;
export const GRID_MARGIN = 8;
export const GRID_GAP = 4;
export const BRICK_W = (LOGICAL_W - 2 * GRID_MARGIN - (COLS - 1) * GRID_GAP) / COLS;
export const BRICK_H = 18;
export const GRID_TOP = 60;

export const PADDLE_BASE_W = 80;
export const PADDLE_WIDE_W = 120;
export const PADDLE_H = 12;
export const PADDLE_Y = LOGICAL_H - 40;

export const BALL_RADIUS = 6;
export const BASE_BALL_SPEED = 240;
export const MAX_BOUNCE_ANGLE = (75 * Math.PI) / 180;

export const MAX_BALLS = 6;
export const PICKUP_FALL_SPEED = 120;
export const POWERUP_W = 28;
export const POWERUP_H = 14;
export const COIN_RADIUS = 7;
export const POWERUP_DROP_CHANCE = 0.1;
export const COIN_DROP_CHANCE = 0.3;
export const WIDE_DURATION_MS = 10_000;
export const LASER_DURATION_MS = 10_000;
export const PIERCE_DURATION_MS = 8_000;
export const STICKY_DURATION_MS = 12_000;
export const POWERUP_CATCH_BONUS = 25;

export const LASER_FIRE_INTERVAL_MS = 420;
export const LASER_SPEED = 360;
export const LASER_W = 4;
export const LASER_H = 12;

export const ICE_SLOW_DURATION_MS = 1500;
export const ICE_SLOW_FACTOR = 0.5;

export const REGEN_INTERVAL_MS = 4000;

export const MOVING_BRICK_SPEED = 0.6; // rad/sec
export const MOVING_BRICK_AMPLITUDE = BRICK_W * 0.4;

export const HOMING_TURN_RATE = 2.4; // rad/sec

// ── Types ─────────────────────────────────────────────────────────────────────
export type Phase = "menu" | "playing" | "paused" | "level-transition" | "shop" | "game-over";

export interface Brick {
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  color: string;
  explosive?: boolean;
  moving?: boolean;
  baseX?: number;
  movePhase?: number;
  regenerating?: boolean;
  regenAccum?: number;
  ice?: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  slowUntil?: number;
}

export interface Paddle {
  x: number;
  width: number;
  height: number;
  y: number;
}

export type PowerUpType =
  | "wide"
  | "multiball"
  | "laser"
  | "pierce"
  | "sticky"
  | "shield"
  | "exploding-ball"
  | "coin";

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
  value?: number;
}

export interface Laser {
  x: number;
  y: number;
}

export interface LevelData {
  bricks: Brick[];
  ballSpeed: number;
  rows: number;
}

// ── Difficulty ────────────────────────────────────────────────────────────────
export type Difficulty = "easy" | "normal" | "hard";

export interface DifficultySettings {
  startingLives: number;
  ballSpeedMult: number;
  rampMult: number;
  coinMult: number;
  priceMult: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: { startingLives: 4, ballSpeedMult: 0.85, rampMult: 0.75, coinMult: 1.25, priceMult: 0.85 },
  normal: { startingLives: 3, ballSpeedMult: 1.0, rampMult: 1.0, coinMult: 1.0, priceMult: 1.0 },
  hard: { startingLives: 2, ballSpeedMult: 1.15, rampMult: 1.3, coinMult: 0.85, priceMult: 1.15 },
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

// ── Paddle colors ────────────────────────────────────────────────────────────
export interface PaddleColorOption {
  id: string;
  label: string;
  fill: string;
  fillAlt: string;
  highlight: string;
  shadow: string;
}

export const PADDLE_COLORS: PaddleColorOption[] = [
  { id: "orange", label: "Orange", fill: "#ff6b00", fillAlt: "#ffaa55", highlight: "#ffcc88", shadow: "#664400" },
  { id: "purple", label: "Purple", fill: "#7b3dbe", fillAlt: "#a370e0", highlight: "#d8baf7", shadow: "#3a1d5c" },
  { id: "green", label: "Green", fill: "#33aa33", fillAlt: "#6fd06f", highlight: "#c8f7c8", shadow: "#1a551a" },
  { id: "cyan", label: "Cyan", fill: "#00aaaa", fillAlt: "#5fdcdc", highlight: "#c8f7f7", shadow: "#005555" },
  { id: "red", label: "Red", fill: "#cc1100", fillAlt: "#ff6650", highlight: "#ffcabb", shadow: "#660800" },
  { id: "yellow", label: "Yellow", fill: "#cccc00", fillAlt: "#ffff66", highlight: "#ffffcc", shadow: "#666600" },
];

export function getPaddleColor(id: string): PaddleColorOption {
  return PADDLE_COLORS.find((p) => p.id === id) ?? PADDLE_COLORS[0];
}

// ── RNG ───────────────────────────────────────────────────────────────────────
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Row colors (rainbow gradient through Win95 accent palette) ────────────────
const ROW_COLORS = [
  "#cc1100", // red
  "#ff6b00", // orange
  "#ffaa00", // amber
  "#cccc00", // yellow
  "#33aa33", // green
  "#00aaaa", // cyan
  "#5b2d8e", // purple
  "#7b3dbe", // violet
  "#cc4400", // brick orange
  "#aa3377", // magenta
];

const UNBREAKABLE_COLOR = "#808080";

function rowColor(row: number): string {
  return ROW_COLORS[row % ROW_COLORS.length];
}

// ── Level generation ────────────────────────────────────────────────────────────
export function generateLevel(
  level: number,
  rng: () => number,
  difficulty: DifficultySettings = DIFFICULTIES.normal
): LevelData {
  const ramp = difficulty.rampMult;
  const rows = Math.min(3 + Math.floor((level - 1) / 2), 10);
  const density = Math.min(0.55 + level * 0.03 * ramp, 0.95);
  const toughChance = Math.min(0.05 + level * 0.025 * ramp, 0.5);
  const unbreakableChance = Math.max(0, Math.min((level - 8) * 0.02 * ramp, 0.12));
  const iceChance = level >= 2 ? Math.min((level - 1) * 0.012 * ramp, 0.12) : 0;
  const explosiveChance = level >= 3 ? Math.min((level - 2) * 0.012 * ramp, 0.12) : 0;
  const movingChance = level >= 4 ? Math.min((level - 3) * 0.01 * ramp, 0.1) : 0;
  const regenChance = level >= 5 ? Math.min((level - 4) * 0.01 * ramp, 0.1) : 0;
  const ballSpeed = BASE_BALL_SPEED * Math.min(1 + (level - 1) * 0.06 * ramp, 2.2) * difficulty.ballSpeedMult;

  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row++) {
    const rowBricks: Brick[] = [];
    for (let col = 0; col < COLS; col++) {
      const roll = rng();
      let hp: number | null = null;
      if (roll < unbreakableChance) {
        hp = Infinity;
      } else if (roll < unbreakableChance + (1 - unbreakableChance) * toughChance) {
        hp = 2;
      } else if (roll < density) {
        hp = 1;
      }
      if (hp !== null) {
        rowBricks.push(
          makeBrick(col, row, hp, rng, { iceChance, explosiveChance, movingChance, regenChance })
        );
      }
    }
    if (rowBricks.length === 0) {
      const col = Math.floor(rng() * COLS);
      rowBricks.push(makeBrick(col, row, 1, rng, { iceChance, explosiveChance, movingChance, regenChance }));
    }
    bricks.push(...rowBricks);
  }

  return { bricks, ballSpeed, rows };
}

interface TraitChances {
  iceChance: number;
  explosiveChance: number;
  movingChance: number;
  regenChance: number;
}

function makeBrick(col: number, row: number, hp: number, rng: () => number, traits: TraitChances): Brick {
  const x = GRID_MARGIN + col * (BRICK_W + GRID_GAP);
  const y = GRID_TOP + row * (BRICK_H + GRID_GAP);
  const color = hp === Infinity ? UNBREAKABLE_COLOR : rowColor(row);
  const brick: Brick = { col, row, x, y, w: BRICK_W, h: BRICK_H, hp, maxHp: hp, alive: true, color };

  // Ice and moving traits can apply to any brick, including invulnerable ones.
  if (rng() < traits.iceChance) brick.ice = true;
  if (rng() < traits.movingChance) {
    brick.moving = true;
    brick.baseX = x;
    brick.movePhase = rng() * Math.PI * 2;
  }

  // Explosive and regenerating only make sense on breakable bricks.
  if (hp !== Infinity) {
    if (rng() < traits.explosiveChance) brick.explosive = true;
    if (rng() < traits.regenChance) {
      brick.regenerating = true;
      brick.regenAccum = 0;
    }
  }

  return brick;
}

export function isLevelClear(bricks: Brick[]): boolean {
  return bricks.every((b) => !b.alive || b.hp === Infinity);
}

// ── Brick motion / regen ─────────────────────────────────────────────────────────
export function updateBrickMotion(bricks: Brick[], now: number): void {
  const minX = GRID_MARGIN;
  const maxX = LOGICAL_W - GRID_MARGIN - BRICK_W;
  for (const brick of bricks) {
    if (!brick.alive || !brick.moving) continue;
    const base = brick.baseX ?? brick.x;
    const phase = brick.movePhase ?? 0;
    const offset = Math.sin(phase + (now / 1000) * MOVING_BRICK_SPEED) * MOVING_BRICK_AMPLITUDE;
    brick.x = Math.max(minX, Math.min(maxX, base + offset));
  }
}

export function updateBrickRegen(bricks: Brick[], dtMs: number): void {
  for (const brick of bricks) {
    if (!brick.alive || !brick.regenerating || brick.hp >= brick.maxHp) continue;
    brick.regenAccum = (brick.regenAccum ?? 0) + dtMs;
    if (brick.regenAccum >= REGEN_INTERVAL_MS) {
      brick.regenAccum -= REGEN_INTERVAL_MS;
      brick.hp = Math.min(brick.maxHp, brick.hp + 1);
    }
  }
}

// ── Explosions ───────────────────────────────────────────────────────────────────
/**
 * Damages bricks adjacent (4-neighbors) to `origin`, chaining through any
 * neighbors that are themselves explosive. Returns every brick newly
 * destroyed by the chain (excluding `origin`, which the caller already handled).
 */
export function triggerExplosion(bricks: Brick[], origin: Brick): Brick[] {
  const destroyed: Brick[] = [];
  const queue: Brick[] = [origin];
  const visited = new Set<Brick>([origin]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const neighbors = bricks.filter(
      (b) =>
        !visited.has(b) &&
        b.alive &&
        b.hp !== Infinity &&
        ((b.row === current.row && Math.abs(b.col - current.col) === 1) ||
          (b.col === current.col && Math.abs(b.row - current.row) === 1))
    );
    for (const neighbor of neighbors) {
      visited.add(neighbor);
      neighbor.hp -= 1;
      if (neighbor.hp <= 0) {
        neighbor.alive = false;
        destroyed.push(neighbor);
        if (neighbor.explosive) queue.push(neighbor);
      }
    }
  }

  return destroyed;
}

// ── Paddle bounce physics ───────────────────────────────────────────────────────
export function paddleBounce(ball: Ball, paddle: Paddle, ballSpeed: number): void {
  const hitPos = (ball.x - paddle.x) / paddle.width;
  const clamped = Math.max(0, Math.min(1, hitPos));
  const relative = (clamped - 0.5) * 2;
  const angle = relative * MAX_BOUNCE_ANGLE;
  ball.vx = ballSpeed * Math.sin(angle);
  ball.vy = -ballSpeed * Math.cos(angle);
  ball.y = paddle.y - ball.radius;
  ball.slowUntil = 0;
}

// ── Homing ball ──────────────────────────────────────────────────────────────────
/** Gently curves the ball's velocity toward the nearest alive breakable brick. */
export function applyHoming(ball: Ball, bricks: Brick[], dt: number): void {
  let nearest: Brick | null = null;
  let nearestDist = Infinity;
  for (const brick of bricks) {
    if (!brick.alive || brick.hp === Infinity) continue;
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    const dist = (cx - ball.x) ** 2 + (cy - ball.y) ** 2;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = brick;
    }
  }
  if (!nearest) return;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed === 0) return;

  const targetAngle = Math.atan2(nearest.y + nearest.h / 2 - ball.y, nearest.x + nearest.w / 2 - ball.x);
  const currentAngle = Math.atan2(ball.vy, ball.vx);
  let diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const maxTurn = HOMING_TURN_RATE * dt;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
  const newAngle = currentAngle + turn;
  ball.vx = Math.cos(newAngle) * speed;
  ball.vy = Math.sin(newAngle) * speed;
}
