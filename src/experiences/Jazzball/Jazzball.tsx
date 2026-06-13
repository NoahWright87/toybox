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
const FLASH_DURATION = 0.4;
const TARGET_PERCENT = 75;
const INITIAL_BALLS = 2;
const HEART_ICON_THRESHOLD = 6; // above this many max lives, show "❤️x N" instead of repeated icons

// Cell states
const OPEN = 0;
const WALL = 1;
const FILLED = 2;
const GROWING = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

type Orientation = "horizontal" | "vertical";
type Phase = "settings" | "playing" | "levelComplete" | "gameOver";
type GamePhase = "playing" | "levelComplete" | "gameOver";
type BallMode = "smooth" | "diagonal" | "random";
type Difficulty = "easy" | "normal" | "hard";
type LivesMode = "fixed3" | "ballsPlus1" | "ballsTimes2";

interface DifficultyConfig {
  label: string;
  ballRadius: number;
  wallGrowRate: number; // cells per second, per arm
  livesMode: LivesMode;
  ballMode: BallMode;
  ballBaseSpeed: number; // px / second at level 1
  ballSpeedStep: number; // px / second added per level
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: "Easy",
    ballRadius: 2,
    wallGrowRate: 60,
    livesMode: "ballsTimes2",
    ballMode: "random",
    ballBaseSpeed: 70,
    ballSpeedStep: 6,
  },
  normal: {
    label: "Normal",
    ballRadius: 4,
    wallGrowRate: 40,
    livesMode: "ballsPlus1",
    ballMode: "smooth",
    ballBaseSpeed: 95,
    ballSpeedStep: 8,
  },
  hard: {
    label: "Hard",
    ballRadius: 6,
    wallGrowRate: 25,
    livesMode: "fixed3",
    ballMode: "diagonal",
    ballBaseSpeed: 130,
    ballSpeedStep: 12,
  },
};

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard"];

const LIVES_MODE_LABEL: Record<LivesMode, string> = {
  fixed3: "3 (fixed)",
  ballsPlus1: "balls + 1",
  ballsTimes2: "balls × 2",
};

const BALL_MODE_LABEL: Record<BallMode, string> = {
  smooth: "Any angle",
  diagonal: "Pure diagonal",
  random: "Random on bounce",
};

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// One growing arm of a wall — the two arms grow independently in opposite
// directions from the origin cell, and can be shattered independently.
interface WallArm {
  front: number; // current position along the growth axis
  done: boolean;
  destroyed: boolean;
  accum: number;
  cells: Set<number>; // grid indices grown by this arm
}

interface BuildingWall {
  orientation: Orientation;
  fixed: number;     // col (vertical wall) or row (horizontal wall)
  originIdx: number; // the clicked cell, locked in immediately and permanently
  arm1: WallArm;      // grows toward 0
  arm2: WallArm;      // grows toward max
}

interface GameState {
  grid: Uint8Array;
  balls: Ball[];
  buildingWall: BuildingWall | null;
  orientation: Orientation;
  difficulty: Difficulty;
  config: DifficultyConfig;
  lives: number;
  maxLives: number;
  level: number;
  score: number;
  percentCleared: number;
  filledCount: number;
  phase: GamePhase;
  flashTimer: number;
  lastFrameTime: number;
}

interface DifficultyScores {
  highScore: number;
  bestLevel: number;
}

interface ScoresData {
  easy: DifficultyScores;
  normal: DifficultyScores;
  hard: DifficultyScores;
  lastDifficulty?: Difficulty;
}

const DEFAULT_SCORES: ScoresData = {
  easy: { highScore: 0, bestLevel: 1 },
  normal: { highScore: 0, bestLevel: 1 },
  hard: { highScore: 0, bestLevel: 1 },
};

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function totalArea(): number {
  return (COLS - 2) * (ROWS - 2);
}

function ballSpeedForLevel(config: DifficultyConfig, level: number): number {
  return config.ballBaseSpeed + (level - 1) * config.ballSpeedStep;
}

function livesForBallCount(config: DifficultyConfig, ballCount: number): number {
  switch (config.livesMode) {
    case "fixed3": return 3;
    case "ballsPlus1": return ballCount + 1;
    case "ballsTimes2": return ballCount * 2;
  }
}

