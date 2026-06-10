import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { JB_SCORES_ID } from "../NsDoors97/filesystem/types";
import "./Jazzball.css";

// ─── Constants ───────────────────────────────────────────────────────────────

const CW = 480;
const CH = 320;
const CELL = 8;
const COLS = CW / CELL; // 60
const ROWS = CH / CELL; // 40
const BALL_RADIUS = 3;
const WALL_GROW_RATE = 40; // cells per second, per direction
const FLASH_DURATION = 0.4;
const TARGET_PERCENT = 75;
const MAX_LIVES = 3;
const INITIAL_BALLS = 2;
const BALL_BASE_SPEED = 70; // px / second
const BALL_SPEED_STEP = 8;

// Cell states
const OPEN = 0;
const WALL = 1;
const FILLED = 2;

// ─── Types ───────────────────────────────────────────────────────────────────

type Orientation = "horizontal" | "vertical";
type Phase = "playing" | "levelComplete" | "gameOver";
type BallMode = "smooth" | "diagonal";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface BuildingWall {
  orientation: Orientation;
  fixed: number;  // col (vertical wall) or row (horizontal wall)
  front1: number; // current position along the growth axis, growing toward 0
  front2: number; // current position along the growth axis, growing toward max
  done1: boolean;
  done2: boolean;
  accum1: number;
  accum2: number;
  cells: Set<number>; // grid indices belonging to this wall (incl. origin)
}

interface GameState {
  grid: Uint8Array;
  balls: Ball[];
  buildingWall: BuildingWall | null;
  orientation: Orientation;
  ballMode: BallMode;
  lives: number;
  level: number;
  score: number;
  percentCleared: number;
  filledCount: number;
  phase: Phase;
  flashTimer: number;
  lastFrameTime: number;
}

interface ScoresData {
  highScore: number;
  bestLevel: number;
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function totalArea(): number {
  return (COLS - 2) * (ROWS - 2);
}

function ballSpeedForLevel(level: number): number {
  return BALL_BASE_SPEED + (level - 1) * BALL_SPEED_STEP;
}

function cellIndex(col: number, row: number): number {
  return row * COLS + col;
}

function createGrid(): Uint8Array {
  const grid = new Uint8Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) {
        grid[cellIndex(col, row)] = WALL;
      }
    }
  }
  return grid;
}

function spawnBalls(count: number, speed: number, mode: BallMode): Ball[] {
  const balls: Ball[] = [];
  const margin = CELL + BALL_RADIUS;
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = margin + Math.random() * (CW - 2 * margin);
      y = margin + Math.random() * (CH - 2 * margin);
      attempts++;
    } while (attempts < 20 && balls.some((b) => Math.hypot(b.x - x, b.y - y) < BALL_RADIUS * 4));

    let vx: number;
    let vy: number;
    if (mode === "diagonal") {
      vx = (Math.random() < 0.5 ? -1 : 1) * speed;
      vy = (Math.random() < 0.5 ? -1 : 1) * speed;
    } else {
      const angle = Math.random() * Math.PI * 2;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }
    balls.push({ x, y, vx, vy });
  }
  return balls;
}

function newGameState(level: number, lives: number, score: number, orientation: Orientation, ballMode: BallMode): GameState {
  const ballCount = INITIAL_BALLS + (level - 1);
  return {
    grid: createGrid(),
    balls: spawnBalls(ballCount, ballSpeedForLevel(level), ballMode),
    buildingWall: null,
    orientation,
    ballMode,
    lives,
    level,
    score,
    percentCleared: 0,
    filledCount: 0,
    phase: "playing",
    flashTimer: 0,
    lastFrameTime: performance.now(),
  };
}

function isSolid(grid: Uint8Array, col: number, row: number): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return grid[cellIndex(col, row)] !== OPEN;
}

function cellHitsBall(idx: number, ball: Ball): boolean {
  const col = idx % COLS;
  const row = (idx - col) / COLS;
  const cx = col * CELL;
  const cy = row * CELL;
  const closestX = Math.min(Math.max(ball.x, cx), cx + CELL);
  const closestY = Math.min(Math.max(ball.y, cy), cy + CELL);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS;
}

function startWall(state: GameState, col: number, row: number, orientation: Orientation): void {
  const idx = cellIndex(col, row);
  if (state.grid[idx] !== OPEN) return;
  state.grid[idx] = WALL;
  const cells = new Set<number>([idx]);
  const fixed = orientation === "vertical" ? col : row;
  const origin = orientation === "vertical" ? row : col;
  state.buildingWall = {
    orientation, fixed, front1: origin, front2: origin,
    done1: false, done2: false, accum1: 0, accum2: 0, cells,
  };
}

