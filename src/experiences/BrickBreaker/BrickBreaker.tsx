import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { BB_SCORES_ID } from "../NsDoors97/filesystem/types";
import {
  LOGICAL_W,
  LOGICAL_H,
  PADDLE_BASE_W,
  PADDLE_WIDE_W,
  PADDLE_H,
  PADDLE_Y,
  BALL_RADIUS,
  MAX_BALLS,
  POWERUP_FALL_SPEED,
  POWERUP_W,
  POWERUP_H,
  POWERUP_DROP_CHANCE,
  WIDE_DURATION_MS,
  POWERUP_CATCH_BONUS,
  generateLevel,
  isLevelClear,
  paddleBounce,
  mulberry32,
  type Phase,
  type Brick,
  type Ball,
  type Paddle,
  type PowerUp,
} from "./levelGen";
import "./BrickBreaker.css";

interface BrickBreakerProps {
  onQuit?: () => void;
}

interface MutableState {
  bricks: Brick[];
  balls: Ball[];
  paddle: Paddle;
  powerUps: PowerUp[];
  ballSpeed: number;
  widePaddleUntil: number;
  awaitingLaunch: boolean;
  rng: () => number;
  nextPowerUpId: number;
  lastFrameTime: number;
}

const PADDLE_LERP_MOUSE = 0.35;
const PADDLE_LERP_TOUCH = 0.18;
const KEYBOARD_SPEED = 360;
const LEVEL_TRANSITION_MS = 1200;
const BRICK_SCORE = 10;
const STARTING_LIVES = 3;
const BOUNCE_LAUNCH_FRACTION = 0.35;
const MULTIBALL_SPLIT_ANGLE = (25 * Math.PI) / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createBall(state: MutableState): Ball {
  return {
    x: state.paddle.x + state.paddle.width / 2,
    y: state.paddle.y - BALL_RADIUS - 1,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
  };
}

function createState(level: number, rng: () => number): MutableState {
  const data = generateLevel(level, rng);
  const state: MutableState = {
    bricks: data.bricks,
    balls: [],
    paddle: {
      x: LOGICAL_W / 2 - PADDLE_BASE_W / 2,
      width: PADDLE_BASE_W,
      height: PADDLE_H,
      y: PADDLE_Y,
    },
    powerUps: [],
    ballSpeed: data.ballSpeed,
    widePaddleUntil: 0,
    awaitingLaunch: true,
    rng,
    nextPowerUpId: 0,
    lastFrameTime: performance.now(),
  };
  state.balls = [createBall(state)];
  return state;
}

function circleRectCollide(ball: Ball, rect: { x: number; y: number; w: number; h: number }): boolean {
  const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
  const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
}

function resolveBrickCollision(ball: Ball, brick: Brick): void {
  const closestX = clamp(ball.x, brick.x, brick.x + brick.w);
  const closestY = clamp(ball.y, brick.y, brick.y + brick.h);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const overlapX = ball.radius - Math.abs(dx);
  const overlapY = ball.radius - Math.abs(dy);
  if (overlapX < overlapY) {
    if (dx < 0) {
      ball.vx = -Math.abs(ball.vx);
      ball.x -= overlapX;
    } else {
      ball.vx = Math.abs(ball.vx);
      ball.x += overlapX;
    }
  } else {
    if (dy < 0) {
      ball.vy = -Math.abs(ball.vy);
      ball.y -= overlapY;
    } else {
      ball.vy = Math.abs(ball.vy);
      ball.y += overlapY;
    }
  }
}

