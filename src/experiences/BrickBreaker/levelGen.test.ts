import { describe, it, expect } from "vitest";
import {
  generateLevel,
  isLevelClear,
  paddleBounce,
  mulberry32,
  COLS,
  PADDLE_BASE_W,
  PADDLE_Y,
  BALL_RADIUS,
  MAX_BOUNCE_ANGLE,
  BASE_BALL_SPEED,
  type Ball,
  type Paddle,
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
