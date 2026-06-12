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
  PICKUP_FALL_SPEED,
  POWERUP_W,
  POWERUP_H,
  COIN_RADIUS,
  POWERUP_DROP_CHANCE,
  COIN_DROP_CHANCE,
  WIDE_DURATION_MS,
  LASER_DURATION_MS,
  PIERCE_DURATION_MS,
  STICKY_DURATION_MS,
  POWERUP_CATCH_BONUS,
  LASER_FIRE_INTERVAL_MS,
  LASER_SPEED,
  LASER_W,
  LASER_H,
  ICE_SLOW_DURATION_MS,
  ICE_SLOW_FACTOR,
  generateLevel,
  isLevelClear,
  paddleBounce,
  mulberry32,
  updateBrickMotion,
  updateBrickRegen,
  triggerExplosion,
  applyHoming,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  PADDLE_COLORS,
  getPaddleColor,
  type Phase,
  type Brick,
  type Ball,
  type Paddle,
  type PowerUp,
  type PowerUpType,
  type Laser,
  type Difficulty,
  type DifficultySettings,
} from "./levelGen";
import {
  emptyUpgradeCounts,
  computeDerivedStats,
  rollShopOffers,
  rerollCost,
  parseSaveData,
  type UpgradeCounts,
  type DerivedStats,
  type ShopOffer,
  type SaveData,
} from "./upgrades";
import "./BrickBreaker.css";

interface BrickBreakerProps {
  onQuit?: () => void;
}

interface MutableState {
  bricks: Brick[];
  balls: Ball[];
  paddle: Paddle;
  pickups: PowerUp[];
  lasers: Laser[];
  ballSpeed: number;
  widePaddleUntil: number;
  laserUntil: number;
  pierceUntil: number;
  stickyUntil: number;
  lastLaserShot: number;
  stuckBalls: Ball[];
  shieldCharges: number;
  explodeCharges: number;
  awaitingLaunch: boolean;
  rng: () => number;
  nextPickupId: number;
  lastFrameTime: number;
  difficulty: DifficultySettings;
}

const PADDLE_LERP_MOUSE = 0.35;
const PADDLE_LERP_TOUCH = 0.18;
const KEYBOARD_SPEED = 360;
const LEVEL_TRANSITION_MS = 1200;
const BRICK_SCORE = 10;
const BOUNCE_LAUNCH_FRACTION = 0.35;
const MULTIBALL_SPLIT_ANGLE = (25 * Math.PI) / 180;

const RANDOM_POWERUP_TYPES: PowerUpType[] = [
  "wide",
  "multiball",
  "laser",
  "pierce",
  "sticky",
  "shield",
  "exploding-ball",
];

const PICKUP_LABELS: Record<PowerUpType, string> = {
  wide: "W",
  multiball: "M",
  laser: "L",
  pierce: "P",
  sticky: "S",
  shield: "H",
  "exploding-ball": "E",
  coin: "$",
};

const PICKUP_COLORS: Record<PowerUpType, string> = {
  wide: "#ff6b00",
  multiball: "#7b3dbe",
  laser: "#cc1100",
  pierce: "#00aaaa",
  sticky: "#33aa33",
  shield: "#cccc00",
  "exploding-ball": "#ff3300",
  coin: "#ffcc00",
};

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

