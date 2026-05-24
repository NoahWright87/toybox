import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as Matter from "matter-js";
import type {
  Board, BoardWall, BoardBumper, BoardPost, BoardFlipper,
  BoardSlingshot, BoardTarget,
} from "../Pinball/boardTypes";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import Pinball from "../Pinball/Pinball";
import classicBoard from "../Pinball/boards/classic.json";
import "./PinballEditor.css";

const LS_KEY = "pinball_editor_board";
const HANDLE_R = 9;
const SNAP = 4;
const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const BALL_R = 10; // matches game physics

// ── Types ─────────────────────────────────────────────────────────────────────

type Tool = "select" | "wall" | "bumper" | "post" | "flipper-l" | "flipper-r"
  | "slingshot" | "target" | "delete";

type SelKind = "wall" | "bumper" | "post" | "flipper" | "slingshot" | "target" | "plunger";
interface SelItem { kind: SelKind; idx: number; }

interface ViewXform { x: number; y: number; scale: number; }

type HandleKind = "nw" | "ne" | "sw" | "se" | "rotate" | "radius";
interface Handle { kind: HandleKind; bx: number; by: number; }

interface DragState {
  type: "pan" | "move" | "draw" | "rubber" | "handle";
  startSX: number; startSY: number;
  startBX: number; startBY: number;
  handle?: Handle;
  origBoard?: Board;
  startViewX?: number; startViewY?: number;
}

interface ContextMenu {
  clientX: number; clientY: number;
  item: SelItem | null;
}

type TrailPoint = { x: number; y: number };
type GhostTrail = TrailPoint[];

// ── Persistence ───────────────────────────────────────────────────────────────

function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Board;
  } catch { /* ignore */ }
  return classicBoard as Board;
}

function saveBoard(b: Board) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(b)); } catch { /* ignore */ }
}

function exportBoard(b: Board) {
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "pinball-board.json"; a.click();
  URL.revokeObjectURL(url);
}

// ── Coord helpers ─────────────────────────────────────────────────────────────

function snap(v: number) { return Math.round(v / SNAP) * SNAP; }

function b2s(bx: number, by: number, v: ViewXform): [number, number] {
  return [bx * v.scale + v.x, by * v.scale + v.y];
}

function s2b(sx: number, sy: number, v: ViewXform): [number, number] {
  return [(sx - v.x) / v.scale, (sy - v.y) / v.scale];
}

// ── Hit testing ───────────────────────────────────────────────────────────────

function hitTest(board: Board, bx: number, by: number): SelItem | null {
  // Plunger lane (non-deletable)
  const pl = board.plunger;
  if (bx >= pl.x - 15 && bx <= pl.x + 10 && by >= pl.topY && by <= pl.bottomY)
    return { kind: "plunger", idx: 0 };

  for (let i = board.flippers.length - 1; i >= 0; i--) {
    const f = board.flippers[i];
    if (Math.hypot(bx - f.pivotX, by - f.pivotY) < 12) return { kind: "flipper", idx: i };
    const ra = f.side === "left" ? 0.5 : -0.5;
    const cos = Math.cos(-ra), sin = Math.sin(-ra);
    const dx = bx - f.pivotX, dy = by - f.pivotY;
    const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
    if (f.side === "left") {
      if (lx >= -4 && lx <= f.length + 4 && ly >= -8 && ly <= 8) return { kind: "flipper", idx: i };
    } else {
      if (lx >= -f.length - 4 && lx <= 4 && ly >= -8 && ly <= 8) return { kind: "flipper", idx: i };
    }
  }
  for (let i = board.bumpers.length - 1; i >= 0; i--) {
    if (Math.hypot(bx - board.bumpers[i].x, by - board.bumpers[i].y) <= board.bumpers[i].r + 4)
      return { kind: "bumper", idx: i };
  }
  for (let i = board.posts.length - 1; i >= 0; i--) {
    if (Math.hypot(bx - board.posts[i].x, by - board.posts[i].y) <= board.posts[i].r + 6)
      return { kind: "post", idx: i };
  }
  for (let i = board.slingshots.length - 1; i >= 0; i--) {
    const sl = board.slingshots[i];
    const a = sl.angle ?? 0;
    const dx = bx - sl.x, dy = by - sl.y;
    const lx = dx * Math.cos(-a) - dy * Math.sin(-a);
    const ly = dx * Math.sin(-a) + dy * Math.cos(-a);
    if (Math.abs(lx) <= sl.w / 2 + 4 && Math.abs(ly) <= sl.h / 2 + 4) return { kind: "slingshot", idx: i };
  }
  for (let i = board.targets.length - 1; i >= 0; i--) {
    const t = board.targets[i];
    const a = t.angle ?? 0;
    const dx = bx - t.x, dy = by - t.y;
    const lx = dx * Math.cos(-a) - dy * Math.sin(-a);
    const ly = dx * Math.sin(-a) + dy * Math.cos(-a);
    if (Math.abs(lx) <= t.w / 2 + 4 && Math.abs(ly) <= t.h / 2 + 4) return { kind: "target", idx: i };
  }
  for (let i = board.walls.length - 1; i >= 0; i--) {
    const w = board.walls[i];
    const a = w.angle ?? 0;
    const dx = bx - w.x, dy = by - w.y;
    const lx = dx * Math.cos(-a) - dy * Math.sin(-a);
    const ly = dx * Math.sin(-a) + dy * Math.cos(-a);
    if (Math.abs(lx) <= w.w / 2 + 4 && Math.abs(ly) <= w.h / 2 + 4) return { kind: "wall", idx: i };
  }
  return null;
}

function selectAllInBand(board: Board, bx1: number, by1: number, bx2: number, by2: number): SelItem[] {
  const x1 = Math.min(bx1, bx2), x2 = Math.max(bx1, bx2);
  const y1 = Math.min(by1, by2), y2 = Math.max(by1, by2);
  const inBox = (cx: number, cy: number) => cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
  const result: SelItem[] = [];
  board.walls.forEach((w, i) => { if (inBox(w.x, w.y)) result.push({ kind: "wall", idx: i }); });
  board.bumpers.forEach((b, i) => { if (inBox(b.x, b.y)) result.push({ kind: "bumper", idx: i }); });
  board.posts.forEach((p, i) => { if (inBox(p.x, p.y)) result.push({ kind: "post", idx: i }); });
  board.flippers.forEach((f, i) => { if (inBox(f.pivotX, f.pivotY)) result.push({ kind: "flipper", idx: i }); });
  board.slingshots.forEach((sl, i) => { if (inBox(sl.x, sl.y)) result.push({ kind: "slingshot", idx: i }); });
  board.targets.forEach((t, i) => { if (inBox(t.x, t.y)) result.push({ kind: "target", idx: i }); });
  return result;
}

// ── Handle geometry ───────────────────────────────────────────────────────────