function renderLives(lives: number, maxLives: number): string {
  if (maxLives <= HEART_ICON_THRESHOLD) {
    return "♥".repeat(Math.max(0, lives)) + "♡".repeat(Math.max(0, maxLives - lives));
  }
  return `❤️x${Math.max(0, lives)}`;
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

function spawnBalls(count: number, speed: number, mode: BallMode, radius: number): Ball[] {
  const balls: Ball[] = [];
  const margin = CELL + radius;
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = margin + Math.random() * (CW - 2 * margin);
      y = margin + Math.random() * (CH - 2 * margin);
      attempts++;
    } while (attempts < 20 && balls.some((b) => Math.hypot(b.x - x, b.y - y) < radius * 4));

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

function newGameState(difficulty: Difficulty, level: number, lives: number, score: number, orientation: Orientation): GameState {
  const config = DIFFICULTIES[difficulty];
  const ballCount = INITIAL_BALLS + (level - 1);
  return {
    grid: createGrid(),
    balls: spawnBalls(ballCount, ballSpeedForLevel(config, level), config.ballMode, config.ballRadius),
    buildingWall: null,
    orientation,
    difficulty,
    config,
    lives,
    maxLives: lives,
    level,
    score,
    percentCleared: 0,
    filledCount: 0,
    phase: "playing",
    flashTimer: 0,
    lastFrameTime: performance.now(),
  };
}

// GROWING cells aren't solid — balls pass through them, and any contact
// instead shatters that arm of the wall (checked separately).
function isSolid(grid: Uint8Array, col: number, row: number): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  const v = grid[cellIndex(col, row)];
  return v === WALL || v === FILLED;
}

