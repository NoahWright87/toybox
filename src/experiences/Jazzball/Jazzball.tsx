import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { JB_SCORES_ID } from "../NsDoors97/filesystem/types";
import "./Jazzball.css";

// ─── Constants ───────────────────────────────────────────────────────────────

const CW = 480;
const CH = 320;
const BORDER = 10;
const BALL_RADIUS = 6;
const WALL_HALF_THICKNESS = 2;
const WALL_SPEED = 220; // px / second
const TARGET_PERCENT = 75;
const MAX_LIVES = 3;
const INITIAL_BALLS = 2;
const BALL_BASE_SPEED = 70; // px / second
const BALL_SPEED_STEP = 8;
const MIN_GAP = BALL_RADIUS + 4;

// ─── Types ───────────────────────────────────────────────────────────────────

type Orientation = "horizontal" | "vertical";
type Phase = "playing" | "levelComplete" | "gameOver";

interface Region {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  regionId: number;
}

interface BuildingWall {
  orientation: Orientation;
  regionId: number;
  fixed: number;   // constant coordinate of the wall line (y for horizontal, x for vertical)
  extent1: number; // grows down/toward region's min bound on the growth axis
  extent2: number; // grows up/toward region's max bound on the growth axis
  done1: boolean;
  done2: boolean;
}

interface GameState {
  regions: Map<number, Region>;
  filledRegions: Region[];
  balls: Ball[];
  buildingWall: BuildingWall | null;
  orientation: Orientation;
  lives: number;
  level: number;
  score: number;
  percentCleared: number;
  phase: Phase;
  nextRegionId: number;
  flashTimer: number;
  lastFrameTime: number;
}

