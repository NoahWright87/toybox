import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import * as Matter from "matter-js";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import type { Board } from "./boardTypes";
import "./Pinball.css";

const SUBSTEPS = 3;
const DT = (1000 / 60) / SUBSTEPS;
const BALL_R = 10;
const SPEED_CAP = 30;
const LAUNCH_MAX_VY = 35; // base launch velocity at full charge (before launchPower multiplier)
const FLIPPER_REST_L = 0.5;
const FLIPPER_UP_L = -0.45;
const FLIPPER_REST_R = -0.5;
const FLIPPER_UP_R = 0.45;
const FLIPPER_SPEED = 18;
const TOTAL_BALLS = 3;

const CAT_BALL = 0x0001;
const CAT_WALL = 0x0002;
const CAT_BUMPER = 0x0004;
const CAT_FLIPPER = 0x0008;
const CAT_SLING = 0x0010;
const CAT_TARGET = 0x0020;
const CAT_POST = 0x0040;
const MASK_BALL = CAT_WALL | CAT_BUMPER | CAT_FLIPPER | CAT_SLING | CAT_TARGET | CAT_POST;

type Phase = "ready" | "launching" | "playing" | "dead" | "gameover";

interface FlipperState {
  body: Matter.Body;
  side: "left" | "right";
  pivotX: number;
  pivotY: number;
  length: number;
  angle: number;
  restAngle: number;
  upAngle: number;
}

interface BumperState {
  body: Matter.Body;
  x: number;
  y: number;
  r: number;
  label: string;
  lit: number;
}

interface SlingshotState {
  body: Matter.Body;
  lit: number;
}

interface TargetState {
  body: Matter.Body;
  label: string;
  hit: boolean;
}

interface GameState {
  phase: Phase;
  score: number;
  hiScore: number;
  lives: number;
  plungerCharge: number;
  bumpers: BumperState[];
  flippers: FlipperState[];
  slingshots: SlingshotState[];
  targets: TargetState[];
  bonusMultiplier: number;
}

interface Props {
  board: Board;
  onQuit?: () => void;
}

function capSpeed(ball: Matter.Body) {
  const spd = Math.hypot(ball.velocity.x, ball.velocity.y);
  if (spd > SPEED_CAP) {
    const scale = SPEED_CAP / spd;
    Matter.Body.setVelocity(ball, { x: ball.velocity.x * scale, y: ball.velocity.y * scale });
  }
}

function placeFlipper(f: FlipperState) {
  const { side, pivotX, pivotY, length, angle } = f;
  let cx: number, cy: number;
  if (side === "left") {
    cx = pivotX + (length / 2) * Math.cos(angle);
    cy = pivotY + (length / 2) * Math.sin(angle);
  } else {
    cx = pivotX - (length / 2) * Math.cos(angle);
    cy = pivotY - (length / 2) * Math.sin(angle);
  }
  Matter.Body.setPosition(f.body, { x: cx, y: cy });
  Matter.Body.setAngle(f.body, angle);
}

