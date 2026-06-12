import { describe, it, expect } from "vitest";
import {
  generateLevel,
  isLevelClear,
  paddleBounce,
  mulberry32,
  updateBrickMotion,
  updateBrickRegen,
  triggerExplosion,
  applyHoming,
  COLS,
  PADDLE_BASE_W,
  PADDLE_Y,
  BALL_RADIUS,
  MAX_BOUNCE_ANGLE,
  BASE_BALL_SPEED,
  GRID_MARGIN,
  BRICK_W,
  DIFFICULTIES,
  REGEN_INTERVAL_MS,
  type Ball,
  type Paddle,
  type Brick,
} from "./levelGen";

describe("generateLevel", () => {
  it("never produces an empty row", () => {
    for (let level = 1; level <= 25; level++) {
      const rng = mulberry32(level * 1000 + 1);
      const { bricks, rows } = generateLevel(level, rng);
      for (let row = 0; row < rows; row++) {
        const rowBricks = bricks.filter((b) => b.row === row);
        expect(rowBricks.length).toBeGreaterThan(0);
        expect(rowBricks.length).toBeLessThanOrEqual(COLS);
      }
    }
  });

  it("scales rows up with level, capped at 10", () => {
    const rngLow = mulberry32(1);
    expect(generateLevel(1, rngLow).rows).toBe(3);
    const rngHigh = mulberry32(2);
    expect(generateLevel(50, rngHigh).rows).toBe(10);
  });

  it("scales ball speed with level, capped at 2.2x base", () => {
    const rng1 = mulberry32(1);
    expect(generateLevel(1, rng1).ballSpeed).toBeCloseTo(BASE_BALL_SPEED);
    const rngHigh = mulberry32(2);
    const fast = generateLevel(100, rngHigh).ballSpeed;
    expect(fast).toBeCloseTo(BASE_BALL_SPEED * 2.2);
  });

  it("introduces unbreakable bricks only from level ~9 onward", () => {
    const rngEarly = mulberry32(7);
    const early = generateLevel(5, rngEarly);
    expect(early.bricks.some((b) => b.hp === Infinity)).toBe(false);
  });

  it("level clears when all breakable bricks are destroyed", () => {
    const rng = mulberry32(42);
    const { bricks } = generateLevel(10, rng);
    expect(isLevelClear(bricks)).toBe(false);
    for (const b of bricks) {
      if (b.hp !== Infinity) b.alive = false;
    }
    expect(isLevelClear(bricks)).toBe(true);
  });
});

describe("paddleBounce", () => {
  function makeBall(x: number): Ball {
    return { x, y: PADDLE_Y, vx: 0, vy: BASE_BALL_SPEED, radius: BALL_RADIUS };
  }
  const paddle: Paddle = { x: 200, width: PADDLE_BASE_W, height: 12, y: PADDLE_Y };

  it("bounces straight up when hit dead center", () => {
    const ball = makeBall(paddle.x + paddle.width / 2);
    paddleBounce(ball, paddle, BASE_BALL_SPEED);
    expect(ball.vx).toBeCloseTo(0, 5);
    expect(ball.vy).toBeCloseTo(-BASE_BALL_SPEED, 5);
  });

  it("bounces at max angle when hit at the edge", () => {
    const ball = makeBall(paddle.x);
    paddleBounce(ball, paddle, BASE_BALL_SPEED);
    expect(ball.vx).toBeCloseTo(BASE_BALL_SPEED * Math.sin(-MAX_BOUNCE_ANGLE), 5);
    expect(ball.vy).toBeCloseTo(-BASE_BALL_SPEED * Math.cos(-MAX_BOUNCE_ANGLE), 5);
  });

  it("preserves overall ball speed", () => {
    const ball = makeBall(paddle.x + paddle.width * 0.25);
    paddleBounce(ball, paddle, BASE_BALL_SPEED);
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    expect(speed).toBeCloseTo(BASE_BALL_SPEED, 5);
  });
});

describe("difficulty scaling", () => {
  it("easy slows the ball and hard speeds it up relative to normal", () => {
    const normal = generateLevel(5, mulberry32(1), DIFFICULTIES.normal).ballSpeed;
    const easy = generateLevel(5, mulberry32(1), DIFFICULTIES.easy).ballSpeed;
    const hard = generateLevel(5, mulberry32(1), DIFFICULTIES.hard).ballSpeed;
    expect(easy).toBeLessThan(normal);
    expect(hard).toBeGreaterThan(normal);
  });
});