function getHandles(board: Board, sel: SelItem[], view: ViewXform): Handle[] {
  if (sel.length !== 1) return [];
  const s = sel[0];
  if (s.kind === "wall" || s.kind === "slingshot" || s.kind === "target") {
    const el = s.kind === "wall" ? board.walls[s.idx]
      : s.kind === "slingshot" ? board.slingshots[s.idx]
      : board.targets[s.idx];
    const a = el.angle ?? 0, hw = el.w / 2, hh = el.h / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const cx = el.x, cy = el.y;
    const corner = (lx: number, ly: number): [number, number] =>
      [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca];
    const rotDist = hh + 28 / view.scale;
    return [
      { kind: "nw", bx: corner(-hw, -hh)[0], by: corner(-hw, -hh)[1] },
      { kind: "ne", bx: corner(hw, -hh)[0],  by: corner(hw, -hh)[1] },
      { kind: "sw", bx: corner(-hw, hh)[0],  by: corner(-hw, hh)[1] },
      { kind: "se", bx: corner(hw, hh)[0],   by: corner(hw, hh)[1] },
      { kind: "rotate", bx: cx + rotDist * sa, by: cy - rotDist * ca },
    ];
  }
  if (s.kind === "bumper") {
    const b = board.bumpers[s.idx];
    return [{ kind: "radius", bx: b.x + b.r, by: b.y }];
  }
  if (s.kind === "post") {
    const p = board.posts[s.idx];
    return [{ kind: "radius", bx: p.x + p.r, by: p.y }];
  }
  return [];
}

function hitHandle(handles: Handle[], bx: number, by: number, view: ViewXform): Handle | null {
  const thresh = HANDLE_R / view.scale;
  for (const h of handles) {
    if (Math.hypot(bx - h.bx, by - h.by) <= thresh) return h;
  }
  return null;
}

// ── Board mutations ───────────────────────────────────────────────────────────

function applyHandleDrag(board: Board, sel: SelItem, handle: Handle, bx: number, by: number): Board {
  if (sel.kind === "wall" || sel.kind === "slingshot" || sel.kind === "target") {
    const arrKey = sel.kind === "wall" ? "walls" : sel.kind === "slingshot" ? "slingshots" : "targets";
    const arr = board[arrKey] as (BoardWall | BoardSlingshot | BoardTarget)[];
    const el = arr[sel.idx];
    const a = el.angle ?? 0;
    const dx = bx - el.x, dy = by - el.y;
    if (handle.kind === "rotate") {
      const newAngle = Math.atan2(dx, -dy);
      return { ...board, [arrKey]: arr.map((e, i) => i === sel.idx ? { ...e, angle: newAngle } : e) };
    }
    const lx = dx * Math.cos(a) + dy * Math.sin(a);
    const ly = -dx * Math.sin(a) + dy * Math.cos(a);
    const newW = Math.max(8, 2 * Math.abs(lx));
    const newH = Math.max(8, 2 * Math.abs(ly));
    return { ...board, [arrKey]: arr.map((e, i) => i === sel.idx ? { ...e, w: newW, h: newH } : e) };
  }
  if (sel.kind === "bumper") {
    const b = board.bumpers[sel.idx];
    const newR = Math.max(8, Math.hypot(bx - b.x, by - b.y));
    return { ...board, bumpers: board.bumpers.map((bm, i) => i === sel.idx ? { ...bm, r: newR } : bm) };
  }
  if (sel.kind === "post") {
    const p = board.posts[sel.idx];
    const newR = Math.max(4, Math.hypot(bx - p.x, by - p.y));
    return { ...board, posts: board.posts.map((pm, i) => i === sel.idx ? { ...pm, r: newR } : pm) };
  }
  return board;
}

function moveItems(board: Board, items: SelItem[], dbx: number, dby: number): Board {
  const movedWalls = new Set<number>(items.filter(s => s.kind === "wall").map(s => s.idx));
  const movedBumpers = new Set<number>(items.filter(s => s.kind === "bumper").map(s => s.idx));
  const movedPosts = new Set<number>(items.filter(s => s.kind === "post").map(s => s.idx));
  const movedFlippers = new Set<number>(items.filter(s => s.kind === "flipper").map(s => s.idx));
  const movedSlings = new Set<number>(items.filter(s => s.kind === "slingshot").map(s => s.idx));
  const movedTargets = new Set<number>(items.filter(s => s.kind === "target").map(s => s.idx));
  const movedPlunger = items.some(s => s.kind === "plunger");
  return {
    ...board,
    walls: board.walls.map((w, i) => movedWalls.has(i) ? { ...w, x: snap(w.x + dbx), y: snap(w.y + dby) } : w),
    bumpers: board.bumpers.map((b, i) => movedBumpers.has(i) ? { ...b, x: snap(b.x + dbx), y: snap(b.y + dby) } : b),
    posts: board.posts.map((p, i) => movedPosts.has(i) ? { ...p, x: snap(p.x + dbx), y: snap(p.y + dby) } : p),
    flippers: board.flippers.map((f, i) => movedFlippers.has(i) ? { ...f, pivotX: snap(f.pivotX + dbx), pivotY: snap(f.pivotY + dby) } : f),
    slingshots: board.slingshots.map((sl, i) => movedSlings.has(i) ? { ...sl, x: snap(sl.x + dbx), y: snap(sl.y + dby) } : sl),
    targets: board.targets.map((t, i) => movedTargets.has(i) ? { ...t, x: snap(t.x + dbx), y: snap(t.y + dby) } : t),
    plunger: movedPlunger ? { ...board.plunger, x: snap(board.plunger.x + dbx) } : board.plunger,
    ballStartX: movedPlunger ? snap(board.ballStartX + dbx) : board.ballStartX,
    ballStartY: movedPlunger ? snap(board.ballStartY + dby) : board.ballStartY,
  };
}

function deleteItems(board: Board, items: SelItem[]): Board {
  // Plunger can't be deleted
  const toDelete = (k: SelKind) => new Set<number>(items.filter(s => s.kind === k).map(s => s.idx));
  return {
    ...board,
    walls: board.walls.filter((_, i) => !toDelete("wall").has(i)),
    bumpers: board.bumpers.filter((_, i) => !toDelete("bumper").has(i)),
    posts: board.posts.filter((_, i) => !toDelete("post").has(i)),
    flippers: board.flippers.filter((_, i) => !toDelete("flipper").has(i)),
    slingshots: board.slingshots.filter((_, i) => !toDelete("slingshot").has(i)),
    targets: board.targets.filter((_, i) => !toDelete("target").has(i)),
  };
}

function duplicateItem(board: Board, s: SelItem): { board: Board; newSel: SelItem } {
  const D = 12;
  if (s.kind === "wall") {
    const w = { ...board.walls[s.idx], x: board.walls[s.idx].x + D, y: board.walls[s.idx].y + D };
    return { board: { ...board, walls: [...board.walls, w] }, newSel: { kind: "wall", idx: board.walls.length } };
  }
  if (s.kind === "bumper") {
    const b = { ...board.bumpers[s.idx], x: board.bumpers[s.idx].x + D, y: board.bumpers[s.idx].y + D };
    return { board: { ...board, bumpers: [...board.bumpers, b] }, newSel: { kind: "bumper", idx: board.bumpers.length } };
  }
  if (s.kind === "post") {
    const p = { ...board.posts[s.idx], x: board.posts[s.idx].x + D, y: board.posts[s.idx].y + D };
    return { board: { ...board, posts: [...board.posts, p] }, newSel: { kind: "post", idx: board.posts.length } };
  }
  if (s.kind === "flipper") {
    const f = { ...board.flippers[s.idx], pivotX: board.flippers[s.idx].pivotX + D, pivotY: board.flippers[s.idx].pivotY + D };
    return { board: { ...board, flippers: [...board.flippers, f] }, newSel: { kind: "flipper", idx: board.flippers.length } };
  }
  if (s.kind === "slingshot") {
    const sl = { ...board.slingshots[s.idx], x: board.slingshots[s.idx].x + D, y: board.slingshots[s.idx].y + D };
    return { board: { ...board, slingshots: [...board.slingshots, sl] }, newSel: { kind: "slingshot", idx: board.slingshots.length } };
  }
  if (s.kind === "target") {
    const t = { ...board.targets[s.idx], x: board.targets[s.idx].x + D, y: board.targets[s.idx].y + D };
    return { board: { ...board, targets: [...board.targets, t] }, newSel: { kind: "target", idx: board.targets.length } };
  }
  return { board, newSel: s };
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const IconPan = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M10 16V9M10 9Q10 7 12 7Q14 7 14 9V13M14 9Q14 7 16 7Q18 7 18 9V13Q18 17 14 18L8 18Q4 18 4 14V12Q4 10 6 10Q8 10 8 11V9Q8 7 10 7"/>
  </svg>
);