interface ScoresData {
  highScore: number;
  bestLevel: number;
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function totalArea(): number {
  return (CW - 2 * BORDER) * (CH - 2 * BORDER);
}

function ballSpeedForLevel(level: number): number {
  return BALL_BASE_SPEED + (level - 1) * BALL_SPEED_STEP;
}

function spawnBalls(region: Region, count: number, speed: number, regionId: number): Ball[] {
  const balls: Ball[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    balls.push({
      x: region.x + BALL_RADIUS + Math.random() * Math.max(1, region.w - 2 * BALL_RADIUS),
      y: region.y + BALL_RADIUS + Math.random() * Math.max(1, region.h - 2 * BALL_RADIUS),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      regionId,
    });
  }
  return balls;
}

function newGameState(level: number, lives: number, score: number, orientation: Orientation): GameState {
  const region: Region = { id: 0, x: BORDER, y: BORDER, w: CW - 2 * BORDER, h: CH - 2 * BORDER };
  const regions = new Map<number, Region>([[0, region]]);
  const ballCount = INITIAL_BALLS + (level - 1);
  const balls = spawnBalls(region, ballCount, ballSpeedForLevel(level), 0);
  return {
    regions,
    filledRegions: [],
    balls,
    buildingWall: null,
    orientation,
    lives,
    level,
    score,
    percentCleared: 0,
    phase: "playing",
    nextRegionId: 1,
    flashTimer: 0,
    lastFrameTime: performance.now(),
  };
}

function wallHitsBall(wall: BuildingWall, ball: Ball): boolean {
  const r = BALL_RADIUS + WALL_HALF_THICKNESS;
  if (wall.orientation === "horizontal") {
    if (Math.abs(ball.y - wall.fixed) > r) return false;
    return ball.x >= wall.extent1 - r && ball.x <= wall.extent2 + r;
  }
  if (Math.abs(ball.x - wall.fixed) > r) return false;
  return ball.y >= wall.extent1 - r && ball.y <= wall.extent2 + r;
}

// Grows the active wall, checks for ball collisions, and finalizes a region
// split once both ends reach the bounds of the region they're growing in.
function advanceWall(state: GameState, dt: number): void {
  const wall = state.buildingWall;
  if (!wall) return;
  const region = state.regions.get(wall.regionId);
  if (!region) { state.buildingWall = null; return; }

  const delta = WALL_SPEED * dt;
  if (!wall.done1) {
    const bound = wall.orientation === "horizontal" ? region.x : region.y;
    wall.extent1 -= delta;
    if (wall.extent1 <= bound) { wall.extent1 = bound; wall.done1 = true; }
  }
  if (!wall.done2) {
    const bound = wall.orientation === "horizontal" ? region.x + region.w : region.y + region.h;
    wall.extent2 += delta;
    if (wall.extent2 >= bound) { wall.extent2 = bound; wall.done2 = true; }
  }

  for (const ball of state.balls) {
    if (ball.regionId !== wall.regionId) continue;
    if (wallHitsBall(wall, ball)) {
      state.buildingWall = null;
      state.lives -= 1;
      state.flashTimer = 0.4;
      if (state.lives <= 0) state.phase = "gameOver";
      return;
    }
  }

  if (wall.done1 && wall.done2) {
    completeWall(state, wall, region);
  }
}

function completeWall(state: GameState, wall: BuildingWall, region: Region): void {
  state.buildingWall = null;

  let regionA: Region;
  let regionB: Region;
  if (wall.orientation === "horizontal") {
    regionA = { id: state.nextRegionId++, x: region.x, y: region.y, w: region.w, h: wall.fixed - region.y };
    regionB = { id: state.nextRegionId++, x: region.x, y: wall.fixed, w: region.w, h: (region.y + region.h) - wall.fixed };
  } else {
    regionA = { id: state.nextRegionId++, x: region.x, y: region.y, w: wall.fixed - region.x, h: region.h };
    regionB = { id: state.nextRegionId++, x: wall.fixed, y: region.y, w: (region.x + region.w) - wall.fixed, h: region.h };
  }

  state.regions.delete(region.id);

  for (const candidate of [regionA, regionB]) {
    if (candidate.w <= 0 || candidate.h <= 0) continue;
    const ballsInside = state.balls.filter(
      (b) => b.regionId === region.id
        && b.x >= candidate.x && b.x <= candidate.x + candidate.w
        && b.y >= candidate.y && b.y <= candidate.y + candidate.h,
    );
    if (ballsInside.length === 0) {
      state.filledRegions.push(candidate);
    } else {
      state.regions.set(candidate.id, candidate);
      for (const b of ballsInside) b.regionId = candidate.id;
    }
  }

  const filledArea = state.filledRegions.reduce((sum, r) => sum + r.w * r.h, 0);
  state.percentCleared = (filledArea / totalArea()) * 100;
  if (state.percentCleared >= TARGET_PERCENT) {
    state.score += Math.round(state.percentCleared);
    state.phase = "levelComplete";
  }
}

function moveBalls(state: GameState, dt: number): void {
  for (const ball of state.balls) {
    const region = state.regions.get(ball.regionId);
    if (!region) continue;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - BALL_RADIUS < region.x) { ball.x = region.x + BALL_RADIUS; ball.vx = Math.abs(ball.vx); }
    if (ball.x + BALL_RADIUS > region.x + region.w) { ball.x = region.x + region.w - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - BALL_RADIUS < region.y) { ball.y = region.y + BALL_RADIUS; ball.vy = Math.abs(ball.vy); }
    if (ball.y + BALL_RADIUS > region.y + region.h) { ball.y = region.y + region.h - BALL_RADIUS; ball.vy = -Math.abs(ball.vy); }
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────────

function drawBevel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, raised: boolean): void {
  ctx.fillStyle = raised ? "#ffcc88" : "#3a1a5e";
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = raised ? "#664400" : "#0c0418";
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Outer frame
  ctx.fillStyle = "#180800";
  ctx.fillRect(0, 0, CW, CH);

  // Play field
  ctx.fillStyle = "#1a0a2e";
  ctx.fillRect(BORDER, BORDER, CW - 2 * BORDER, CH - 2 * BORDER);
  drawBevel(ctx, BORDER, BORDER, CW - 2 * BORDER, CH - 2 * BORDER, false);

  // Captured area
  for (const r of state.filledRegions) {
    ctx.fillStyle = "#7b3dbe";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (r.w > 2 && r.h > 2) drawBevel(ctx, r.x, r.y, r.w, r.h, true);
  }

  // Building wall
  const wall = state.buildingWall;
  if (wall) {
    ctx.fillStyle = state.flashTimer > 0 ? "#ff3333" : "#ff6b00";
    if (wall.orientation === "horizontal") {
      ctx.fillRect(wall.extent1, wall.fixed - WALL_HALF_THICKNESS, wall.extent2 - wall.extent1, WALL_HALF_THICKNESS * 2);
    } else {
      ctx.fillRect(wall.fixed - WALL_HALF_THICKNESS, wall.extent1, WALL_HALF_THICKNESS * 2, wall.extent2 - wall.extent1);
    }
  }

  // Balls
  for (const ball of state.balls) {
    ctx.fillStyle = "#ff6b00";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcc88";
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, BALL_RADIUS / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Life-lost flash
  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${(state.flashTimer / 0.4) * 0.3})`;
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
    gameRef.current = newGameState(1, MAX_LIVES, 0, "vertical");
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameLoop]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const startNewGame = useCallback(() => {
    gameRef.current = newGameState(1, MAX_LIVES, 0, orientation);
    setLevel(1);
    setLives(MAX_LIVES);
    setScore(0);
    setPercentCleared(0);
    setPhase("playing");
  }, [orientation]);

  const startNextLevel = useCallback(() => {
    const state = gameRef.current;
    if (!state) return;
    const nextLevel = state.level + 1;
    gameRef.current = newGameState(nextLevel, state.lives, state.score, orientation);
    setLevel(nextLevel);
    setPercentCleared(0);
    setPhase("playing");
  }, [orientation]);

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
    const { x, y } = point;

    for (const region of state.regions.values()) {
      if (x < region.x || x > region.x + region.w || y < region.y || y > region.y + region.h) continue;

      if (state.orientation === "horizontal") {
        if (y <= region.y + MIN_GAP || y >= region.y + region.h - MIN_GAP) return;
        state.buildingWall = {
          orientation: "horizontal", regionId: region.id,
          fixed: y, extent1: x, extent2: x, done1: false, done2: false,
        };
      } else {
        if (x <= region.x + MIN_GAP || x >= region.x + region.w - MIN_GAP) return;
        state.buildingWall = {
          orientation: "vertical", regionId: region.id,
          fixed: x, extent1: y, extent2: y, done1: false, done2: false,
        };
      }
      return;
    }
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
  ], [startNewGame, onQuit]);
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