describe("brick traits", () => {
  it("introduces ice, explosive, moving and regenerating bricks at higher levels", () => {
    let sawIce = false;
    let sawExplosive = false;
    let sawMoving = false;
    let sawRegen = false;
    for (let seed = 1; seed <= 50; seed++) {
      const { bricks } = generateLevel(8, mulberry32(seed));
      for (const b of bricks) {
        if (b.ice) sawIce = true;
        if (b.explosive) sawExplosive = true;
        if (b.moving) sawMoving = true;
        if (b.regenerating) sawRegen = true;
      }
    }
    expect(sawIce).toBe(true);
    expect(sawExplosive).toBe(true);
    expect(sawMoving).toBe(true);
    expect(sawRegen).toBe(true);
  });

  it("does not give explosive/regenerating traits to unbreakable bricks", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { bricks } = generateLevel(20, mulberry32(seed));
      for (const b of bricks) {
        if (b.hp === Infinity) {
          expect(b.explosive).toBeFalsy();
          expect(b.regenerating).toBeFalsy();
        }
      }
    }
  });
});

describe("updateBrickMotion", () => {
  it("oscillates moving bricks within grid bounds", () => {
    const brick: Brick = {
      col: 0,
      row: 0,
      x: GRID_MARGIN,
      y: 60,
      w: BRICK_W,
      h: 18,
      hp: 1,
      maxHp: 1,
      alive: true,
      color: "#fff",
      moving: true,
      baseX: GRID_MARGIN,
      movePhase: 0,
    };
    updateBrickMotion([brick], 0);
    const minX = GRID_MARGIN;
    const maxX = 480 - GRID_MARGIN - BRICK_W;
    updateBrickMotion([brick], 500);
    expect(brick.x).toBeGreaterThanOrEqual(minX);
    expect(brick.x).toBeLessThanOrEqual(maxX);
  });
});

describe("updateBrickRegen", () => {
  it("restores hp over time for regenerating bricks", () => {
    const brick: Brick = {
      col: 0,
      row: 0,
      x: 0,
      y: 0,
      w: BRICK_W,
      h: 18,
      hp: 0,
      maxHp: 2,
      alive: true,
      color: "#fff",
      regenerating: true,
      regenAccum: 0,
    };
    updateBrickRegen([brick], REGEN_INTERVAL_MS - 1);
    expect(brick.hp).toBe(0);
    updateBrickRegen([brick], 1);
    expect(brick.hp).toBe(1);
  });
});

describe("triggerExplosion", () => {
  function makeBrick(col: number, row: number, hp: number, explosive = false): Brick {
    return {
      col,
      row,
      x: GRID_MARGIN + col * (BRICK_W + 4),
      y: 60 + row * 22,
      w: BRICK_W,
      h: 18,
      hp,
      maxHp: hp,
      alive: true,
      color: "#fff",
      explosive,
    };
  }

  it("damages adjacent bricks and chains through other explosives", () => {
    const origin = makeBrick(1, 1, 1, true);
    const right = makeBrick(2, 1, 1, true);
    const farRight = makeBrick(3, 1, 1);
    const below = makeBrick(1, 2, 2);
    const bricks = [origin, right, farRight, below];

    origin.alive = false;
    const destroyed = triggerExplosion(bricks, origin);

    expect(right.alive).toBe(false);
    expect(destroyed).toContain(right);
    expect(farRight.alive).toBe(false);
    expect(destroyed).toContain(farRight);
    expect(below.hp).toBe(1);
    expect(below.alive).toBe(true);
  });

  it("does not damage unbreakable bricks", () => {
    const origin = makeBrick(1, 1, 1, true);
    const neighbor = makeBrick(2, 1, Infinity);
    origin.alive = false;
    const destroyed = triggerExplosion([origin, neighbor], origin);
    expect(destroyed).not.toContain(neighbor);
    expect(neighbor.alive).toBe(true);
  });
});

describe("applyHoming", () => {
  it("curves the ball's velocity toward the nearest breakable brick", () => {
    const ball: Ball = { x: 100, y: 100, vx: 0, vy: -BASE_BALL_SPEED, radius: BALL_RADIUS };
    const target: Brick = {
      col: 0,
      row: 0,
      x: 200,
      y: 100,
      w: BRICK_W,
      h: 18,
      hp: 1,
      maxHp: 1,
      alive: true,
      color: "#fff",
    };
    applyHoming(ball, [target], 1 / 60);
    const speed = Math.hypot(ball.vx, ball.vy);
    expect(speed).toBeCloseTo(BASE_BALL_SPEED, 5);
    // Velocity should now have a positive x component, curving toward the brick on the right.
    expect(ball.vx).toBeGreaterThan(0);
  });
});