function cellHitsBall(idx: number, ball: Ball, radius: number): boolean {
  const col = idx % COLS;
  const row = (idx - col) / COLS;
  const cx = col * CELL;
  const cy = row * CELL;
  const closestX = Math.min(Math.max(ball.x, cx), cx + CELL);
  const closestY = Math.min(Math.max(ball.y, cy), cy + CELL);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function newArm(front: number): WallArm {
  return { front, done: false, destroyed: false, accum: 0, cells: new Set<number>() };
}

function startWall(state: GameState, col: number, row: number, orientation: Orientation): void {
  const idx = cellIndex(col, row);
  if (state.grid[idx] !== OPEN) return;
  state.grid[idx] = WALL; // origin is locked in immediately and permanently
  const fixed = orientation === "vertical" ? col : row;
  const origin = orientation === "vertical" ? row : col;
  state.buildingWall = {
    orientation, fixed, originIdx: idx,
    arm1: newArm(origin),
    arm2: newArm(origin),
  };
}

// Reverts an arm's grown cells back to open space and costs one life.
function destroyArm(state: GameState, arm: WallArm): void {
  for (const idx of arm.cells) state.grid[idx] = OPEN;
  arm.cells.clear();
  arm.destroyed = true;
  state.lives -= 1;
  state.flashTimer = FLASH_DURATION;
  if (state.lives <= 0) state.phase = "gameOver";
}

function completeWall(state: GameState, wall: BuildingWall): void {
  state.filledCount += 1 + wall.arm1.cells.size + wall.arm2.cells.size;
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

// Grows one arm of the wall by one or more cells (depending on dt), marking
// new cells as GROWING. Once the arm reaches a non-open cell, all of its
// cells lock in as permanent WALL.
function growArm(state: GameState, wall: BuildingWall, arm: WallArm, direction: 1 | -1): void {
  if (arm.done || arm.destroyed) return;
  const maxFront = wall.orientation === "vertical" ? ROWS - 1 : COLS - 1;

  while (!arm.done) {
    const candidate = arm.front + direction;
    const idx = wall.orientation === "vertical" ? cellIndex(wall.fixed, candidate) : cellIndex(candidate, wall.fixed);
    if (candidate < 0 || candidate > maxFront || state.grid[idx] !== OPEN) { arm.done = true; break; }
    if (arm.accum < 1) break;
    arm.front = candidate;
    state.grid[idx] = GROWING;
    arm.cells.add(idx);
    arm.accum -= 1;
  }

  if (arm.done) {
    for (const idx of arm.cells) state.grid[idx] = WALL;
  }
}

// A growing arm shatters the moment any ball touches any of its cells —
// including cells already grown ("the flat side"), not just the leading tip.
function armIsHit(state: GameState, arm: WallArm): boolean {
  if (arm.done || arm.destroyed || arm.cells.size === 0) return false;
  for (const idx of arm.cells) {
    for (const ball of state.balls) {
      if (cellHitsBall(idx, ball, state.config.ballRadius)) return true;
    }
  }
  return false;
}

// Grows both arms of the active wall, shatters either arm independently if
// a ball touches it, and finalizes the wall once both arms are done/destroyed.
function advanceWall(state: GameState, dt: number): void {
  const wall = state.buildingWall;
  if (!wall) return;

  const rate = state.config.wallGrowRate;
  wall.arm1.accum += rate * dt;
  wall.arm2.accum += rate * dt;
  growArm(state, wall, wall.arm1, -1);
  growArm(state, wall, wall.arm2, 1);

  if (armIsHit(state, wall.arm1)) destroyArm(state, wall.arm1);
  if (state.phase !== "playing") return;
  if (armIsHit(state, wall.arm2)) destroyArm(state, wall.arm2);
  if (state.phase !== "playing") return;

  const arm1Resolved = wall.arm1.done || wall.arm1.destroyed;
  const arm2Resolved = wall.arm2.done || wall.arm2.destroyed;
  if (arm1Resolved && arm2Resolved) {
    completeWall(state, wall);
  }
}

function moveBalls(state: GameState, dt: number): void {
  const radius = state.config.ballRadius;
  for (const ball of state.balls) {
    let nx = ball.x + ball.vx * dt;
    let ny = ball.y + ball.vy * dt;
    let bounced = false;

    const edgeX = ball.vx > 0 ? nx + radius : nx - radius;
    const rowForX = Math.floor(ball.y / CELL);
    const colX = Math.floor(edgeX / CELL);
    if (isSolid(state.grid, colX, rowForX)) {
      ball.vx = -ball.vx;
      nx = ball.x;
      bounced = true;
    }

    const edgeY = ball.vy > 0 ? ny + radius : ny - radius;
    const colForY = Math.floor(nx / CELL);
    const rowY = Math.floor(edgeY / CELL);
    if (isSolid(state.grid, colForY, rowY)) {
      ball.vy = -ball.vy;
      ny = ball.y;
      bounced = true;
    }

    // Random mode: every bounce kicks the ball off at a fresh, unpredictable
    // angle (within +/-45 degrees of the reflected direction) instead of a
    // clean mirror reflection.
    if (bounced && state.config.ballMode === "random") {
      const speed = Math.hypot(ball.vx, ball.vy);
      const angle = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * (Math.PI / 2);
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }

    ball.x = nx;
    ball.y = ny;
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────────

function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const pulse = Math.sin(state.lastFrameTime / 80) > 0;
  const growingColor = state.flashTimer > 0 ? "#ff3333" : pulse ? "#ffcc66" : "#ff6b00";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const v = state.grid[cellIndex(col, row)];
      ctx.fillStyle = v === FILLED ? "#7b3dbe" : v === WALL ? "#ff6b00" : v === GROWING ? growingColor : "#1a0a2e";
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }

  for (const ball of state.balls) {
    ctx.fillStyle = "#ff6b00";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, state.config.ballRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${(state.flashTimer / FLASH_DURATION) * 0.3})`;
    ctx.fillRect(0, 0, CW, CH);
  }
}

// ─── Scores persistence ────────────────────────────────────────────────────────

function parseScores(content: string | undefined): ScoresData {
  if (!content) return { ...DEFAULT_SCORES };
  try {
    const data = JSON.parse(content) as Partial<ScoresData> & { highScore?: number; bestLevel?: number };
    // Migrate old single-difficulty format ({highScore, bestLevel}) into "normal".
    if (typeof data.highScore === "number" && !data.easy && !data.normal && !data.hard) {
      return {
        ...DEFAULT_SCORES,
        normal: { highScore: data.highScore, bestLevel: data.bestLevel ?? 1 },
      };
    }
    return {
      easy: { ...DEFAULT_SCORES.easy, ...(data.easy ?? {}) },
      normal: { ...DEFAULT_SCORES.normal, ...(data.normal ?? {}) },
      hard: { ...DEFAULT_SCORES.hard, ...(data.hard ?? {}) },
      lastDifficulty: data.lastDifficulty,
    };
  } catch {
    return { ...DEFAULT_SCORES };
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
  const [phase, setPhase] = useState<Phase>("settings");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [score, setScore] = useState(0);
  const [percentCleared, setPercentCleared] = useState(0);
  const [scores, setScores] = useState<ScoresData>(DEFAULT_SCORES);

  const scoresRef = useRef(scores);
  useEffect(() => { scoresRef.current = scores; }, [scores]);

  // Load saved scores from the filesystem on mount
  useEffect(() => {
    const content = fsStore.getFile(JB_SCORES_ID)?.content;
    const loaded = parseScores(content);
    setScores(loaded);
    if (loaded.lastDifficulty) setDifficulty(loaded.lastDifficulty);
  }, []);

  const persistScores = useCallback((newScores: ScoresData) => {
    try {
      fsStore.writeFile(JB_SCORES_ID, JSON.stringify(newScores));
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
        const prev = scoresRef.current[state.difficulty];
        if (state.score > prev.highScore) {
          const next: ScoresData = { ...scoresRef.current, [state.difficulty]: { ...prev, highScore: state.score } };
          setScores(next);
          persistScores(next);
        }
        setPhase("gameOver");
      } else if (phaseAfter === "levelComplete") {
        const prev = scoresRef.current[state.difficulty];
        const newHigh = Math.max(prev.highScore, state.score);
        const newBest = Math.max(prev.bestLevel, state.level);
        if (newHigh !== prev.highScore || newBest !== prev.bestLevel) {
          const next: ScoresData = { ...scoresRef.current, [state.difficulty]: { highScore: newHigh, bestLevel: newBest } };
          setScores(next);
          persistScores(next);
        }
        setPhase("levelComplete");
      }
    }

    render(ctx, state);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [persistScores]);

  // Run the game loop whenever a game is in progress (not on the settings screen)
  useEffect(() => {
    if (phase === "settings") return;
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, gameLoop]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const startNewGame = useCallback((diff: Difficulty) => {
    const config = DIFFICULTIES[diff];
    const initLives = livesForBallCount(config, INITIAL_BALLS);
    gameRef.current = newGameState(diff, 1, initLives, 0, orientation);
    setDifficulty(diff);
    setLevel(1);
    setLives(initLives);
    setMaxLives(initLives);
    setScore(0);
    setPercentCleared(0);
    setPhase("playing");

    const next: ScoresData = { ...scoresRef.current, lastDifficulty: diff };
    if (next.lastDifficulty !== scoresRef.current.lastDifficulty) {
      setScores(next);
      persistScores(next);
    }
  }, [orientation, persistScores]);

  const startNextLevel = useCallback(() => {
    const state = gameRef.current;
    if (!state) return;
    const nextLevel = state.level + 1;
    const ballCount = INITIAL_BALLS + (nextLevel - 1);
    const nextLives = state.config.livesMode === "fixed3" ? state.lives : livesForBallCount(state.config, ballCount);
    gameRef.current = newGameState(state.difficulty, nextLevel, nextLives, state.score, orientation);
    setLevel(nextLevel);
    setLives(nextLives);
    setMaxLives(nextLives);
    setPercentCleared(0);
    setPhase("playing");
  }, [orientation]);

  const returnToSettings = useCallback(() => {
    gameRef.current = null;
    setPhase("settings");
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation((prev) => {
      const next: Orientation = prev === "horizontal" ? "vertical" : "horizontal";
      if (gameRef.current) gameRef.current.orientation = next;
      return next;
    });
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
        ...(phase !== "settings" ? [{ label: "New Game", onClick: () => startNewGame(difficulty) }] : []),
        { label: "Change Difficulty...", onClick: returnToSettings },
        ...(onQuit ? [{ separator: true as const }, { label: "Quit", onClick: onQuit }] : []),
      ],
    },
  ], [phase, difficulty, startNewGame, returnToSettings, onQuit]);
  useWindowMenus(menus);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase === "settings") {
    return (
      <div className="jzb">
        <div className="jzb-launcher">
          <div className="jzb-launcher__title">Select Difficulty</div>
          {DIFFICULTY_ORDER.map((diff) => {
            const config = DIFFICULTIES[diff];
            const diffScores = scores[diff];
            return (
              <div key={diff} className="jzb-launcher__option">
                <div className="jzb-launcher__option-header">
                  <span className="jzb-launcher__option-label">{config.label}</span>
                  <span className="jzb-launcher__option-hi">HI {diffScores.highScore} &middot; LVL {diffScores.bestLevel}</span>
                </div>
                <div className="jzb-launcher__option-stats">
                  <span>Ball size: {config.ballRadius * 2}px</span>
                  <span>Wall speed: {config.wallGrowRate}/s</span>
                  <span>Lives: {LIVES_MODE_LABEL[config.livesMode]}</span>
                  <span>Bounce: {BALL_MODE_LABEL[config.ballMode]}</span>
                  <span>Ball speed: {config.ballBaseSpeed}px/s</span>
                </div>
                <button className="jzb-launcher__btn" onClick={() => startNewGame(diff)}>
                  Play {config.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="jzb">
      <div className="jzb__hud jzb__hud--top">
        <span className="jzb__hud-item jzb__hud-level">LVL {level}</span>
        <span className="jzb__hud-item jzb__hud-lives">{renderLives(lives, maxLives)}</span>
        <span className="jzb__hud-item jzb__hud-percent">{Math.floor(percentCleared)}% / {TARGET_PERCENT}%</span>
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
            {scores[difficulty].bestLevel > 1 && <div className="jzb__overlay-sub">Best Level {scores[difficulty].bestLevel}</div>}
            <button className="jzb__btn" onClick={() => startNewGame(difficulty)}>NEW GAME</button>
            <button className="jzb__btn jzb__btn--secondary" onClick={returnToSettings}>CHANGE DIFFICULTY</button>
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

      <div className="jzb__hud jzb__hud--bottom">
        <span className="jzb__hud-item">SCORE {score}</span>
        <span className="jzb__hud-item">HI {scores[difficulty].highScore}</span>
      </div>
    </div>
  );
}
