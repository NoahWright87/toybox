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
export const POWERUP_FALL_SPEED = 120;
export const POWERUP_W = 28;
export const POWERUP_H = 14;
export const POWERUP_DROP_CHANCE = 0.12;
export const WIDE_DURATION_MS = 10_000;
export const POWERUP_CATCH_BONUS = 25;

// ── Types ─────────────────────────────────────────────────────────────────────
export type Phase = "start" | "playing" | "paused" | "level-transition" | "game-over";

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
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface Paddle {
  x: number;
  width: number;
  height: number;
  y: number;
}

export type PowerUpType = "wide" | "multiball";

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
}

export interface LevelData {
  bricks: Brick[];
  ballSpeed: number;
  rows: number;
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
export function generateLevel(level: number, rng: () => number): LevelData {
  const rows = Math.min(3 + Math.floor((level - 1) / 2), 10);
  const density = Math.min(0.55 + level * 0.03, 0.95);
  const toughChance = Math.min(0.05 + level * 0.025, 0.5);
  const unbreakableChance = Math.max(0, Math.min((level - 8) * 0.02, 0.12));
  const ballSpeed = BASE_BALL_SPEED * Math.min(1 + (level - 1) * 0.06, 2.2);

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
        rowBricks.push(makeBrick(col, row, hp));
      }
    }
    if (rowBricks.length === 0) {
      const col = Math.floor(rng() * COLS);
      rowBricks.push(makeBrick(col, row, 1));
    }
    bricks.push(...rowBricks);
  }

  return { bricks, ballSpeed, rows };
}

function makeBrick(col: number, row: number, hp: number): Brick {
  const x = GRID_MARGIN + col * (BRICK_W + GRID_GAP);
  const y = GRID_TOP + row * (BRICK_H + GRID_GAP);
  const color = hp === Infinity ? UNBREAKABLE_COLOR : rowColor(row);
  return { col, row, x, y, w: BRICK_W, h: BRICK_H, hp, maxHp: hp, alive: true, color };
}

export function isLevelClear(bricks: Brick[]): boolean {
  return bricks.every((b) => !b.alive || b.hp === Infinity);
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
}