const IconSelect = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <path d="M4 3L4 17L7.5 13L10.5 19L12.5 18L9.5 12L15 12Z"/>
  </svg>
);

const IconWall = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="6" width="16" height="8"/>
  </svg>
);

const IconBumper = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="10" cy="10" r="6"/>
    <circle cx="10" cy="2.5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="14" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="3" cy="14" r="1.5" fill="currentColor" stroke="none"/>
  </svg>
);

const IconPost = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <circle cx="10" cy="10" r="4"/>
    <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IconFlipperL = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 14L17 10L17 14Z"/>
    <circle cx="3" cy="14" r="2.5" fill="currentColor" stroke="none"/>
  </svg>
);

const IconFlipperR = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 14L3 10L3 14Z"/>
    <circle cx="17" cy="14" r="2.5" fill="currentColor" stroke="none"/>
  </svg>
);

const IconSlingshot = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="6" width="16" height="8" transform="rotate(-10 10 10)"/>
    <line x1="5" y1="9" x2="15" y2="9" transform="rotate(-10 10 10)" strokeDasharray="2 2"/>
  </svg>
);

const IconTarget = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="7" width="14" height="6"/>
    <line x1="10" y1="7" x2="10" y2="13"/>
    <line x1="10" y1="5" x2="10" y2="7" strokeWidth="2"/>
  </svg>
);

const IconDelete = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" stroke="currentColor" strokeWidth="2.5">
    <line x1="4" y1="4" x2="16" y2="16"/>
    <line x1="16" y1="4" x2="4" y2="16"/>
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <polygon points="4,2 18,10 4,18"/>
  </svg>
);

// ── Ghost ball simulation ─────────────────────────────────────────────────────

const GHOST_DT = 1000 / 60;
const GHOST_STEPS = 420;
const GHOST_LAUNCH_MAX_VY = 35; // must match Pinball.tsx LAUNCH_MAX_VY
const GHOST_GRAVITY = 1.2;
const GHOST_CAT_BALL = 0x0001;
const GHOST_CAT_STATIC = 0x0002;