export default function Pinball({ board, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballRef = useRef<Matter.Body | null>(null);
  const rafRef = useRef<number>(0);
  const leftDownRef = useRef(false);
  const rightDownRef = useRef(false);
  const plungerRef = useRef(false);
  const hiScoreRef = useRef(0);
  const [showAbout, setShowAbout] = useState(false);

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "Game",
      items: [
        { label: "New Game", onClick: () => restartGame() },
        { separator: true },
        { label: "Quit", onClick: () => onQuit?.() },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "About Pinball...", onClick: () => setShowAbout(true) },
      ],
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [onQuit]);
  useWindowMenus(menus);

  const restartGame = useCallback(() => {
    const engine = engineRef.current;
    const st = stateRef.current;
    if (!engine || !st) return;

    if (ballRef.current) {
      Matter.Composite.remove(engine.world, ballRef.current);
    }
    const ball = Matter.Bodies.circle(board.ballStartX, board.ballStartY, BALL_R, {
      restitution: 0.5,
      friction: 0.01,
      frictionAir: 0.008,
      density: 0.005,
      label: "ball",
      collisionFilter: { category: CAT_BALL, mask: MASK_BALL },
    });
    Matter.Body.setStatic(ball, true);
    Matter.Composite.add(engine.world, ball);
    ballRef.current = ball;

    hiScoreRef.current = Math.max(hiScoreRef.current, st.score);
    st.phase = "ready";
    st.score = 0;
    st.lives = TOTAL_BALLS;
    st.plungerCharge = 0;
    st.bonusMultiplier = 1;
    st.hiScore = hiScoreRef.current;
    for (const b of st.bumpers) b.lit = 0;
    for (const t of st.targets) t.hit = false;
    for (const f of st.flippers) {
      f.angle = f.restAngle;
      placeFlipper(f);
    }
    leftDownRef.current = false;
    rightDownRef.current = false;
    plungerRef.current = false;
  }, [board]);

  // Build physics world once
  useEffect(() => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.2 } });
    engineRef.current = engine;

    const staticWallOpts = {
      isStatic: true,
      restitution: 0.4,
      friction: 0.1,
      collisionFilter: { category: CAT_WALL, mask: CAT_BALL },
    };

    const W = board.width;
    const H = board.height;

    // Outer boundary
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(W / 2, -6, W, 12, staticWallOpts),
      Matter.Bodies.rectangle(W / 2, H + 6, W, 12, staticWallOpts),
      Matter.Bodies.rectangle(-6, H / 2, 12, H, staticWallOpts),
      Matter.Bodies.rectangle(W + 6, H / 2, 12, H, staticWallOpts),
    ]);

    // Board walls
    for (const w of board.walls) {
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(w.x, w.y, w.w, w.h, {
          ...staticWallOpts,
          angle: w.angle ?? 0,
        })
      );
    }

    // Bumpers
    const bumperStates: BumperState[] = [];
    for (const b of board.bumpers) {
      const body = Matter.Bodies.circle(b.x, b.y, b.r, {
        isStatic: true,
        restitution: 1.5,
        friction: 0,
        label: `bumper_${b.label ?? ""}`,
        collisionFilter: { category: CAT_BUMPER, mask: CAT_BALL },
      });
      Matter.Composite.add(engine.world, body);
      bumperStates.push({ body, x: b.x, y: b.y, r: b.r, label: b.label ?? "", lit: 0 });
    }

    // Posts
    for (const p of board.posts) {
      Matter.Composite.add(engine.world,
        Matter.Bodies.circle(p.x, p.y, p.r, {
          isStatic: true,
          restitution: 0.6,
          friction: 0.05,
          collisionFilter: { category: CAT_POST, mask: CAT_BALL },
        })
      );
    }

    // Slingshots
    const slingshotStates: SlingshotState[] = [];
    for (const s of board.slingshots) {
      const body = Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, {
        isStatic: true,
        restitution: 1.2,
        friction: 0,
        angle: s.angle ?? 0,
        label: "slingshot",
        collisionFilter: { category: CAT_SLING, mask: CAT_BALL },
      });
      Matter.Composite.add(engine.world, body);
      slingshotStates.push({ body, lit: 0 });
    }

    // Targets
    const targetStates: TargetState[] = [];
    for (const t of board.targets) {
      const body = Matter.Bodies.rectangle(t.x, t.y, t.w, t.h, {
        isStatic: true,
        restitution: 0.6,
        friction: 0,
        angle: t.angle ?? 0,
        label: `target_${t.label ?? ""}`,
        collisionFilter: { category: CAT_TARGET, mask: CAT_BALL },
      });
      Matter.Composite.add(engine.world, body);
      targetStates.push({ body, label: t.label ?? "", hit: false });
    }

    // Flippers
    const flipperStates: FlipperState[] = [];
    for (const f of board.flippers) {
      const restAngle = f.side === "left" ? FLIPPER_REST_L : FLIPPER_REST_R;
      const upAngle = f.side === "left" ? FLIPPER_UP_L : FLIPPER_UP_R;
      const len = f.length;
      let cx: number, cy: number;
      if (f.side === "left") {
        cx = f.pivotX + (len / 2) * Math.cos(restAngle);
        cy = f.pivotY + (len / 2) * Math.sin(restAngle);
      } else {
        cx = f.pivotX - (len / 2) * Math.cos(restAngle);
        cy = f.pivotY - (len / 2) * Math.sin(restAngle);
      }
      const body = Matter.Bodies.rectangle(cx, cy, len, 8, {
        isStatic: true,
        restitution: 0.3,
        friction: 0.05,
        angle: restAngle,
        label: `flipper_${f.side}`,
        collisionFilter: { category: CAT_FLIPPER, mask: CAT_BALL },
      });
      Matter.Composite.add(engine.world, body);
      flipperStates.push({
        body, side: f.side,
        pivotX: f.pivotX, pivotY: f.pivotY,
        length: len,
        angle: restAngle,
        restAngle, upAngle,
      });
    }

    // Plunger lane left wall
    const pl = board.plunger;
    Matter.Composite.add(engine.world,
      Matter.Bodies.rectangle(
        pl.x - BALL_R - 6,
        (pl.topY + pl.bottomY) / 2,
        8,
        pl.bottomY - pl.topY,
        staticWallOpts
      )
    );

    // Ball (static until launched)
    const ball = Matter.Bodies.circle(board.ballStartX, board.ballStartY, BALL_R, {
      restitution: 0.5,
      friction: 0.01,
      frictionAir: 0.008,
      density: 0.005,
      label: "ball",
      collisionFilter: { category: CAT_BALL, mask: MASK_BALL },
    });
    Matter.Body.setStatic(ball, true);
    Matter.Composite.add(engine.world, ball);
    ballRef.current = ball;

    const state: GameState = {
      phase: "ready",
      score: 0,
      hiScore: 0,
      lives: TOTAL_BALLS,
      plungerCharge: 0,
      bumpers: bumperStates,
      flippers: flipperStates,
      slingshots: slingshotStates,
      targets: targetStates,
      bonusMultiplier: 1,
    };
    stateRef.current = state;

    // Collision events
    Matter.Events.on(engine, "collisionStart", (event) => {
      const st = stateRef.current;
      if (!st) return;
      for (const pair of event.pairs) {
        const ballBody = pair.bodyA.label === "ball" ? pair.bodyA
          : pair.bodyB.label === "ball" ? pair.bodyB : null;
        if (!ballBody) continue;
        const other = ballBody === pair.bodyA ? pair.bodyB : pair.bodyA;

        if (other.label.startsWith("bumper_")) {
          const idx = st.bumpers.findIndex((x) => x.body === other);
          if (idx >= 0) {
            st.bumpers[idx].lit = 8;
            st.score += 100 * st.bonusMultiplier;
          }
        } else if (other.label === "slingshot") {
          const idx = st.slingshots.findIndex((x) => x.body === other);
          if (idx >= 0) {
            st.slingshots[idx].lit = 6;
            st.score += 50 * st.bonusMultiplier;
            const nx = pair.collision.normal.x;
            const ny = pair.collision.normal.y;
            const spd = Math.hypot(ballBody.velocity.x, ballBody.velocity.y);
            const boost = Math.max(8, spd * 1.3);
            Matter.Body.setVelocity(ballBody, { x: nx * boost, y: ny * boost });
          }
        } else if (other.label.startsWith("target_")) {
          const idx = st.targets.findIndex((x) => x.body === other);
          if (idx >= 0 && !st.targets[idx].hit) {
            st.targets[idx].hit = true;
            st.score += 200 * st.bonusMultiplier;
            if (st.targets.every((t) => t.hit)) {
              st.score += 1000 * st.bonusMultiplier;
              st.bonusMultiplier = Math.min(st.bonusMultiplier + 1, 5);
              for (const t of st.targets) t.hit = false;
            }
          }
        }
      }
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      ballRef.current = null;
      stateRef.current = null;
    };
  // board is a stable JSON import — intentionally not in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = board.width;
    const H = board.height;

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const engine = engineRef.current;
      const st = stateRef.current;
      const ball = ballRef.current;
      if (!engine || !st || !ball || !ctx) return;

      // Flipper kinematics
      for (const f of st.flippers) {
        const pressing = f.side === "left" ? leftDownRef.current : rightDownRef.current;
        const target = pressing ? f.upAngle : f.restAngle;
        const diff = target - f.angle;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), FLIPPER_SPEED * (1 / 60));
        const prevAngle = f.angle;
        f.angle += step;
        placeFlipper(f);
        Matter.Body.setAngularVelocity(f.body, (f.angle - prevAngle) * 60);
      }

      // Plunger charge + move ball down with the rod
      if (st.phase === "launching" && plungerRef.current) {
        st.plungerCharge = Math.min(1, st.plungerCharge + 0.025);
        const pullMax = Math.min(36, (board.plunger.bottomY - board.ballStartY) * 0.3);
        Matter.Body.setPosition(ball, { x: board.plunger.x, y: board.ballStartY + st.plungerCharge * pullMax });
      }

      // Physics
      if (st.phase === "playing" || st.phase === "launching") {
        for (let i = 0; i < SUBSTEPS; i++) {
          Matter.Engine.update(engine, DT);
        }
        capSpeed(ball);

        // Drain check
        if (ball.position.y > H - 10) {
          st.lives -= 1;
          hiScoreRef.current = Math.max(hiScoreRef.current, st.score);
          st.hiScore = hiScoreRef.current;
          if (st.lives <= 0) {
            st.phase = "gameover";
          } else {
            st.phase = "dead";
            Matter.Body.setStatic(ball, true);
            Matter.Body.setPosition(ball, { x: board.ballStartX, y: board.ballStartY });
            Matter.Body.setVelocity(ball, { x: 0, y: 0 });
            st.plungerCharge = 0;
            setTimeout(() => {
              if (stateRef.current?.phase === "dead") stateRef.current.phase = "ready";
            }, 1200);
          }
        }

        for (const b of st.bumpers) if (b.lit > 0) b.lit--;
        for (const s of st.slingshots) if (s.lit > 0) s.lit--;
      }

      // ── Draw ──────────────────────────────────────────────────────────────

      ctx.fillStyle = "#0a0018";
      ctx.fillRect(0, 0, W, H);

      // Walls
      ctx.fillStyle = "#1a0050";
      ctx.strokeStyle = "#5030a0";
      ctx.lineWidth = 1;
      for (const w of board.walls) {
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.angle ?? 0);
        ctx.beginPath();
        ctx.rect(-w.w / 2, -w.h / 2, w.w, w.h);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Targets
      for (const t of st.targets) {
        const b = t.body;
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = t.hit ? "#333" : "#ff6b00";
        ctx.strokeStyle = t.hit ? "#555" : "#ffcc88";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(-15, -4, 30, 8);
        ctx.fill();
        ctx.stroke();
        if (!t.hit && t.label) {
          ctx.fillStyle = "#fff";
          ctx.font = "5px 'Press Start 2P'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(t.label, 0, 0);
        }
        ctx.restore();
      }

      // Slingshots
      for (const s of st.slingshots) {
        const b = s.body;
        const verts = b.vertices;
        ctx.save();
        ctx.fillStyle = s.lit > 0 ? "#ff8800" : "#5b2d8e";
        ctx.strokeStyle = s.lit > 0 ? "#ffcc44" : "#9060d0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Bumpers
      for (const bmp of st.bumpers) {
        const lit = bmp.lit > 0;
        const grad = ctx.createRadialGradient(bmp.x, bmp.y, 2, bmp.x, bmp.y, bmp.r);
        if (lit) {
          grad.addColorStop(0, "#fff8c0");
          grad.addColorStop(0.5, "#ffcc00");
          grad.addColorStop(1, "#cc4400");
        } else {
          grad.addColorStop(0, "#d090ff");
          grad.addColorStop(0.5, "#7b3dbe");
          grad.addColorStop(1, "#2a0060");
        }
        ctx.beginPath();
        ctx.arc(bmp.x, bmp.y, bmp.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = lit ? "#fff8a0" : "#c080ff";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (bmp.label) {
          ctx.fillStyle = lit ? "#000" : "#fff";
          ctx.font = `${Math.max(6, Math.floor(bmp.r * 0.6))}px 'Press Start 2P'`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(bmp.label, bmp.x, bmp.y);
        }
      }

      // Posts
      for (const p of board.posts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "#c0c0c0";
        ctx.fill();
        ctx.strokeStyle = "#808080";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Flippers
      for (const f of st.flippers) {
        const b = f.body;
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        const grad = ctx.createLinearGradient(-f.length / 2, 0, f.length / 2, 0);
        grad.addColorStop(0, "#a0a0a0");
        grad.addColorStop(0.5, "#ffffff");
        grad.addColorStop(1, "#606060");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.rect(-f.length / 2, -4, f.length, 8);
        ctx.fill();
        ctx.strokeStyle = "#404040";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        // Pivot
        ctx.beginPath();
        ctx.arc(f.pivotX, f.pivotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#d0d0d0";
        ctx.fill();
      }

      // Plunger lane + visual rod
      const pl = board.plunger;
      // Left divider rail between main field and plunger lane
      ctx.fillStyle = "#1a0040";
      ctx.fillRect(pl.x - BALL_R - 8, pl.topY, 6, pl.bottomY - pl.topY);

      // Plunger rod: silver rectangle below the ball that retracts as charge increases
      if (st.phase === "ready" || st.phase === "launching") {
        const rodTop = ball.position.y + BALL_R + 2;
        const rodBottom = pl.bottomY - 4;
        const rodFullH = rodBottom - rodTop;
        const rodH = rodFullH * (1 - st.plungerCharge);
        if (rodH > 1) {
          const rodY = rodBottom - rodH; // rod base is at bottom, shrinks upward as charge grows
          ctx.fillStyle = "#909090";
          ctx.fillRect(pl.x - BALL_R, rodY, BALL_R * 2, rodH);
          ctx.fillStyle = "#d0d0d0"; // left highlight
          ctx.fillRect(pl.x - BALL_R, rodY, 3, rodH);
          ctx.fillStyle = "#606060"; // right shadow
          ctx.fillRect(pl.x + BALL_R - 3, rodY, 3, rodH);
          ctx.fillStyle = "#c0c0c0"; // rod face (cap)
          ctx.fillRect(pl.x - BALL_R, rodY, BALL_R * 2, 3);
        }
      }

      // Ball
      const bx = ball.position.x;
      const by = ball.position.y;
      const ballGrad = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, BALL_R);
      ballGrad.addColorStop(0, "#ffffff");
      ballGrad.addColorStop(0.4, "#d8d8d8");
      ballGrad.addColorStop(1, "#505050");
      ctx.beginPath();
      ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Overlays
      if (st.phase === "dead") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ff6b00";
        ctx.font = "10px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("BALL LOST", W / 2, H / 2);
      }
      if (st.phase === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ff6b00";
        ctx.font = "10px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", W / 2, H / 2 - 20);
        ctx.fillStyle = "#ffd700";
        ctx.font = "7px 'Press Start 2P'";
        ctx.fillText(`SCORE: ${st.score}`, W / 2, H / 2 + 4);
        ctx.fillStyle = "#c0c0c0";
        ctx.fillText("PRESS LAUNCH", W / 2, H / 2 + 24);
      }
      if (st.phase === "ready") {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#c0c0c0";
        ctx.font = "7px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("HOLD TO CHARGE", W / 2, H - 40);
        ctx.fillText("RELEASE TO LAUNCH", W / 2, H - 26);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const st = stateRef.current;
    if (!st) return;
    if (e.key === "z" || e.key === "Z" || e.key === "ArrowLeft") {
      e.preventDefault();
      leftDownRef.current = true;
    }
    if (e.key === "/" || e.key === "ArrowRight") {
      e.preventDefault();
      rightDownRef.current = true;
    }
    if (e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      if (st.phase === "gameover") { restartGame(); return; }
      if (st.phase === "ready") { plungerRef.current = true; st.phase = "launching"; }
    }
  }, [restartGame]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    const st = stateRef.current;
    if (!st) return;
    if (e.key === "z" || e.key === "Z" || e.key === "ArrowLeft") leftDownRef.current = false;
    if (e.key === "/" || e.key === "ArrowRight") rightDownRef.current = false;
    if ((e.key === " " || e.key === "ArrowDown") && st.phase === "launching") {
      plungerRef.current = false;
      const ball = ballRef.current;
      const engine = engineRef.current;
      if (ball && engine) {
        Matter.Body.setStatic(ball, false);
        const charge = st.plungerCharge;
        st.plungerCharge = 0;
        Matter.Body.setVelocity(ball, { x: 0, y: -(Math.max(0.1, charge) * LAUNCH_MAX_VY * (board.plunger.launchPower ?? 1.0) + 4) });
        st.phase = "playing";
      }
    }
  }, []);

  const handleLeftDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    leftDownRef.current = true;
  }, []);
  const handleLeftUp = useCallback(() => { leftDownRef.current = false; }, []);

  const handleRightDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    rightDownRef.current = true;
  }, []);
  const handleRightUp = useCallback(() => { rightDownRef.current = false; }, []);

  const handleLaunchDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const st = stateRef.current;
    if (!st) return;
    if (st.phase === "gameover") { restartGame(); return; }
    if (st.phase === "ready") { plungerRef.current = true; st.phase = "launching"; }
  }, [restartGame]);

  const handleLaunchUp = useCallback(() => {
    const st = stateRef.current;
    if (!st || st.phase !== "launching") return;
    plungerRef.current = false;
    const ball = ballRef.current;
    const engine = engineRef.current;
    if (ball && engine) {
      Matter.Body.setStatic(ball, false);
      const charge = st.plungerCharge;
      st.plungerCharge = 0;
      Matter.Body.setVelocity(ball, { x: 0, y: -(charge * 18 + 4) });
      st.phase = "playing";
    }
  }, []);

  const st = stateRef.current;
  const lives = st?.lives ?? TOTAL_BALLS;
  const score = st?.score ?? 0;
  const hiScore = st?.hiScore ?? 0;

  return (
    <div
      className="pinball"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <div className="pinball__hud">
        <span>SCORE: <span className="pinball__hud-score">{score}</span></span>
        <span>BEST: <span className="pinball__hud-score">{hiScore}</span></span>
        <div className="pinball__hud-balls">
          {Array.from({ length: TOTAL_BALLS }).map((_, i) => (
            <div
              key={i}
              className={`pinball__ball-pip${i >= lives ? " pinball__ball-pip--used" : ""}`}
            />
          ))}
        </div>
      </div>
      <div className="pinball__wrap">
        <div className="pinball__canvas-wrap">
          <canvas
            ref={canvasRef}
            width={board.width}
            height={board.height}
            className="pinball__canvas"
          />
        </div>
      </div>
      <div className="pinball__touch-controls">
        <button
          className="pinball__touch-btn"
          onPointerDown={handleLeftDown}
          onPointerUp={handleLeftUp}
          onPointerCancel={handleLeftUp}
        >◀ LEFT</button>
        <button
          className="pinball__touch-btn pinball__touch-btn--launch"
          onPointerDown={handleLaunchDown}
          onPointerUp={handleLaunchUp}
          onPointerCancel={handleLaunchUp}
        >LAUNCH</button>
        <button
          className="pinball__touch-btn"
          onPointerDown={handleRightDown}
          onPointerUp={handleRightUp}
          onPointerCancel={handleRightUp}
        >RIGHT ▶</button>
      </div>
      {showAbout && (
        <div className="pinball__overlay" style={{ pointerEvents: "auto" }}>
          <div className="pinball__about-box">
            <div className="pinball__about-title">PINBALL</div>
            <div className="pinball__about-body">
              <p>Classic retro pinball.</p>
              <p>Hit bumpers, trigger slingshots,<br/>light all targets for a bonus.</p>
              <p className="pinball__about-credits">
                Powered by{" "}
                <a
                  href="/pinball-editor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pinball__about-link"
                >
                  Pinball Board Maker
                </a>
              </p>
            </div>
            <button
              className="pinball__touch-btn"
              style={{ marginTop: 8 }}
              onClick={() => setShowAbout(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