function createState(
  level: number,
  rng: () => number,
  difficulty: DifficultySettings,
  derived: DerivedStats,
  paddleWidth: number
): MutableState {
  const data = generateLevel(level, rng, difficulty);
  const state: MutableState = {
    bricks: data.bricks,
    balls: [],
    paddle: {
      x: LOGICAL_W / 2 - paddleWidth / 2,
      width: paddleWidth,
      height: PADDLE_H,
      y: PADDLE_Y,
    },
    pickups: [],
    lasers: [],
    ballSpeed: data.ballSpeed,
    widePaddleUntil: 0,
    laserUntil: 0,
    pierceUntil: 0,
    stickyUntil: 0,
    lastLaserShot: 0,
    stuckBalls: [],
    shieldCharges: 0,
    explodeCharges: 0,
    awaitingLaunch: true,
    rng,
    nextPickupId: 0,
    lastFrameTime: performance.now(),
    difficulty,
  };
  const ballCount = 1 + derived.extraBalls;
  for (let i = 0; i < ballCount; i++) state.balls.push(createBall(state));
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

  const [phase, setPhase] = useState<Phase>("menu");
  const phaseRef = useRef<Phase>("menu");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(DIFFICULTIES.normal.startingLives);
  const [maxLives, setMaxLives] = useState(DIFFICULTIES.normal.startingLives);
  const maxLivesRef = useRef(DIFFICULTIES.normal.startingLives);
  const [coins, setCoins] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [bestLevel, setBestLevel] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [newHighScore, setNewHighScore] = useState(false);
  const [awaitingLaunch, setAwaitingLaunch] = useState(true);

  const [paddleColorId, setPaddleColorId] = useState<string>(PADDLE_COLORS[0].id);
  const [difficultyId, setDifficultyId] = useState<Difficulty>("normal");
  const difficultyRef = useRef<Difficulty>("normal");

  const [shopOffers, setShopOffers] = useState<ShopOffer[]>([]);
  const [rerollsUsed, setRerollsUsed] = useState(0);

  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const livesRef = useRef(DIFFICULTIES.normal.startingLives);
  const highScoreRef = useRef(0);
  const bestLevelRef = useRef(0);
  const gamesPlayedRef = useRef(0);
  const coinsRef = useRef(0);
  const upgradeCountsRef = useRef<UpgradeCounts>(emptyUpgradeCounts());
  const derivedRef = useRef<DerivedStats>(computeDerivedStats(upgradeCountsRef.current));
  const paddleColorRef = useRef<string>(PADDLE_COLORS[0].id);

  const stateRef = useRef<MutableState>(
    createState(1, mulberry32(Date.now() >>> 0), DIFFICULTIES.normal, derivedRef.current, PADDLE_BASE_W)
  );

  const paddleTargetXRef = useRef(LOGICAL_W / 2);
  const paddleCenterXRef = useRef(LOGICAL_W / 2);
  const pointerLerpRef = useRef(PADDLE_LERP_TOUCH);
  const keysRef = useRef({ left: false, right: false });

  // ── Persistence ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const content = fsStore.getFile(BB_SCORES_ID)?.content;
      const save = parseSaveData(content);
      highScoreRef.current = save.highScore;
      bestLevelRef.current = save.bestLevel;
      gamesPlayedRef.current = save.gamesPlayed;
      setHighScore(save.highScore);
      setBestLevel(save.bestLevel);
      setGamesPlayed(save.gamesPlayed);
      setPaddleColorId(save.paddleColor);
      paddleColorRef.current = save.paddleColor;
      setDifficultyId(save.difficulty);
      difficultyRef.current = save.difficulty;
    } catch {
      /* ignore */
    }
  }, []);

  const persistSave = useCallback(() => {
    try {
      const save: SaveData = {
        highScore: highScoreRef.current,
        bestLevel: bestLevelRef.current,
        gamesPlayed: gamesPlayedRef.current,
        paddleColor: paddleColorRef.current,
        difficulty: difficultyRef.current,
      };
      fsStore.writeFile(BB_SCORES_ID, JSON.stringify(save));
    } catch {
      /* ignore */
    }
  }, []);

  function maybeUpdateHighScore() {
    if (scoreRef.current > highScoreRef.current) {
      highScoreRef.current = scoreRef.current;
      setHighScore(scoreRef.current);
      setNewHighScore(true);
      persistSave();
    }
  }

  function selectPaddleColor(id: string) {
    setPaddleColorId(id);
    paddleColorRef.current = id;
    persistSave();
  }

  function selectDifficulty(id: Difficulty) {
    setDifficultyId(id);
    difficultyRef.current = id;
    persistSave();
  }

  // ── Game lifecycle ───────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    if (transitionTimeoutRef.current !== null) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    scoreRef.current = 0;
    levelRef.current = 1;
    coinsRef.current = 0;
    upgradeCountsRef.current = emptyUpgradeCounts();
    derivedRef.current = computeDerivedStats(upgradeCountsRef.current);

    const diffSettings = DIFFICULTIES[difficultyRef.current];
    livesRef.current = diffSettings.startingLives;
    maxLivesRef.current = diffSettings.startingLives;
    setScore(0);
    setLevel(1);
    setLives(livesRef.current);
    setMaxLives(maxLivesRef.current);
    setCoins(0);
    setNewHighScore(false);
    setShopOffers([]);
    setRerollsUsed(0);

    const rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    stateRef.current = createState(1, rng, diffSettings, derivedRef.current, PADDLE_BASE_W);
    paddleCenterXRef.current = LOGICAL_W / 2;
    paddleTargetXRef.current = LOGICAL_W / 2;
    setAwaitingLaunch(true);

    setPhase("playing");
    phaseRef.current = "playing";
  }, []);

  const enterShop = useCallback(() => {
    setPhase("shop");
    phaseRef.current = "shop";
    setRerollsUsed(0);
    const st = stateRef.current;
    setShopOffers(rollShopOffers(upgradeCountsRef.current, st.rng, st.difficulty));
  }, []);

  const buyUpgrade = useCallback(
    (idx: number) => {
      const offer = shopOffers[idx];
      if (!offer) return;
      if (coinsRef.current < offer.cost) return;
      if (upgradeCountsRef.current[offer.def.id] >= offer.def.maxStacks) return;

      coinsRef.current -= offer.cost;
      setCoins(coinsRef.current);

      const nextCounts: UpgradeCounts = { ...upgradeCountsRef.current };
      nextCounts[offer.def.id] += 1;
      upgradeCountsRef.current = nextCounts;
      derivedRef.current = computeDerivedStats(nextCounts);

      if (offer.def.id === "vitality") {
        livesRef.current += 1;
        maxLivesRef.current += 1;
        setLives(livesRef.current);
        setMaxLives(maxLivesRef.current);
      }

      const newOffers = [...shopOffers];
      newOffers.splice(idx, 1);
      setShopOffers(newOffers);
    },
    [shopOffers]
  );

  const rerollAllOffers = useCallback(() => {
    const st = stateRef.current;
    const cost = rerollCost(rerollsUsed, st.difficulty.priceMult);
    if (coinsRef.current < cost) return;
    coinsRef.current -= cost;
    setCoins(coinsRef.current);
    setRerollsUsed((r) => r + 1);
    setShopOffers(rollShopOffers(upgradeCountsRef.current, st.rng, st.difficulty));
  }, [rerollsUsed]);

  const continueFromShop = useCallback(() => {
    setPhase("level-transition");
    phaseRef.current = "level-transition";
    transitionTimeoutRef.current = setTimeout(() => {
      const nextLevel = levelRef.current + 1;
      levelRef.current = nextLevel;
      setLevel(nextLevel);

      const st = stateRef.current;
      const derived = derivedRef.current;
      const data = generateLevel(nextLevel, st.rng, st.difficulty);
      st.bricks = data.bricks;
      st.ballSpeed = data.ballSpeed;
      st.pickups = [];
      st.lasers = [];

      const paddleWidth = PADDLE_BASE_W + derived.paddleWidthBonus;
      st.paddle.width = paddleWidth;
      st.paddle.x = clamp(st.paddle.x, 0, LOGICAL_W - paddleWidth);

      st.balls = [];
      const ballCount = 1 + derived.extraBalls;
      for (let i = 0; i < ballCount; i++) st.balls.push(createBall(st));
      st.stuckBalls = [];
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
    const gp = gamesPlayedRef.current + 1;
    gamesPlayedRef.current = gp;
    setGamesPlayed(gp);
    if (levelRef.current > bestLevelRef.current) {
      bestLevelRef.current = levelRef.current;
      setBestLevel(levelRef.current);
    }
    persistSave();
  }, [persistSave]);

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
    if (phaseRef.current !== "playing") return;

    if (st.stuckBalls.length > 0) {
      const effectiveSpeed = st.ballSpeed * derivedRef.current.ballSpeedMultiplier;
      for (const ball of st.stuckBalls) {
        paddleBounce(ball, st.paddle, effectiveSpeed);
        st.balls.push(ball);
      }
      st.stuckBalls = [];
      return;
    }

    if (!st.awaitingLaunch || st.balls.length === 0) return;
    const effectiveSpeed = st.ballSpeed * derivedRef.current.ballSpeedMultiplier;
    const ball = st.balls[0];
    const dir = st.rng() < 0.5 ? -1 : 1;
    const vx = effectiveSpeed * BOUNCE_LAUNCH_FRACTION * dir;
    const vy = -Math.sqrt(Math.max(effectiveSpeed * effectiveSpeed - vx * vx, 0));
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
      if (phaseRef.current === "playing") {
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
        if (phaseRef.current === "playing") {
          if (stateRef.current.awaitingLaunch || stateRef.current.stuckBalls.length > 0) launchBall();
          else togglePause();
        } else if (phaseRef.current === "paused") {
          togglePause();
        } else if (phaseRef.current === "game-over") {
          resetGame();
        } else if (phaseRef.current === "menu") {
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

  // ── Brick damage / drops ─────────────────────────────────────────────────────

  function maybeDropPickups(state: MutableState, brick: Brick, derived: DerivedStats) {
    const coinChance = COIN_DROP_CHANCE * state.difficulty.coinMult + derived.dropChanceBonus;
    if (state.rng() < coinChance) {
      state.pickups.push({
        id: state.nextPickupId++,
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vy: PICKUP_FALL_SPEED,
        type: "coin",
        value: brick.maxHp === 2 ? 2 : 1,
      });
    }
    const powerupChance = POWERUP_DROP_CHANCE + derived.dropChanceBonus;
    if (state.rng() < powerupChance) {
      const type = RANDOM_POWERUP_TYPES[Math.floor(state.rng() * RANDOM_POWERUP_TYPES.length)];
      state.pickups.push({
        id: state.nextPickupId++,
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vy: PICKUP_FALL_SPEED,
        type,
      });
    }
  }

  function addScore(amount: number, derived: DerivedStats) {
    scoreRef.current += Math.round(amount * derived.scoreMultiplier);
    setScore(scoreRef.current);
    maybeUpdateHighScore();
  }

  function damageBrick(state: MutableState, brick: Brick, amount: number, derived: DerivedStats, allowExplode: boolean) {
    if (brick.hp === Infinity) return;
    brick.hp -= amount;
    addScore(BRICK_SCORE, derived);
    if (brick.hp <= 0) {
      brick.alive = false;
      maybeDropPickups(state, brick, derived);

      if (brick.explosive) {
        const destroyed = triggerExplosion(state.bricks, brick);
        for (const d of destroyed) {
          addScore(BRICK_SCORE, derived);
          maybeDropPickups(state, d, derived);
        }
      }

      if (allowExplode && state.explodeCharges > 0) {
        state.explodeCharges -= 1;
        const destroyed = triggerExplosion(state.bricks, brick);
        for (const d of destroyed) {
          addScore(BRICK_SCORE, derived);
          maybeDropPickups(state, d, derived);
        }
      }
    }
  }

  function applyPickup(state: MutableState, pickup: PowerUp, now: number) {
    switch (pickup.type) {
      case "wide":
        state.widePaddleUntil = now + WIDE_DURATION_MS;
        break;
      case "laser":
        state.laserUntil = now + LASER_DURATION_MS;
        break;
      case "pierce":
        state.pierceUntil = now + PIERCE_DURATION_MS;
        break;
      case "sticky":
        state.stickyUntil = now + STICKY_DURATION_MS;
        break;
      case "shield":
        state.shieldCharges += 1;
        break;
      case "exploding-ball":
        state.explodeCharges += 1;
        break;
      case "coin":
        coinsRef.current += pickup.value ?? 1;
        setCoins(coinsRef.current);
        break;
      case "multiball": {
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
        break;
      }
    }
  }

  function updatePickups(state: MutableState, dt: number, now: number, derived: DerivedStats) {
    const remaining: PowerUp[] = [];
    const paddle = state.paddle;
    const magnet = derived.magnetRadiusBonus;
    const px0 = paddle.x - magnet;
    const px1 = paddle.x + paddle.width + magnet;
    const py0 = paddle.y - magnet;
    const py1 = paddle.y + paddle.height + magnet;
    for (const p of state.pickups) {
      p.y += p.vy * dt;
      const halfW = p.type === "coin" ? COIN_RADIUS : POWERUP_W / 2;
      const halfH = p.type === "coin" ? COIN_RADIUS : POWERUP_H / 2;
      const overlapsPaddle =
        p.x + halfW >= px0 && p.x - halfW <= px1 && p.y + halfH >= py0 && p.y - halfH <= py1;
      if (overlapsPaddle) {
        applyPickup(state, p, now);
        if (p.type !== "coin") addScore(POWERUP_CATCH_BONUS, derived);
        continue;
      }
      if (p.y - halfH <= LOGICAL_H) remaining.push(p);
    }
    state.pickups = remaining;
  }

  function updateLasers(state: MutableState, dt: number, now: number, derived: DerivedStats) {
    if (now < state.laserUntil && now - state.lastLaserShot >= LASER_FIRE_INTERVAL_MS) {
      state.lastLaserShot = now;
      const paddle = state.paddle;
      state.lasers.push({ x: paddle.x + 4, y: paddle.y });
      state.lasers.push({ x: paddle.x + paddle.width - 4, y: paddle.y });
    }
    const remaining: Laser[] = [];
    for (const laser of state.lasers) {
      laser.y -= LASER_SPEED * dt;
      if (laser.y < -LASER_H) continue;
      let hit = false;
      for (const brick of state.bricks) {
        if (!brick.alive || brick.hp === Infinity) continue;
        if (
          laser.x >= brick.x &&
          laser.x <= brick.x + brick.w &&
          laser.y >= brick.y &&
          laser.y <= brick.y + brick.h
        ) {
          damageBrick(state, brick, 1, derived, false);
          hit = true;
          break;
        }
      }
      if (!hit) remaining.push(laser);
    }
    state.lasers = remaining;
  }

  // ── Ball physics ─────────────────────────────────────────────────────────────

  function updateBalls(state: MutableState, dt: number, now: number, derived: DerivedStats) {
    const remaining: Ball[] = [];
    const effectiveSpeed = state.ballSpeed * derived.ballSpeedMultiplier;
    for (const ball of state.balls) {
      if (derived.homing) applyHoming(ball, state.bricks, dt);

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
        if (now < state.stickyUntil) {
          ball.vx = 0;
          ball.vy = 0;
          ball.x = clamp(ball.x, paddle.x + ball.radius, paddle.x + paddle.width - ball.radius);
          ball.y = paddle.y - ball.radius;
          state.stuckBalls.push(ball);
          continue;
        }
        paddleBounce(ball, paddle, effectiveSpeed);
      }

      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        if (!circleRectCollide(ball, brick)) continue;
        const pierceActive = now < state.pierceUntil && brick.hp !== Infinity;
        if (!pierceActive) resolveBrickCollision(ball, brick);
        if (brick.ice) ball.slowUntil = now + ICE_SLOW_DURATION_MS;
        damageBrick(state, brick, 1 + derived.ballDamageBonus, derived, true);
        if (!pierceActive) break;
      }

      const targetSpeed = effectiveSpeed * (now < (ball.slowUntil ?? 0) ? ICE_SLOW_FACTOR : 1);
      const curSpeed = Math.hypot(ball.vx, ball.vy);
      if (curSpeed > 0) {
        const f = targetSpeed / curSpeed;
        ball.vx *= f;
        ball.vy *= f;
      }

      if (ball.y - ball.radius <= LOGICAL_H) remaining.push(ball);
    }
    state.balls = remaining;
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────

  function draw(now: number) {
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
      if (brick.ice) {
        ctx.fillStyle = "rgba(140,220,255,0.35)";
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      }
      if (brick.regenerating) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", brick.x + brick.w - 7, brick.y + 7);
      }
      if (brick.explosive) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("*", brick.x + 7, brick.y + 7);
      }
    }

    const paddle = state.paddle;
    const isWide = now < state.widePaddleUntil;
    const color = getPaddleColor(paddleColorRef.current);
    const isSticky = now < state.stickyUntil;
    const isLaser = now < state.laserUntil;
    ctx.fillStyle = isWide ? color.fillAlt : color.fill;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    if (isSticky || isLaser) {
      ctx.fillStyle = isSticky ? "rgba(51,170,51,0.5)" : "rgba(204,17,0,0.5)";
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    }
    ctx.strokeStyle = color.highlight;
    ctx.beginPath();
    ctx.moveTo(paddle.x, paddle.y + paddle.height);
    ctx.lineTo(paddle.x, paddle.y);
    ctx.lineTo(paddle.x + paddle.width, paddle.y);
    ctx.stroke();
    ctx.strokeStyle = color.shadow;
    ctx.beginPath();
    ctx.moveTo(paddle.x + paddle.width, paddle.y);
    ctx.lineTo(paddle.x + paddle.width, paddle.y + paddle.height);
    ctx.lineTo(paddle.x, paddle.y + paddle.height);
    ctx.stroke();

    for (const ball of state.balls) {
      ctx.fillStyle = now < (ball.slowUntil ?? 0) ? "#aaeeff" : "#ffffff";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const ball of state.stuckBalls) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ffee55";
    for (const laser of state.lasers) {
      ctx.fillRect(laser.x - LASER_W / 2, laser.y - LASER_H, LASER_W, LASER_H);
    }

    for (const p of state.pickups) {
      if (p.type === "coin") {
        ctx.fillStyle = PICKUP_COLORS.coin;
        ctx.beginPath();
        ctx.arc(p.x, p.y, COIN_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#664400";
        ctx.stroke();
        ctx.fillStyle = "#664400";
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", p.x, p.y + 1);
        continue;
      }
      ctx.fillStyle = PICKUP_COLORS[p.type];
      ctx.fillRect(p.x - POWERUP_W / 2, p.y - POWERUP_H / 2, POWERUP_W, POWERUP_H);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(p.x - POWERUP_W / 2 + 0.5, p.y - POWERUP_H / 2 + 0.5, POWERUP_W - 1, POWERUP_H - 1);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(PICKUP_LABELS[p.type], p.x, p.y + 1);
    }
  }

  // ── Game loop ────────────────────────────────────────────────────────────────

  function step(dt: number, now: number) {
    const state = stateRef.current;
    const ph = phaseRef.current;

    if (ph === "playing") {
      const derived = derivedRef.current;

      if (keysRef.current.left) paddleTargetXRef.current -= (KEYBOARD_SPEED + derived.paddleKeyboardBonus) * dt;
      if (keysRef.current.right) paddleTargetXRef.current += (KEYBOARD_SPEED + derived.paddleKeyboardBonus) * dt;

      const halfW = state.paddle.width / 2;
      paddleTargetXRef.current = clamp(paddleTargetXRef.current, halfW, LOGICAL_W - halfW);
      const lerp = pointerLerpRef.current + derived.paddleLerpBonus;
      paddleCenterXRef.current += (paddleTargetXRef.current - paddleCenterXRef.current) * Math.min(lerp, 0.9);

      const baseWidth = PADDLE_BASE_W + derived.paddleWidthBonus;
      const wideWidth = PADDLE_WIDE_W + derived.paddleWidthBonus;
      state.paddle.width = now < state.widePaddleUntil ? wideWidth : baseWidth;
      state.paddle.x = clamp(paddleCenterXRef.current - state.paddle.width / 2, 0, LOGICAL_W - state.paddle.width);

      updateBrickMotion(state.bricks, now);
      updateBrickRegen(state.bricks, dt * 1000);

      for (const ball of state.stuckBalls) {
        ball.x = clamp(ball.x, state.paddle.x + ball.radius, state.paddle.x + state.paddle.width - ball.radius);
        ball.y = state.paddle.y - ball.radius;
      }

      if (state.awaitingLaunch) {
        for (const ball of state.balls) {
          ball.x = state.paddle.x + state.paddle.width / 2;
          ball.y = state.paddle.y - ball.radius - 1;
        }
      } else {
        updateBalls(state, dt, now, derived);
        updatePickups(state, dt, now, derived);
        updateLasers(state, dt, now, derived);

        if (state.balls.length === 0 && state.stuckBalls.length === 0) {
          if (state.shieldCharges > 0) {
            state.shieldCharges -= 1;
            state.balls = [createBall(state)];
            state.awaitingLaunch = true;
            setAwaitingLaunch(true);
          } else {
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
          }
        } else if (isLevelClear(state.bricks)) {
          enterShop();
        }
      }
    }

    draw(now);
  }

  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    function frame(now: number) {
      const state = stateRef.current;
      const dt = Math.min((now - state.lastFrameTime) / 1000, 1 / 30);
      state.lastFrameTime = now;
      stepRef.current(dt, now);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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

  const livesDisplay = "♥".repeat(Math.max(lives, 0)) + "♡".repeat(Math.max(maxLives - lives, 0));
  const hintText =
    stateRef.current.stuckBalls.length > 0 ? "Tap or press Space to relaunch" : "Tap or press Space to launch";

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
          <span className="bb-hud__label">COINS</span>
          <span className="bb-hud__val bb-hud__coins">{coins}</span>
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

        {phase === "menu" && (
          <div className="bb-overlay">
            <div className="bb-panel bb-panel--menu">
              <h2 className="bb-panel__title">Brick Breaker</h2>

              <div className="bb-menu__stats">
                <div>Best Score: {highScore}</div>
                <div>Best Level: {bestLevel}</div>
                <div>Games Played: {gamesPlayed}</div>
              </div>

              <div className="bb-menu__section-title">Instructions</div>
              <p className="bb-panel__sub">
                Drag or tap to move the paddle.
                <br />
                Tap / click / space to launch the ball.
                <br />
                Break bricks, catch coins, and visit the
                shop after each level to buy permanent
                upgrades. Arrow keys also move the paddle.
              </p>

              <div className="bb-menu__section-title">Paddle Color</div>
              <div className="bb-menu__swatches">
                {PADDLE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    className={`bb-swatch${paddleColorId === c.id ? " bb-swatch--active" : ""}`}
                    style={{ background: c.fill, borderColor: c.highlight }}
                    title={c.label}
                    onClick={() => selectPaddleColor(c.id)}
                  />
                ))}
              </div>

              <div className="bb-menu__section-title">Difficulty</div>
              <div className="bb-menu__difficulty">
                {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    className={`bb-btn bb-btn--option${difficultyId === d ? " bb-btn--option-active" : ""}`}
                    onClick={() => selectDifficulty(d)}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>

              <button className="bb-btn bb-btn--primary" onClick={resetGame}>
                Start Run
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

        {phase === "shop" && (
          <div className="bb-overlay">
            <div className="bb-panel bb-panel--menu">
              <h2 className="bb-panel__title">Shop</h2>
              <p className="bb-panel__sub">Coins: {coins}</p>

              <div className="bb-shop__offers">
                {shopOffers.map((offer, idx) => {
                  const owned = upgradeCountsRef.current[offer.def.id];
                  const canAfford = coins >= offer.cost;
                  return (
                    <div className="bb-shop__offer" key={offer.def.id}>
                      <div className="bb-shop__offer-icon">{offer.def.icon}</div>
                      <div className="bb-shop__offer-info">
                        <div className="bb-shop__offer-name">
                          {offer.def.name} ({owned}/{offer.def.maxStacks})
                        </div>
                        <div className="bb-shop__offer-desc">{offer.def.description}</div>
                      </div>
                      <button
                        className="bb-btn bb-shop__buy"
                        disabled={!canAfford}
                        onClick={() => buyUpgrade(idx)}
                      >
                        Buy {offer.cost}
                      </button>
                    </div>
                  );
                })}
                {shopOffers.length === 0 && <p className="bb-panel__sub">All upgrades maxed out!</p>}
              </div>

              <button
                className="bb-btn"
                disabled={coins < rerollCost(rerollsUsed, stateRef.current.difficulty.priceMult)}
                onClick={rerollAllOffers}
              >
                Reroll All ({rerollCost(rerollsUsed, stateRef.current.difficulty.priceMult)})
              </button>

              <button className="bb-btn bb-btn--primary" onClick={continueFromShop}>
                Continue
              </button>
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

        {phase === "playing" && (awaitingLaunch || stateRef.current.stuckBalls.length > 0) && (
          <div className="bb-overlay bb-overlay--transparent">
            <div className="bb-hint">{hintText}</div>
          </div>
        )}
      </div>
    </div>
  );
}