export default function BrickBreaker({ onQuit }: BrickBreakerProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("start");
  const phaseRef = useRef<Phase>("start");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [highScore, setHighScore] = useState(0);
  const [newHighScore, setNewHighScore] = useState(false);
  const [awaitingLaunch, setAwaitingLaunch] = useState(true);

  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const livesRef = useRef(STARTING_LIVES);
  const highScoreRef = useRef(0);

  const stateRef = useRef<MutableState>(createState(1, mulberry32(Date.now() >>> 0)));

  const paddleTargetXRef = useRef(LOGICAL_W / 2);
  const paddleCenterXRef = useRef(LOGICAL_W / 2);
  const pointerLerpRef = useRef(PADDLE_LERP_TOUCH);
  const keysRef = useRef({ left: false, right: false });

  // ── High score persistence ──────────────────────────────────────────────────

  useEffect(() => {
    try {
      const content = fsStore.getFile(BB_SCORES_ID)?.content;
      const hs = content ? parseInt(content, 10) || 0 : 0;
      highScoreRef.current = hs;
      setHighScore(hs);
    } catch {
      /* ignore */
    }
  }, []);

  function persistHighScore(value: number) {
    try {
      fsStore.writeFile(BB_SCORES_ID, String(value));
    } catch {
      /* ignore */
    }
  }

  function maybeUpdateHighScore() {
    if (scoreRef.current > highScoreRef.current) {
      highScoreRef.current = scoreRef.current;
      setHighScore(scoreRef.current);
      setNewHighScore(true);
      persistHighScore(scoreRef.current);
    }
  }

  // ── Game lifecycle ───────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    if (transitionTimeoutRef.current !== null) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    scoreRef.current = 0;
    levelRef.current = 1;
    livesRef.current = STARTING_LIVES;
    setScore(0);
    setLevel(1);
    setLives(STARTING_LIVES);
    setNewHighScore(false);

    const rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    stateRef.current = createState(1, rng);
    paddleCenterXRef.current = LOGICAL_W / 2;
    paddleTargetXRef.current = LOGICAL_W / 2;
    setAwaitingLaunch(true);

    setPhase("playing");
    phaseRef.current = "playing";
  }, []);

  const beginLevelTransition = useCallback(() => {
    setPhase("level-transition");
    phaseRef.current = "level-transition";
    transitionTimeoutRef.current = setTimeout(() => {
      const nextLevel = levelRef.current + 1;
      levelRef.current = nextLevel;
      setLevel(nextLevel);

      const st = stateRef.current;
      const data = generateLevel(nextLevel, st.rng);
      st.bricks = data.bricks;
      st.ballSpeed = data.ballSpeed;
      st.powerUps = [];
      st.balls = [createBall(st)];
      st.awaitingLaunch = true;
      setAwaitingLaunch(true);

      setPhase("playing");
      phaseRef.current = "playing";
      transitionTimeoutRef.current = null;
    }, LEVEL_TRANSITION_MS);
  }, []);

  const endGame = useCallback(() => {
    setPhase("game-over");
    phaseRef.current = "game-over";
  }, []);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") {
      setPhase("paused");
      phaseRef.current = "paused";
    } else if (phaseRef.current === "paused") {
      setPhase("playing");
      phaseRef.current = "playing";
    }
  }, []);

  const launchBall = useCallback(() => {
    const st = stateRef.current;
    if (phaseRef.current !== "playing" || !st.awaitingLaunch || st.balls.length === 0) return;
    const ball = st.balls[0];
    const dir = st.rng() < 0.5 ? -1 : 1;
    const vx = st.ballSpeed * BOUNCE_LAUNCH_FRACTION * dir;
    const vy = -Math.sqrt(Math.max(st.ballSpeed * st.ballSpeed - vx * vx, 0));
    ball.vx = vx;
    ball.vy = vy;
    st.awaitingLaunch = false;
    setAwaitingLaunch(false);
  }, []);

  // ── Input handling ───────────────────────────────────────────────────────────

  function getLogicalX(clientX: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return paddleTargetXRef.current;
    const rect = canvas.getBoundingClientRect();
    const elemAspect = rect.width / rect.height;
    const logicalAspect = LOGICAL_W / LOGICAL_H;
    let contentW: number;
    let offsetX: number;
    if (elemAspect > logicalAspect) {
      contentW = rect.height * logicalAspect;
      offsetX = (rect.width - contentW) / 2;
    } else {
      contentW = rect.width;
      offsetX = 0;
    }
    return ((clientX - rect.left - offsetX) / contentW) * LOGICAL_W;
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointerLerpRef.current = e.pointerType === "mouse" ? PADDLE_LERP_MOUSE : PADDLE_LERP_TOUCH;
      paddleTargetXRef.current = getLogicalX(e.clientX);
      if (phaseRef.current === "start") {
        setPhase("playing");
        phaseRef.current = "playing";
      } else if (phaseRef.current === "playing") {
        launchBall();
      }
    },
    [launchBall]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse") pointerLerpRef.current = PADDLE_LERP_MOUSE;
    paddleTargetXRef.current = getLogicalX(e.clientX);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        keysRef.current.left = true;
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        keysRef.current.right = true;
        e.preventDefault();
      } else if (e.key === " ") {
        e.preventDefault();
        if (phaseRef.current === "start") {
          setPhase("playing");
          phaseRef.current = "playing";
        } else if (phaseRef.current === "playing") {
          if (stateRef.current.awaitingLaunch) launchBall();
          else togglePause();
        } else if (phaseRef.current === "paused") {
          togglePause();
        } else if (phaseRef.current === "game-over") {
          resetGame();
        }
      } else if (e.key === "Escape") {
        if (phaseRef.current === "playing" || phaseRef.current === "paused") {
          e.preventDefault();
          togglePause();
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      else if (e.key === "ArrowRight") keysRef.current.right = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [launchBall, togglePause, resetGame]);

  // ── Power-ups ────────────────────────────────────────────────────────────────

  function maybeDropPowerUp(state: MutableState, brick: Brick) {
    if (state.rng() >= POWERUP_DROP_CHANCE) return;
    const type = state.rng() < 0.5 ? "wide" : "multiball";
    state.powerUps.push({
      id: state.nextPowerUpId++,
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      vy: POWERUP_FALL_SPEED,
      type,
    });
  }

  function applyPowerUp(state: MutableState, powerUp: PowerUp, now: number) {
    if (powerUp.type === "wide") {
      state.widePaddleUntil = now + WIDE_DURATION_MS;
      return;
    }
    const current = state.balls.slice();
    for (const ball of current) {
      const speed = Math.hypot(ball.vx, ball.vy) || state.ballSpeed;
      const baseAngle = Math.atan2(ball.vy, ball.vx);
      for (const offset of [MULTIBALL_SPLIT_ANGLE, -MULTIBALL_SPLIT_ANGLE]) {
        if (state.balls.length >= MAX_BALLS) break;
        const angle = baseAngle + offset;
        state.balls.push({
          x: ball.x,
          y: ball.y,
          vx: speed * Math.cos(angle),
          vy: speed * Math.sin(angle),
          radius: ball.radius,
        });
      }
      if (state.balls.length >= MAX_BALLS) break;
    }
  }

  function updatePowerUps(state: MutableState, dt: number, now: number) {
    const remaining: PowerUp[] = [];
    const paddle = state.paddle;
    for (const p of state.powerUps) {
      p.y += p.vy * dt;
      const overlapsPaddle =
        p.y + POWERUP_H / 2 >= paddle.y &&
        p.y - POWERUP_H / 2 <= paddle.y + paddle.height &&
        p.x + POWERUP_W / 2 >= paddle.x &&
        p.x - POWERUP_W / 2 <= paddle.x + paddle.width;
      if (overlapsPaddle) {
        applyPowerUp(state, p, now);
        scoreRef.current += POWERUP_CATCH_BONUS;
        setScore(scoreRef.current);
        maybeUpdateHighScore();
        continue;
      }
      if (p.y - POWERUP_H / 2 <= LOGICAL_H) remaining.push(p);
    }
    state.powerUps = remaining;
  }

  // ── Ball physics ─────────────────────────────────────────────────────────────

  function updateBalls(state: MutableState, dt: number) {
    const remaining: Ball[] = [];
    for (const ball of state.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.radius > LOGICAL_W) {
        ball.x = LOGICAL_W - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      const paddle = state.paddle;
      if (
        ball.vy > 0 &&
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + paddle.width
      ) {
        paddleBounce(ball, paddle, state.ballSpeed);
      }

      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        if (!circleRectCollide(ball, brick)) continue;
        resolveBrickCollision(ball, brick);
        if (brick.hp !== Infinity) {
          brick.hp -= 1;
          scoreRef.current += BRICK_SCORE;
          setScore(scoreRef.current);
          maybeUpdateHighScore();
          if (brick.hp <= 0) {
            brick.alive = false;
            maybeDropPowerUp(state, brick);
          }
        }
        break;
      }

      if (ball.y - ball.radius <= LOGICAL_H) {
        remaining.push(ball);
      }
    }
    state.balls = remaining;
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────

  const draw = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = canvas.width / LOGICAL_W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = "#0c0400";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    const state = stateRef.current;

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
      if (brick.maxHp === 2 && brick.hp === 1) {
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.moveTo(brick.x + 4, brick.y + brick.h - 4);
        ctx.lineTo(brick.x + brick.w / 2, brick.y + 4);
        ctx.lineTo(brick.x + brick.w - 4, brick.y + brick.h - 4);
        ctx.stroke();
      }
    }

    const paddle = state.paddle;
    const isWide = now < state.widePaddleUntil;
    ctx.fillStyle = isWide ? "#ffaa55" : "#ff6b00";
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.strokeStyle = "#ffcc88";
    ctx.beginPath();
    ctx.moveTo(paddle.x, paddle.y + paddle.height);
    ctx.lineTo(paddle.x, paddle.y);
    ctx.lineTo(paddle.x + paddle.width, paddle.y);
    ctx.stroke();
    ctx.strokeStyle = "#664400";
    ctx.beginPath();
    ctx.moveTo(paddle.x + paddle.width, paddle.y);
    ctx.lineTo(paddle.x + paddle.width, paddle.y + paddle.height);
    ctx.lineTo(paddle.x, paddle.y + paddle.height);
    ctx.stroke();

    for (const ball of state.balls) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of state.powerUps) {
      ctx.fillStyle = p.type === "wide" ? "#ff6b00" : "#7b3dbe";
      ctx.fillRect(p.x - POWERUP_W / 2, p.y - POWERUP_H / 2, POWERUP_W, POWERUP_H);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(p.x - POWERUP_W / 2 + 0.5, p.y - POWERUP_H / 2 + 0.5, POWERUP_W - 1, POWERUP_H - 1);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.type === "wide" ? "W" : "M", p.x, p.y + 1);
    }
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────────

  const step = useCallback(
    (dt: number, now: number) => {
      const state = stateRef.current;
      const ph = phaseRef.current;

      if (ph === "playing" || ph === "start") {
        if (keysRef.current.left) paddleTargetXRef.current -= KEYBOARD_SPEED * dt;
        if (keysRef.current.right) paddleTargetXRef.current += KEYBOARD_SPEED * dt;

        const halfW = state.paddle.width / 2;
        paddleTargetXRef.current = clamp(paddleTargetXRef.current, halfW, LOGICAL_W - halfW);
        paddleCenterXRef.current +=
          (paddleTargetXRef.current - paddleCenterXRef.current) * pointerLerpRef.current;

        state.paddle.width = now < state.widePaddleUntil ? PADDLE_WIDE_W : PADDLE_BASE_W;
        state.paddle.x = clamp(
          paddleCenterXRef.current - state.paddle.width / 2,
          0,
          LOGICAL_W - state.paddle.width
        );

        if (state.awaitingLaunch) {
          for (const ball of state.balls) {
            ball.x = state.paddle.x + state.paddle.width / 2;
            ball.y = state.paddle.y - ball.radius - 1;
          }
        } else if (ph === "playing") {
          updateBalls(state, dt);
          updatePowerUps(state, dt, now);

          if (state.balls.length === 0) {
            const newLives = livesRef.current - 1;
            livesRef.current = newLives;
            setLives(newLives);
            if (newLives > 0) {
              state.balls = [createBall(state)];
              state.awaitingLaunch = true;
              setAwaitingLaunch(true);
            } else {
              endGame();
            }
          } else if (isLevelClear(state.bricks)) {
            beginLevelTransition();
          }
        }
      }

      draw(now);
    },
    [draw, beginLevelTransition, endGame]
  );

  useEffect(() => {
    function frame(now: number) {
      const state = stateRef.current;
      const dt = Math.min((now - state.lastFrameTime) / 1000, 1 / 30);
      state.lastFrameTime = now;
      step(dt, now);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [step]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  // ── Canvas sizing ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(LOGICAL_W * dpr);
    canvas.height = Math.round(LOGICAL_H * dpr);
  }, []);

  // ── Menus ────────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const items: MenuBarMenu["items"] = [
      { label: "New Game", onClick: resetGame },
      { separator: true },
      {
        label: "Pause",
        checked: phase === "paused",
        disabled: phase !== "playing" && phase !== "paused",
        onClick: togglePause,
      },
    ];
    if (onQuit) {
      items.push({ separator: true }, { label: "Exit", onClick: onQuit });
    }
    return [{ label: "Game", items }];
  }, [phase, onQuit, resetGame, togglePause]);

  useWindowMenus(menus);

  // ── Render ───────────────────────────────────────────────────────────────────

  const livesDisplay = "♥".repeat(Math.max(lives, 0)) + "♡".repeat(Math.max(STARTING_LIVES - lives, 0));

  return (
    <div className="bb-game">
      <div className="bb-hud">
        <div className="bb-hud__item">
          <span className="bb-hud__label">SCORE</span>
          <span className="bb-hud__val">{String(score).padStart(6, "0")}</span>
        </div>
        <div className="bb-hud__item">
          <span className="bb-hud__label">LEVEL</span>
          <span className="bb-hud__val">{String(level).padStart(2, "0")}</span>
        </div>
        <div className="bb-hud__item">
          <span className="bb-hud__label">LIVES</span>
          <span className="bb-hud__val bb-hud__lives">{livesDisplay}</span>
        </div>
        <div className="bb-hud__item">
          <span className="bb-hud__label">HI</span>
          <span className="bb-hud__val">{String(highScore).padStart(6, "0")}</span>
        </div>
      </div>

      <div className="bb-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="bb-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />

        {phase === "start" && (
          <div className="bb-overlay">
            <div className="bb-panel">
              <h2 className="bb-panel__title">Brick Breaker</h2>
              <p className="bb-panel__sub">
                Drag or tap to move the paddle.
                <br />
                Tap / click / space to launch the ball.
                <br />
                Arrow keys also move the paddle.
              </p>
              <button className="bb-btn bb-btn--primary" onClick={() => setPhase("playing")}>
                Tap to Start
              </button>
            </div>
          </div>
        )}

        {phase === "paused" && (
          <div className="bb-overlay">
            <div className="bb-panel">
              <h2 className="bb-panel__title">Paused</h2>
              <button className="bb-btn bb-btn--primary" onClick={togglePause}>
                Resume
              </button>
            </div>
          </div>
        )}

        {phase === "level-transition" && (
          <div className="bb-overlay bb-overlay--transparent">
            <div className="bb-panel">
              <h2 className="bb-panel__title">Level {level}</h2>
              <p className="bb-panel__sub">Get ready!</p>
            </div>
          </div>
        )}

        {phase === "game-over" && (
          <div className="bb-overlay">
            <div className="bb-panel">
              <h2 className="bb-panel__title">Game Over</h2>
              <p className="bb-panel__sub">
                Score: {score}
                <br />
                High Score: {highScore}
                {newHighScore && (
                  <>
                    <br />
                    New High Score!
                  </>
                )}
              </p>
              <button className="bb-btn bb-btn--primary" onClick={resetGame}>
                Play Again
              </button>
            </div>
          </div>
        )}

        {phase === "playing" && awaitingLaunch && (
          <div className="bb-overlay bb-overlay--transparent">
            <div className="bb-hint">Tap or press Space to launch</div>
          </div>
        )}
      </div>
    </div>
  );
}