function shatterWall(state: GameState, wall: BuildingWall): void {
  for (const idx of wall.cells) state.grid[idx] = OPEN;
  state.buildingWall = null;
  state.lives -= 1;
  state.flashTimer = FLASH_DURATION;
  if (state.lives <= 0) state.phase = "gameOver";
}

function completeWall(state: GameState, wall: BuildingWall): void {
  state.filledCount += wall.cells.size;
  state.buildingWall = null;

  const ballCells = new Set<number>();
  for (const ball of state.balls) {
    const bcol = Math.floor(ball.x / CELL);
    const brow = Math.floor(ball.y / CELL);
    ballCells.add(cellIndex(bcol, brow));
  }

  const visited = new Uint8Array(COLS * ROWS);
  for (let idx = 0; idx < COLS * ROWS; idx++) {
    if (state.grid[idx] !== OPEN || visited[idx]) continue;

    const component: number[] = [];
    const queue: number[] = [idx];
    visited[idx] = 1;
    let hasBall = false;

    while (queue.length > 0) {
      const cur = queue.pop() as number;
      component.push(cur);
      if (ballCells.has(cur)) hasBall = true;

      const col = cur % COLS;
      const row = (cur - col) / COLS;
      const neighbors: number[] = [];
      if (col > 0) neighbors.push(cur - 1);
      if (col < COLS - 1) neighbors.push(cur + 1);
      if (row > 0) neighbors.push(cur - COLS);
      if (row < ROWS - 1) neighbors.push(cur + COLS);

      for (const n of neighbors) {
        if (!visited[n] && state.grid[n] === OPEN) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }

    if (!hasBall) {
      for (const c of component) state.grid[c] = FILLED;
      state.filledCount += component.length;
    }
  }

  state.percentCleared = (state.filledCount / totalArea()) * 100;
  if (state.percentCleared >= TARGET_PERCENT) {
    state.score += Math.round(state.percentCleared);
    state.phase = "levelComplete";
  }
}

// Grows the active wall (one or more cells per direction depending on dt),
// shatters it if a ball touches a newly-grown cell, and finalizes it once
// both ends have reached a non-open cell.
function advanceWall(state: GameState, dt: number): void {
  const wall = state.buildingWall;
  if (!wall) return;

  const pending: number[] = [];
  const maxFront = wall.orientation === "vertical" ? ROWS - 1 : COLS - 1;

  if (!wall.done1) {
    wall.accum1 += WALL_GROW_RATE * dt;
    while (wall.accum1 >= 1 && !wall.done1) {
      const candidate = wall.front1 - 1;
      const idx = wall.orientation === "vertical" ? cellIndex(wall.fixed, candidate) : cellIndex(candidate, wall.fixed);
      if (candidate < 0 || state.grid[idx] !== OPEN) { wall.done1 = true; break; }
      wall.front1 = candidate;
      pending.push(idx);
      wall.accum1 -= 1;
    }
  }

  if (!wall.done2) {
    wall.accum2 += WALL_GROW_RATE * dt;
    while (wall.accum2 >= 1 && !wall.done2) {
      const candidate = wall.front2 + 1;
      const idx = wall.orientation === "vertical" ? cellIndex(wall.fixed, candidate) : cellIndex(candidate, wall.fixed);
      if (candidate > maxFront || state.grid[idx] !== OPEN) { wall.done2 = true; break; }
      wall.front2 = candidate;
      pending.push(idx);
      wall.accum2 -= 1;
    }
  }

  if (pending.length > 0) {
    for (const ball of state.balls) {
      for (const idx of pending) {
        if (cellHitsBall(idx, ball)) {
          shatterWall(state, wall);
          return;
        }
      }
    }
    for (const idx of pending) {
      state.grid[idx] = WALL;
      wall.cells.add(idx);
    }
  }

  if (wall.done1 && wall.done2) {
    completeWall(state, wall);
  }
}

function moveBalls(state: GameState, dt: number): void {
  for (const ball of state.balls) {
    let nx = ball.x + ball.vx * dt;
    let ny = ball.y + ball.vy * dt;

    const edgeX = ball.vx > 0 ? nx + BALL_RADIUS : nx - BALL_RADIUS;
    const rowForX = Math.floor(ball.y / CELL);
    const colX = Math.floor(edgeX / CELL);
    if (isSolid(state.grid, colX, rowForX)) {
      ball.vx = -ball.vx;
      nx = ball.x;
    }

    const edgeY = ball.vy > 0 ? ny + BALL_RADIUS : ny - BALL_RADIUS;
    const colForY = Math.floor(nx / CELL);
    const rowY = Math.floor(edgeY / CELL);
    if (isSolid(state.grid, colForY, rowY)) {
      ball.vy = -ball.vy;
      ny = ball.y;
    }

    ball.x = nx;
    ball.y = ny;
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────────

function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const v = state.grid[cellIndex(col, row)];
      ctx.fillStyle = v === FILLED ? "#7b3dbe" : v === WALL ? "#ff6b00" : "#1a0a2e";
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }

  const wall = state.buildingWall;
  if (wall) {
    const pulse = Math.sin(state.lastFrameTime / 80) > 0;
    ctx.fillStyle = state.flashTimer > 0 ? "#ff3333" : pulse ? "#ffcc66" : "#ff6b00";
    for (const idx of wall.cells) {
      const col = idx % COLS;
      const row = (idx - col) / COLS;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }

  for (const ball of state.balls) {
    ctx.fillStyle = "#ff6b00";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${(state.flashTimer / FLASH_DURATION) * 0.3})`;
    ctx.fillRect(0, 0, CW, CH);
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface JazzballProps {
  onQuit?: () => void;
}

export default function Jazzball({ onQuit }: JazzballProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [ballMode, setBallMode] = useState<BallMode>("smooth");
  const [phase, setPhase] = useState<Phase>("playing");
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [percentCleared, setPercentCleared] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [bestLevel, setBestLevel] = useState(1);

  const highScoreRef = useRef(highScore);
  const bestLevelRef = useRef(bestLevel);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);
  useEffect(() => { bestLevelRef.current = bestLevel; }, [bestLevel]);

  // Load saved scores from the filesystem on mount
  useEffect(() => {
    const content = fsStore.getFile(JB_SCORES_ID)?.content;
    if (!content) return;
    try {
      const data = JSON.parse(content) as Partial<ScoresData>;
      if (typeof data.highScore === "number") setHighScore(data.highScore);
      if (typeof data.bestLevel === "number") setBestLevel(data.bestLevel);
    } catch {
      // ignore corrupt SCORES.DAT
    }
  }, []);

  const persistScores = useCallback((newHighScore: number, newBestLevel: number) => {
    try {
      fsStore.writeFile(JB_SCORES_ID, JSON.stringify({ highScore: newHighScore, bestLevel: newBestLevel }));
    } catch {
      // ignore
    }
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────────

  const gameLoop = useCallback((timestamp: number) => {
    const state = gameRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dt = Math.min((timestamp - state.lastFrameTime) / 1000, 0.05);
    state.lastFrameTime = timestamp;

    if (state.phase === "playing") {
      const livesBefore = state.lives;
      const percentBefore = state.percentCleared;
      const scoreBefore = state.score;

      advanceWall(state, dt);
      moveBalls(state, dt);

      if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt);

      if (state.lives !== livesBefore) setLives(state.lives);
      if (state.percentCleared !== percentBefore) setPercentCleared(state.percentCleared);
      if (state.score !== scoreBefore) setScore(state.score);

      const phaseAfter = state.phase as Phase;
      if (phaseAfter === "gameOver") {
        if (state.score > highScoreRef.current) { setHighScore(state.score); persistScores(state.score, bestLevelRef.current); }
        setPhase("gameOver");
      } else if (phaseAfter === "levelComplete") {
        const newHigh = Math.max(highScoreRef.current, state.score);
        const newBest = Math.max(bestLevelRef.current, state.level);
        if (newHigh !== highScoreRef.current || newBest !== bestLevelRef.current) {
          setHighScore(newHigh);
          setBestLevel(newBest);
          persistScores(newHigh, newBest);
        }
        setPhase("levelComplete");
      }
    }

    render(ctx, state);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [persistScores]);

  // Start the game on mount
  useEffect(() => {
    gameRef.current = newGameState(1, MAX_LIVES, 0, "vertical", "smooth");
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameLoop]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const startNewGame = useCallback(() => {
    gameRef.current = newGameState(1, MAX_LIVES, 0, orientation, ballMode);
    setLevel(1);
    setLives(MAX_LIVES);
    setScore(0);
    setPercentCleared(0);
    setPhase("playing");
  }, [orientation, ballMode]);

  const startNextLevel = useCallback(() => {
    const state = gameRef.current;
    if (!state) return;
    const nextLevel = state.level + 1;
    gameRef.current = newGameState(nextLevel, state.lives, state.score, orientation, ballMode);
    setLevel(nextLevel);
    setPercentCleared(0);
    setPhase("playing");
  }, [orientation, ballMode]);

  const toggleOrientation = useCallback(() => {
    setOrientation((prev) => {
      const next: Orientation = prev === "horizontal" ? "vertical" : "horizontal";
      if (gameRef.current) gameRef.current.orientation = next;
      return next;
    });
  }, []);

  const setBallModeAndRemap = useCallback((mode: BallMode) => {
    setBallMode(mode);
    const state = gameRef.current;
    if (!state) return;
    state.ballMode = mode;
    if (mode === "diagonal") {
      const speed = ballSpeedForLevel(state.level);
      for (const ball of state.balls) {
        ball.vx = (ball.vx >= 0 ? 1 : -1) * speed;
        ball.vy = (ball.vy >= 0 ? 1 : -1) * speed;
      }
    }
  }, []);

  // ── Pointer / wall-building input ───────────────────────────────────────────

  const getCanvasPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = gameRef.current;
    if (!state || state.phase !== "playing" || state.buildingWall) return;

    const point = getCanvasPoint(e.clientX, e.clientY);
    if (!point) return;

    const col = Math.floor(point.x / CELL);
    const row = Math.floor(point.y / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    if (state.grid[cellIndex(col, row)] !== OPEN) return;

    startWall(state, col, row, state.orientation);
  }, [getCanvasPoint]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    toggleOrientation();
  }, [toggleOrientation]);

  // ── Window menu ──────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "Game",
      items: [
        { label: "New Game", onClick: startNewGame },
        ...(onQuit ? [{ separator: true as const }, { label: "Quit", onClick: onQuit }] : []),
      ],
    },
    {
      label: "Options",
      items: [
        { label: "Smooth Movement", checked: ballMode === "smooth", onClick: () => setBallModeAndRemap("smooth") },
        { label: "Diagonal Movement", checked: ballMode === "diagonal", onClick: () => setBallModeAndRemap("diagonal") },
      ],
    },
  ], [startNewGame, onQuit, ballMode, setBallModeAndRemap]);
  useWindowMenus(menus);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="jzb">
      <div className="jzb__hud">
        <span className="jzb__hud-item">LEVEL {level}</span>
        <span className="jzb__hud-item jzb__hud-lives">{"♥".repeat(lives)}{"♡".repeat(MAX_LIVES - lives)}</span>
        <span className="jzb__hud-item">SCORE {score}</span>
        <span className="jzb__hud-item">{Math.floor(percentCleared)}% / {TARGET_PERCENT}%</span>
        <span className="jzb__hud-item">HI {highScore}</span>
      </div>

      <div className="jzb__game-wrapper">
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="jzb__canvas"
          onPointerDown={handlePointerDown}
          onContextMenu={handleContextMenu}
        />

        {phase === "levelComplete" && (
          <div className="jzb__overlay">
            <div className="jzb__overlay-title">LEVEL {level} COMPLETE!</div>
            <div className="jzb__overlay-sub">{Math.floor(percentCleared)}% cleared</div>
            <button className="jzb__btn" onClick={startNextLevel}>NEXT LEVEL</button>
          </div>
        )}

        {phase === "gameOver" && (
          <div className="jzb__overlay">
            <div className="jzb__overlay-title jzb__overlay-title--dead">GAME OVER</div>
            <div className="jzb__overlay-sub">Score {score} &middot; Level {level}</div>
            {bestLevel > 1 && <div className="jzb__overlay-sub">Best Level {bestLevel}</div>}
            <button className="jzb__btn" onClick={startNewGame}>NEW GAME</button>
          </div>
        )}
      </div>

      <div className="jzb__controls">
        <button
          className="jzb__toggle-btn"
          onClick={toggleOrientation}
          aria-label={orientation === "horizontal" ? "Switch to vertical walls" : "Switch to horizontal walls"}
          title="Toggle wall orientation (or right-click the board)"
        >
          {orientation === "horizontal" ? "↔️" : "↕️"}
        </button>
        <span className="jzb__controls-hint">
          Click the board to build a wall &middot; right-click or tap the button to change direction
        </span>
      </div>
    </div>
  );
}