function computeGhostTrails(board: Board, sel: SelItem): GhostTrail[] {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: GHOST_GRAVITY } });
  const W = board.width, H = board.height;

  const staticOpts = {
    isStatic: true,
    restitution: 0.4,
    friction: 0.1,
    collisionFilter: { category: GHOST_CAT_STATIC, mask: GHOST_CAT_BALL },
  };

  // Boundary walls — no bottom so balls drain out naturally
  Matter.Composite.add(engine.world, [
    Matter.Bodies.rectangle(W / 2, -6, W + 24, 12, staticOpts),
    Matter.Bodies.rectangle(-6, H / 2, 12, H, staticOpts),
    Matter.Bodies.rectangle(W + 6, H / 2, 12, H, staticOpts),
  ]);

  for (const w of board.walls)
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(w.x, w.y, w.w, w.h, { ...staticOpts, angle: w.angle ?? 0 }));
  for (const b of board.bumpers)
    Matter.Composite.add(engine.world, Matter.Bodies.circle(b.x, b.y, b.r, { ...staticOpts, restitution: 1.5, friction: 0 }));
  for (const p of board.posts)
    Matter.Composite.add(engine.world, Matter.Bodies.circle(p.x, p.y, p.r, { ...staticOpts, restitution: 0.6, friction: 0.05 }));
  for (const s of board.slingshots)
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, { ...staticOpts, angle: s.angle ?? 0, restitution: 1.2, friction: 0 }));
  for (const t of board.targets)
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(t.x, t.y, t.w, t.h, { ...staticOpts, angle: t.angle ?? 0, restitution: 0.6, friction: 0 }));

  // Flippers at rest
  for (const f of board.flippers) {
    const ra = f.side === "left" ? 0.5 : -0.5;
    const cx = f.side === "left" ? f.pivotX + (f.length / 2) * Math.cos(ra) : f.pivotX - (f.length / 2) * Math.cos(ra);
    const cy = f.pivotY + (f.length / 2) * Math.sin(ra);
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(cx, cy, f.length, 8, { ...staticOpts, angle: ra, restitution: 0.3, friction: 0.05 }));
  }

  // Plunger lane divider wall (only for non-plunger selections)
  const pl = board.plunger;
  if (sel.kind !== "plunger") {
    Matter.Composite.add(engine.world,
      Matter.Bodies.rectangle(pl.x - BALL_R - 6, (pl.topY + pl.bottomY) / 2, 8, pl.bottomY - pl.topY, staticOpts)
    );
  }

  // Element center for ring spawning
  let ecx = 0, ecy = 0;
  if (sel.kind === "wall") { ecx = board.walls[sel.idx].x; ecy = board.walls[sel.idx].y; }
  else if (sel.kind === "bumper") { ecx = board.bumpers[sel.idx].x; ecy = board.bumpers[sel.idx].y; }
  else if (sel.kind === "post") { ecx = board.posts[sel.idx].x; ecy = board.posts[sel.idx].y; }
  else if (sel.kind === "flipper") { ecx = board.flippers[sel.idx].pivotX; ecy = board.flippers[sel.idx].pivotY; }
  else if (sel.kind === "slingshot") { ecx = board.slingshots[sel.idx].x; ecy = board.slingshots[sel.idx].y; }
  else if (sel.kind === "target") { ecx = board.targets[sel.idx].x; ecy = board.targets[sel.idx].y; }
  else if (sel.kind === "plunger") { ecx = pl.x; ecy = (pl.topY + pl.bottomY) / 2; }

  const ballOpts = {
    restitution: 0.5, friction: 0.01, frictionAir: 0.008, density: 0.005,
    collisionFilter: { category: GHOST_CAT_BALL, mask: GHOST_CAT_STATIC },
  };

  interface GhostEntry { body: Matter.Body; trail: GhostTrail; alive: boolean; }
  const entries: GhostEntry[] = [];

  if (sel.kind === "plunger") {
    // Launch balls at varying charge levels to show the full range of trajectories
    const N = 14;
    for (let i = 0; i < N; i++) {
      const charge = (i + 1) / N;
      const vy = -(charge * GHOST_LAUNCH_MAX_VY * (pl.launchPower ?? 1.0) + 4);
      const body = Matter.Bodies.circle(board.ballStartX, board.ballStartY, BALL_R, ballOpts);
      Matter.Body.setVelocity(body, { x: 0, y: vy });
      Matter.Composite.add(engine.world, body);
      entries.push({ body, trail: [{ x: board.ballStartX, y: board.ballStartY }], alive: true });
    }
  } else {
    // Spawn balls in a ring aimed at the element center
    const N = 20;
    const ringR = 180;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const bx = ecx + ringR * Math.cos(angle);
      const by = ecy + ringR * Math.sin(angle);
      if (bx < -BALL_R || bx > W + BALL_R || by < -BALL_R * 3 || by > H + BALL_R) continue;
      const speed = 8 + Math.random() * 17;
      const baseAngle = Math.atan2(ecy - by, ecx - bx);
      const vx = Math.cos(baseAngle + (Math.random() - 0.5) * 0.3) * speed;
      const vy = Math.sin(baseAngle + (Math.random() - 0.5) * 0.3) * speed;
      const body = Matter.Bodies.circle(bx, by, BALL_R, ballOpts);
      Matter.Body.setVelocity(body, { x: vx, y: vy });
      Matter.Composite.add(engine.world, body);
      entries.push({ body, trail: [{ x: bx, y: by }], alive: true });
    }
  }

  // Step simulation and collect positions
  for (let step = 0; step < GHOST_STEPS; step++) {
    Matter.Engine.update(engine, GHOST_DT);
    for (const e of entries) {
      if (!e.alive) continue;
      const p = e.body.position;
      if (p.x < -BALL_R || p.x > W + BALL_R || p.y > H + BALL_R) { e.alive = false; continue; }
      if (step % 2 === 0) e.trail.push({ x: p.x, y: p.y });
    }
    if (entries.every(e => !e.alive)) break;
  }

  Matter.Engine.clear(engine);
  return entries.map(e => e.trail);
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawScene(
  ctx: CanvasRenderingContext2D,
  board: Board,
  view: ViewXform,
  selected: SelItem[],
  rubber: { bx1: number; by1: number; bx2: number; by2: number } | null,
  preview: { bx1: number; by1: number; bx2: number; by2: number } | null,
  trails?: GhostTrail[],
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#404040";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

  const isSel = (kind: SelKind, idx: number) => selected.some(s => s.kind === kind && s.idx === idx);

  // Board background
  ctx.fillStyle = "#0a0018";
  ctx.fillRect(0, 0, board.width, board.height);

  // Grid
  ctx.strokeStyle = "rgba(80,40,140,0.3)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= board.width; x += 10) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, board.height); ctx.stroke();
  }
  for (let y = 0; y <= board.height; y += 10) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(board.width, y); ctx.stroke();
  }
  ctx.strokeStyle = "#5030a0"; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, board.width - 2, board.height - 2);

  // Walls
  board.walls.forEach((w, i) => {
    const sel = isSel("wall", i);
    ctx.save();
    ctx.translate(w.x, w.y); ctx.rotate(w.angle ?? 0);
    ctx.fillStyle = sel ? "#8060ff" : "#2a1050";
    ctx.strokeStyle = sel ? "#c0a0ff" : "#5030a0";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath(); ctx.rect(-w.w / 2, -w.h / 2, w.w, w.h); ctx.fill(); ctx.stroke();
    ctx.restore();
  });

  // Targets
  board.targets.forEach((t, i) => {
    const sel = isSel("target", i);
    ctx.save();
    ctx.translate(t.x, t.y); ctx.rotate(t.angle ?? 0);
    ctx.fillStyle = sel ? "#ff9030" : "#cc4400";
    ctx.strokeStyle = sel ? "#ffc080" : "#ffcc88";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath(); ctx.rect(-t.w / 2, -t.h / 2, t.w, t.h); ctx.fill(); ctx.stroke();
    if (t.label) {
      ctx.fillStyle = "#fff"; ctx.font = "5px 'Press Start 2P'";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t.label, 0, 0);
    }
    ctx.restore();
  });

  // Slingshots
  board.slingshots.forEach((sl, i) => {
    const sel = isSel("slingshot", i);
    ctx.save();
    ctx.translate(sl.x, sl.y); ctx.rotate(sl.angle ?? 0);
    ctx.fillStyle = sel ? "#9060e0" : "#5b2d8e";
    ctx.strokeStyle = sel ? "#d0a0ff" : "#9060d0";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath(); ctx.rect(-sl.w / 2, -sl.h / 2, sl.w, sl.h); ctx.fill(); ctx.stroke();
    ctx.restore();
  });

  // Bumpers
  board.bumpers.forEach((b, i) => {
    const sel = isSel("bumper", i);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#e0b0ff" : "#7b3dbe";
    ctx.strokeStyle = sel ? "#fff" : "#c080ff";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.fill(); ctx.stroke();
    if (b.label) {
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(5, Math.floor(b.r * 0.6))}px 'Press Start 2P'`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x, b.y);
    }
  });

  // Posts
  board.posts.forEach((p, i) => {
    const sel = isSel("post", i);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#ffffff" : "#c0c0c0";
    ctx.strokeStyle = sel ? "#ffd700" : "#808080";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.fill(); ctx.stroke();
  });

  // Flippers
  board.flippers.forEach((f, i) => {
    const sel = isSel("flipper", i);
    const ra = f.side === "left" ? 0.5 : -0.5;
    ctx.save();
    ctx.translate(f.pivotX, f.pivotY); ctx.rotate(ra);
    ctx.fillStyle = sel ? "#ffffff" : "#c0c0c0";
    ctx.strokeStyle = sel ? "#ffd700" : "#606060";
    ctx.lineWidth = sel ? 2 : 1;
    if (f.side === "left") {
      ctx.beginPath(); ctx.rect(0, -4, f.length, 8); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.rect(-f.length, -4, f.length, 8); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(f.pivotX, f.pivotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#ffd700" : "#d0d0d0"; ctx.fill();
  });

  // Plunger lane + rod
  const pl = board.plunger;
  const plSel = isSel("plunger", 0);
  // Selection highlight (dashed ring around full lane)
  if (plSel) {
    ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.strokeRect(pl.x - BALL_R - 10, pl.topY, BALL_R * 2 + 20, pl.bottomY - pl.topY);
    ctx.setLineDash([]);
  }
  // Left divider rail
  ctx.fillStyle = plSel ? "#664400" : "#2a1050";
  ctx.fillRect(pl.x - BALL_R - 8, pl.topY, 6, pl.bottomY - pl.topY);
  // Right rail (thin)
  ctx.fillRect(pl.x + BALL_R + 2, pl.topY, 4, pl.bottomY - pl.topY);
  // Rod body (at rest = full height, shows how it looks in game when not charging)
  const rodTop = board.ballStartY + BALL_R + 2;
  const rodBottom = pl.bottomY - 4;
  ctx.fillStyle = plSel ? "#d0b060" : "#909090";
  ctx.fillRect(pl.x - BALL_R, rodTop, BALL_R * 2, rodBottom - rodTop);
  ctx.fillStyle = plSel ? "#f0d080" : "#d0d0d0"; // highlight
  ctx.fillRect(pl.x - BALL_R, rodTop, 3, rodBottom - rodTop);
  ctx.fillStyle = plSel ? "#a08040" : "#606060"; // shadow
  ctx.fillRect(pl.x + BALL_R - 3, rodTop, 3, rodBottom - rodTop);
  ctx.fillStyle = plSel ? "#e0c070" : "#c0c0c0"; // face cap
  ctx.fillRect(pl.x - BALL_R, rodTop, BALL_R * 2, 3);
  // Label
  ctx.fillStyle = plSel ? "#ffcc00" : "#a080e0";
  ctx.font = "5px 'Press Start 2P'"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("PLG", pl.x - 4, pl.topY + 3);
  if (plSel) {
    ctx.font = "4px 'Press Start 2P'";
    ctx.fillText(`×${(pl.launchPower ?? 1.0).toFixed(1)}`, pl.x - 4, pl.topY + 12);
  }

  // Ball start
  ctx.beginPath(); ctx.arc(board.ballStartX, board.ballStartY, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "5px 'Press Start 2P'";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("B", board.ballStartX, board.ballStartY);

  // Ghost ball trails
  if (trails && trails.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    for (const trail of trails) {
      if (trail.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Preview rect
  if (preview) {
    const px = Math.min(preview.bx1, preview.bx2), py = Math.min(preview.by1, preview.by2);
    const pw = Math.abs(preview.bx2 - preview.bx1), ph = Math.abs(preview.by2 - preview.by1);
    ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); ctx.strokeRect(px, py, pw, ph); ctx.setLineDash([]);
  }

  // Rubber band
  if (rubber) {
    const rx = Math.min(rubber.bx1, rubber.bx2), ry = Math.min(rubber.by1, rubber.by2);
    const rw = Math.abs(rubber.bx2 - rubber.bx1), rh = Math.abs(rubber.by2 - rubber.by1);
    ctx.strokeStyle = "#00aaff"; ctx.fillStyle = "rgba(0,170,255,0.08)"; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Handles (drawn in screen space)
  if (selected.length === 1) {
    const handles = getHandles(board, selected, view);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Line from center to rotate handle
    const rot = handles.find(h => h.kind === "rotate");
    if (rot) {
      const s = selected[0];
      const [ecx, ecy] = s.kind === "wall" ? [board.walls[s.idx].x, board.walls[s.idx].y]
        : s.kind === "slingshot" ? [board.slingshots[s.idx].x, board.slingshots[s.idx].y]
        : s.kind === "target" ? [board.targets[s.idx].x, board.targets[s.idx].y]
        : [0, 0];
      const [csx, csy] = b2s(ecx, ecy, view);
      const [rsx, rsy] = b2s(rot.bx, rot.by, view);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(0,255,136,0.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(csx, csy); ctx.lineTo(rsx, rsy); ctx.stroke();
      ctx.setLineDash([]);
    }
    handles.forEach(h => {
      const [sx, sy] = b2s(h.bx, h.by, view);
      ctx.beginPath(); ctx.arc(sx, sy, HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle = h.kind === "rotate" ? "#00ff88" : "#ffffff";
      ctx.strokeStyle = h.kind === "rotate" ? "#004400" : "#0044cc";
      ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    });
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: { id: Tool; label: string; Icon: React.FC }[] = [
  { id: "select",    label: "Select",    Icon: IconSelect },
  { id: "wall",      label: "Wall",      Icon: IconWall },
  { id: "bumper",    label: "Bumper",    Icon: IconBumper },
  { id: "post",      label: "Post",      Icon: IconPost },
  { id: "flipper-l", label: "Flip L",    Icon: IconFlipperL },
  { id: "flipper-r", label: "Flip R",    Icon: IconFlipperR },
  { id: "slingshot", label: "Sling",     Icon: IconSlingshot },
  { id: "target",    label: "Target",    Icon: IconTarget },
  { id: "delete",    label: "Delete",    Icon: IconDelete },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PinballEditor() {
  const [board, setBoardRaw] = useState<Board>(loadBoard);
  const [tool, setTool] = useState<Tool | null>(null);
  const [selected, setSelected] = useState<SelItem[]>([]);
  const [view, setView] = useState<ViewXform>({ x: 20, y: 20, scale: 1 });
  const [rubber, setRubber] = useState<{ bx1: number; by1: number; bx2: number; by2: number } | null>(null);
  const [preview, setPreview] = useState<{ bx1: number; by1: number; bx2: number; by2: number } | null>(null);
  const [testPlay, setTestPlay] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [ghostBalls, setGhostBalls] = useState(false);
  const [ghostTrails, setGhostTrails] = useState<GhostTrail[]>([]);

  const viewRef = useRef(view); viewRef.current = view;
  const boardRef = useRef(board); boardRef.current = board;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const toolRef = useRef(tool); toolRef.current = tool;
  const showPropsRef = useRef(showProps); showPropsRef.current = showProps;
  const ghostTrailsRef = useRef<GhostTrail[]>([]); ghostTrailsRef.current = ghostTrails;

  const dragRef = useRef<DragState | null>(null);
  const middlePanRef = useRef<{ startSX: number; startSY: number; startVX: number; startVY: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const setBoard = useCallback((b: Board | ((prev: Board) => Board)) => {
    setBoardRaw(prev => {
      const next = typeof b === "function" ? b(prev) : b;
      boardRef.current = next;
      saveBoard(next);
      return next;
    });
  }, []);

  // ── Window menus ────────────────────────────────────────────────────────────

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          setBoard(JSON.parse(ev.target?.result as string) as Board);
          setSelected([]);
        } catch { /* ignore */ }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setBoard]);

  const handleClearAll = useCallback(() => {
    if (!window.confirm("Clear the entire board?")) return;
    setBoard(prev => ({ ...prev, walls: [], bumpers: [], posts: [], flippers: [], slingshots: [], targets: [] }));
    setSelected([]);
  }, [setBoard]);

  const handleResetToClassic = useCallback(() => {
    if (!window.confirm("Reset to classic board? All changes will be lost.")) return;
    setBoard(classicBoard as Board); setSelected([]);
  }, [setBoard]);

  const deleteSelected = useCallback(() => {
    const sel = selectedRef.current;
    if (sel.length === 0) return;
    setBoard(prev => deleteItems(prev, sel));
    setSelected([]);
  }, [setBoard]);

  const duplicateSelected = useCallback(() => {
    const sel = selectedRef.current;
    if (sel.length !== 1 || sel[0].kind === "plunger") return;
    const { board: next, newSel } = duplicateItem(boardRef.current, sel[0]);
    setBoard(next);
    setSelected([newSel]);
  }, [setBoard]);

  const zoomIn = useCallback(() => setView(v => {
    const s = Math.min(MAX_SCALE, v.scale * 1.25);
    const cx = (canvasRef.current?.width ?? 400) / 2;
    const cy = (canvasRef.current?.height ?? 600) / 2;
    const bx = (cx - v.x) / v.scale, by = (cy - v.y) / v.scale;
    return { scale: s, x: cx - bx * s, y: cy - by * s };
  }), []);

  const zoomOut = useCallback(() => setView(v => {
    const s = Math.max(MIN_SCALE, v.scale * 0.8);
    const cx = (canvasRef.current?.width ?? 400) / 2;
    const cy = (canvasRef.current?.height ?? 600) / 2;
    const bx = (cx - v.x) / v.scale, by = (cy - v.y) / v.scale;
    return { scale: s, x: cx - bx * s, y: cy - by * s };
  }), []);

  const fitToScreen = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const s = Math.min(c.width / boardRef.current.width * 0.9, c.height / boardRef.current.height * 0.9);
    setView({ x: (c.width - boardRef.current.width * s) / 2, y: (c.height - boardRef.current.height * s) / 2, scale: s });
  }, []);

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "File",
      items: [
        { label: "Export JSON",        onClick: () => exportBoard(boardRef.current) },
        { label: "Import JSON",        onClick: handleImport },
        { separator: true },
        { label: "Reset to Classic",   onClick: handleResetToClassic },
        { label: "Clear All",          onClick: handleClearAll },
        { separator: true },
        { label: "▶  Test Play",       onClick: () => setTestPlay(true) },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Delete Selected  Del",    onClick: deleteSelected },
        { label: "Duplicate        Ctrl+D", onClick: duplicateSelected },
        { separator: true },
        { label: "Properties…",            onClick: () => setShowProps(true) },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Zoom In   +", onClick: zoomIn },
        { label: "Zoom Out  −", onClick: zoomOut },
        { label: "Fit Board  F", onClick: fitToScreen },
        { separator: true },
        { label: "Ghost Ball Preview", checked: ghostBalls, onClick: () => setGhostBalls(v => !v) },
      ],
    },
  ], [handleImport, handleClearAll, handleResetToClassic, deleteSelected, duplicateSelected, zoomIn, zoomOut, fitToScreen, ghostBalls]);

  useWindowMenus(menus);

  // ── Canvas draw ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const container = canvas.parentElement;
    if (container) {
      const w = container.clientWidth, h = container.clientHeight;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    drawScene(ctx, board, view, selected, rubber, preview, ghostTrails);
  }, [board, view, selected, rubber, preview, ghostTrails]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      drawScene(ctx, boardRef.current, viewRef.current, selectedRef.current, null, null, ghostTrailsRef.current);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Ghost trail computation ──────────────────────────────────────────────────

  useEffect(() => {
    if (!ghostBalls || selected.length !== 1) {
      setGhostTrails([]);
      return;
    }
    const sel = selected[0];
    // Debounce: wait 300ms after last board/selection change before computing
    const timer = setTimeout(() => {
      setGhostTrails(computeGhostTrails(boardRef.current, sel));
    }, 300);
    return () => clearTimeout(timer);
  // board is intentionally included so trails update when the board is edited
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostBalls, selected, board]);

  // ── Coord helpers ────────────────────────────────────────────────────────────

  const getCanvasXY = useCallback((clientX: number, clientY: number): [number, number] => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0];
    return [clientX - rect.left, clientY - rect.top];
  }, []);

  // ── Pointer events ───────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Middle mouse: always pan, regardless of tool
    if (e.button === 1) {
      const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
      middlePanRef.current = { startSX: sx, startSY: sy, startVX: viewRef.current.x, startVY: viewRef.current.y };
      return;
    }

    if (pointersRef.current.size >= 2) { dragRef.current = null; return; }

    const v = viewRef.current;
    const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
    const [bx, by] = s2b(sx, sy, v);

    if (toolRef.current === null) {
      dragRef.current = { type: "pan", startSX: sx, startSY: sy, startBX: bx, startBY: by, startViewX: v.x, startViewY: v.y };
      return;
    }

    if (toolRef.current === "delete") {
      const hit = hitTest(boardRef.current, bx, by);
      if (hit && hit.kind !== "plunger") {
        setBoard(prev => deleteItems(prev, [hit]));
        setSelected([]);
      }
      return;
    }

    if (toolRef.current === "select") {
      const b = boardRef.current;
      const sel = selectedRef.current;
      if (sel.length === 1) {
        const handles = getHandles(b, sel, v);
        const hh = hitHandle(handles, bx, by, v);
        if (hh) {
          dragRef.current = { type: "handle", startSX: sx, startSY: sy, startBX: bx, startBY: by, handle: hh, origBoard: b };
          return;
        }
      }
      const hit = hitTest(b, bx, by);
      if (hit) {
        if (!sel.some(s => s.kind === hit.kind && s.idx === hit.idx)) {
          setSelected([hit]); selectedRef.current = [hit];
        }
        dragRef.current = { type: "move", startSX: sx, startSY: sy, startBX: bx, startBY: by };
        return;
      }
      setSelected([]); selectedRef.current = [];
      setRubber({ bx1: bx, by1: by, bx2: bx, by2: by });
      dragRef.current = { type: "rubber", startSX: sx, startSY: sy, startBX: bx, startBY: by };
      return;
    }

    if (toolRef.current === "wall" || toolRef.current === "slingshot" || toolRef.current === "target") {
      setPreview({ bx1: bx, by1: by, bx2: bx, by2: by });
      dragRef.current = { type: "draw", startSX: sx, startSY: sy, startBX: bx, startBY: by };
      return;
    }

    const bd = boardRef.current;
    if (toolRef.current === "bumper") {
      const nb: BoardBumper = { x: snap(bx), y: snap(by), r: 16, label: String.fromCharCode(65 + bd.bumpers.length) };
      setBoard(prev => ({ ...prev, bumpers: [...prev.bumpers, nb] }));
    } else if (toolRef.current === "post") {
      const np: BoardPost = { x: snap(bx), y: snap(by), r: 5 };
      setBoard(prev => ({ ...prev, posts: [...prev.posts, np] }));
    } else if (toolRef.current === "flipper-l") {
      const nf: BoardFlipper = { side: "left", pivotX: snap(bx), pivotY: snap(by), length: 60 };
      setBoard(prev => ({ ...prev, flippers: [...prev.flippers, nf] }));
    } else if (toolRef.current === "flipper-r") {
      const nf: BoardFlipper = { side: "right", pivotX: snap(bx), pivotY: snap(by), length: 60 };
      setBoard(prev => ({ ...prev, flippers: [...prev.flippers, nf] }));
    }
  }, [getCanvasXY, setBoard]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Middle mouse pan (overrides everything)
    if (middlePanRef.current) {
      const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
      const mb = middlePanRef.current;
      setView(v => ({ ...v, x: mb.startVX + (sx - mb.startSX), y: mb.startVY + (sy - mb.startSY) }));
      return;
    }

    const v = viewRef.current;
    const ptrs = [...pointersRef.current.values()];
    if (ptrs.length === 2) {
      const [p0, p1] = ptrs;
      const [ax0, ay0] = getCanvasXY(p0.x, p0.y);
      const [ax1, ay1] = getCanvasXY(p1.x, p1.y);
      const dist = Math.hypot(ax1 - ax0, ay1 - ay0);
      const midSX = (ax0 + ax1) / 2, midSY = (ay0 + ay1) / 2;
      const dr = dragRef.current as { prevDist?: number } | null;
      if (dr && dr.prevDist) {
        const ratio = dist / dr.prevDist;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * ratio));
        const pinchBX = (midSX - v.x) / v.scale;
        const pinchBY = (midSY - v.y) / v.scale;
        setView({ scale: newScale, x: midSX - pinchBX * newScale, y: midSY - pinchBY * newScale });
      }
      if (!dragRef.current) dragRef.current = { type: "pan", startSX: 0, startSY: 0, startBX: 0, startBY: 0 };
      Object.assign(dragRef.current, { prevDist: dist });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
    const [bx, by] = s2b(sx, sy, v);

    if (drag.type === "pan") {
      setView(prev => ({ ...prev, x: (drag.startViewX ?? prev.x) + (sx - drag.startSX), y: (drag.startViewY ?? prev.y) + (sy - drag.startSY) }));
      return;
    }
    if (drag.type === "rubber") {
      setRubber({ bx1: drag.startBX, by1: drag.startBY, bx2: bx, by2: by });
      return;
    }
    if (drag.type === "draw") {
      setPreview({ bx1: drag.startBX, by1: drag.startBY, bx2: bx, by2: by });
      return;
    }
    if (drag.type === "move") {
      const sel = selectedRef.current;
      if (sel.length === 0) return;
      const dbx = bx - drag.startBX, dby = by - drag.startBY;
      dragRef.current = { ...drag, startBX: bx, startBY: by };
      setBoard(prev => moveItems(prev, sel, dbx, dby));
      return;
    }
    if (drag.type === "handle" && drag.handle && drag.origBoard) {
      const sel = selectedRef.current;
      if (sel.length !== 1) return;
      setBoard(() => applyHandleDrag(drag.origBoard!, sel[0], drag.handle!, bx, by));
      return;
    }
  }, [getCanvasXY, setBoard]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    pointersRef.current.delete(e.pointerId);

    if (e.button === 1) { middlePanRef.current = null; return; }

    const drag = dragRef.current;
    const v = viewRef.current;

    if (drag?.type === "rubber") {
      const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
      const [bx, by] = s2b(sx, sy, v);
      const sel = selectAllInBand(boardRef.current, drag.startBX, drag.startBY, bx, by);
      setSelected(sel); selectedRef.current = sel;
      setRubber(null);
      dragRef.current = null;
      return;
    }
    if (drag?.type === "draw") {
      const t = toolRef.current;
      const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
      const [bx, by] = s2b(sx, sy, v);
      const cx = snap((drag.startBX + bx) / 2), cy = snap((drag.startBY + by) / 2);
      const w = Math.max(8, Math.abs(bx - drag.startBX)), h = Math.max(8, Math.abs(by - drag.startBY));
      if (t === "wall") {
        const nw: BoardWall = { x: cx, y: cy, w, h };
        setBoard(prev => ({ ...prev, walls: [...prev.walls, nw] }));
      } else if (t === "slingshot") {
        setBoard(prev => ({ ...prev, slingshots: [...prev.slingshots, { x: cx, y: cy, w, h }] }));
      } else if (t === "target") {
        setBoard(prev => ({ ...prev, targets: [...prev.targets, { x: cx, y: cy, w, h, label: String(prev.targets.length + 1) }] }));
      }
      setPreview(null);
      dragRef.current = null;
      return;
    }
    dragRef.current = null;
  }, [getCanvasXY, setBoard]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    middlePanRef.current = null;
    dragRef.current = null;
    setRubber(null); setPreview(null);
  }, []);

  // Mouse wheel zoom (always active)
  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const v = viewRef.current;
    const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
    const bx = (sx - v.x) / v.scale, by = (sy - v.y) / v.scale;
    setView({ scale: newScale, x: sx - bx * newScale, y: sy - by * newScale });
  }, [getCanvasXY]);

  // Right-click context menu
  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const [sx, sy] = getCanvasXY(e.clientX, e.clientY);
    const [bx, by] = s2b(sx, sy, viewRef.current);
    const hit = hitTest(boardRef.current, bx, by);
    if (hit) { setSelected([hit]); selectedRef.current = [hit]; }
    setContextMenu({ clientX: e.clientX, clientY: e.clientY, item: hit });
  }, [getCanvasXY]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore delete keys when properties modal is open
      if (showPropsRef.current) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = selectedRef.current;
        if (sel.length > 0) { setBoard(prev => deleteItems(prev, sel)); setSelected([]); }
      }
      if (e.key === "Escape") { setSelected([]); setContextMenu(null); }
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "f" || e.key === "F") fitToScreen();
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); duplicateSelected(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setBoard, zoomIn, zoomOut, fitToScreen, duplicateSelected]);

  // Close context menu on click-away
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [contextMenu]);

  // ── Properties helpers ────────────────────────────────────────────────────────

  const numField = (label: string, val: number, onChange: (v: number) => void) => (
    <div className="pbed__field" key={label}>
      <label>{label}</label>
      <input type="number" value={val} step="any" onChange={ev => onChange(Number(ev.target.value))} />
    </div>
  );
  const strField = (label: string, val: string, onChange: (v: string) => void) => (
    <div className="pbed__field" key={label}>
      <label>{label}</label>
      <input type="text" value={val} onChange={ev => onChange(ev.target.value)} />
    </div>
  );

  const getPropsFor = (s: SelItem): { title: string; fields: React.ReactNode; canDelete: boolean } => {
    let fields: React.ReactNode = null;
    let title = "";

    if (s.kind === "plunger") {
      const pl = board.plunger;
      const upd = (p: Partial<typeof pl>) => setBoard(prev => ({ ...prev, plunger: { ...prev.plunger, ...p } }));
      title = "PLUNGER / LAUNCHER";
      fields = <>
        {numField("X", pl.x, v => upd({ x: v }))}
        {numField("Top Y", pl.topY, v => upd({ topY: v }))}
        {numField("Bottom Y", pl.bottomY, v => upd({ bottomY: v }))}
        {numField("Launch Power (×)", pl.launchPower ?? 1.0, v => upd({ launchPower: v }))}
      </>;
    } else if (s.kind === "wall") {
      const w = board.walls[s.idx];
      const upd = (p: Partial<BoardWall>) => setBoard(prev => { const walls = [...prev.walls]; walls[s.idx] = { ...walls[s.idx], ...p }; return { ...prev, walls }; });
      title = "WALL";
      fields = <>
        {numField("X", w.x, v => upd({ x: v }))} {numField("Y", w.y, v => upd({ y: v }))}
        {numField("Width", w.w, v => upd({ w: v }))} {numField("Height", w.h, v => upd({ h: v }))}
        {numField("Angle (rad)", w.angle ?? 0, v => upd({ angle: v }))}
      </>;
    } else if (s.kind === "bumper") {
      const b = board.bumpers[s.idx];
      const upd = (p: Partial<BoardBumper>) => setBoard(prev => { const bumpers = [...prev.bumpers]; bumpers[s.idx] = { ...bumpers[s.idx], ...p }; return { ...prev, bumpers }; });
      title = "BUMPER";
      fields = <>
        {numField("X", b.x, v => upd({ x: v }))} {numField("Y", b.y, v => upd({ y: v }))}
        {numField("Radius", b.r, v => upd({ r: v }))} {strField("Label", b.label ?? "", v => upd({ label: v }))}
      </>;
    } else if (s.kind === "post") {
      const p = board.posts[s.idx];
      const upd = (patch: Partial<BoardPost>) => setBoard(prev => { const posts = [...prev.posts]; posts[s.idx] = { ...posts[s.idx], ...patch }; return { ...prev, posts }; });
      title = "POST";
      fields = <>
        {numField("X", p.x, v => upd({ x: v }))} {numField("Y", p.y, v => upd({ y: v }))}
        {numField("Radius", p.r, v => upd({ r: v }))}
      </>;
    } else if (s.kind === "flipper") {
      const f = board.flippers[s.idx];
      const upd = (p: Partial<BoardFlipper>) => setBoard(prev => { const flippers = [...prev.flippers]; flippers[s.idx] = { ...flippers[s.idx], ...p }; return { ...prev, flippers }; });
      title = `FLIPPER (${f.side.toUpperCase()})`;
      fields = <>
        {numField("Pivot X", f.pivotX, v => upd({ pivotX: v }))} {numField("Pivot Y", f.pivotY, v => upd({ pivotY: v }))}
        {numField("Length", f.length, v => upd({ length: v }))}
      </>;
    } else if (s.kind === "slingshot") {
      const sl = board.slingshots[s.idx];
      const upd = (p: Partial<BoardSlingshot>) => setBoard(prev => { const slingshots = [...prev.slingshots]; slingshots[s.idx] = { ...slingshots[s.idx], ...p }; return { ...prev, slingshots }; });
      title = "SLINGSHOT";
      fields = <>
        {numField("X", sl.x, v => upd({ x: v }))} {numField("Y", sl.y, v => upd({ y: v }))}
        {numField("Width", sl.w, v => upd({ w: v }))} {numField("Height", sl.h, v => upd({ h: v }))}
        {numField("Angle (rad)", sl.angle ?? 0, v => upd({ angle: v }))}
      </>;
    } else if (s.kind === "target") {
      const t = board.targets[s.idx];
      const upd = (p: Partial<BoardTarget>) => setBoard(prev => { const targets = [...prev.targets]; targets[s.idx] = { ...targets[s.idx], ...p }; return { ...prev, targets }; });
      title = "TARGET";
      fields = <>
        {numField("X", t.x, v => upd({ x: v }))} {numField("Y", t.y, v => upd({ y: v }))}
        {numField("Width", t.w, v => upd({ w: v }))} {numField("Height", t.h, v => upd({ h: v }))}
        {numField("Angle (rad)", t.angle ?? 0, v => upd({ angle: v }))}
        {strField("Label", t.label ?? "", v => upd({ label: v }))}
      </>;
    }

    return { title, fields, canDelete: s.kind !== "plunger" };
  };

  // ── Properties modal (small screens) ─────────────────────────────────────────

  const renderPropsModal = () => {
    if (!showProps) return null;
    const s = selected.length === 1 ? selected[0] : null;
    if (!s) return null;
    const { title, fields, canDelete } = getPropsFor(s);
    const deleteEl = () => {
      setBoard(prev => deleteItems(prev, [s]));
      setSelected([]); setShowProps(false);
    };
    return (
      <div className="pbed__modal-backdrop" onClick={() => setShowProps(false)}>
        <div className="pbed__modal" onClick={e => e.stopPropagation()}>
          <div className="pbed__modal-header">
            <span>{title}</span>
            <button className="pbed__modal-close" onClick={() => setShowProps(false)}>✕</button>
          </div>
          <div className="pbed__modal-body">{fields}</div>
          <div className="pbed__modal-footer">
            {canDelete && <button className="pbed__delete-btn" onClick={deleteEl}>DELETE</button>}
            <button className="pbed__ok-btn" onClick={() => setShowProps(false)}>OK</button>
          </div>
        </div>
      </div>
    );
  };

  const canvasMode = tool === null ? "pan" : tool === "select" ? "select" : tool === "delete" ? "delete" : "place";

  // Sidebar content — shown on large screens, replaces modal
  const sidebarItem = selected.length === 1 ? selected[0] : null;
  const sidebarProps = sidebarItem ? getPropsFor(sidebarItem) : null;

  return (
    <div className="pbed">
      {/* Tool bar — horizontal on small, vertical on large */}
      <div className="pbed__toolbar">
        {/* Test Play — always first / topmost */}
        <button
          className="pbed__tool-btn pbed__tool-btn--play"
          onClick={() => setTestPlay(true)}
          title="Test Play"
        >
          <IconPlay />
          <span>Play</span>
        </button>

        <div className="pbed__toolbar-sep" />

        <button
          className={`pbed__tool-btn${tool === null ? " pbed__tool-btn--active" : ""}`}
          onClick={() => { setTool(null); setSelected([]); }}
          title="Pan / Zoom (no tool active)"
        >
          <IconPan />
          <span>Pan</span>
        </button>
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`pbed__tool-btn${tool === id ? " pbed__tool-btn--active" : ""}${id === "delete" ? " pbed__tool-btn--danger" : ""}`}
            onClick={() => { setTool(prev => prev === id ? null : id); if (id !== "select") setSelected([]); }}
            title={label}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Center row: canvas + sidebar */}
      <div className="pbed__center">
        {/* Canvas area */}
        <div className="pbed__canvas-area" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className={`pbed__canvas pbed__canvas--${canvasMode}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onWheel={onWheel}
            onContextMenu={onContextMenu}
            style={{ touchAction: "none" }}
          />

          {/* ✏️ FAB — hidden on large screens (sidebar replaces it) */}
          {selected.length === 1 && !showProps && (
            <button className="pbed__props-fab" onClick={() => setShowProps(true)} title="Edit properties">
              ✏️
            </button>
          )}

          {/* Zoom buttons — bottom-right */}
          <div className="pbed__zoom-btns">
            <button className="pbed__zoom-btn" onClick={zoomIn}  title="Zoom in (+)">+</button>
            <button className="pbed__zoom-btn" onClick={fitToScreen} title="Fit board (F)">FIT</button>
            <button className="pbed__zoom-btn" onClick={zoomOut} title="Zoom out (−)">−</button>
          </div>
        </div>

        {/* Properties sidebar — visible on large screens only */}
        <div className="pbed__sidebar">
          {sidebarProps ? (
            <>
              <div className="pbed__sidebar-header">{sidebarProps.title}</div>
              <div className="pbed__sidebar-body">{sidebarProps.fields}</div>
              {sidebarProps.canDelete && (
                <div className="pbed__sidebar-footer">
                  <button className="pbed__delete-btn" onClick={() => {
                    setBoard(prev => deleteItems(prev, [sidebarItem!]));
                    setSelected([]);
                  }}>DELETE</button>
                </div>
              )}
            </>
          ) : (
            <div className="pbed__sidebar-empty">Select an object to edit its properties</div>
          )}
        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="pbed__context-menu"
          style={{ left: contextMenu.clientX, top: contextMenu.clientY }}
          onPointerDown={e => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              <button className="pbed__ctx-item" onClick={() => { setShowProps(true); setContextMenu(null); }}>
                Modify…
              </button>
              {contextMenu.item.kind !== "plunger" && (
                <button className="pbed__ctx-item" onClick={() => {
                  duplicateSelected(); setContextMenu(null);
                }}>
                  Duplicate
                </button>
              )}
              {contextMenu.item.kind !== "plunger" && (
                <>
                  <div className="pbed__ctx-sep" />
                  <button className="pbed__ctx-item pbed__ctx-item--danger" onClick={() => {
                    deleteSelected(); setContextMenu(null);
                  }}>
                    Delete
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="pbed__ctx-empty">Nothing here</div>
          )}
        </div>
      )}

      {/* Properties modal (small screens) */}
      {renderPropsModal()}

      {/* Test play overlay */}
      {testPlay && (
        <div className="pbed__overlay">
          <div className="pbed__overlay-title">TEST PLAY</div>
          <Pinball board={board} onQuit={() => setTestPlay(false)} />
          <button className="pbed__overlay-btn" onClick={() => setTestPlay(false)}>EXIT TEST PLAY</button>
        </div>
      )}
    </div>
  );
}
