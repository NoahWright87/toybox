import { useEffect, useRef, useState, useCallback } from "react";
import type {
  Board, BoardWall, BoardBumper, BoardPost, BoardFlipper,
  BoardSlingshot, BoardTarget,
} from "../Pinball/boardTypes";
import Pinball from "../Pinball/Pinball";
import classicBoard from "../Pinball/boards/classic.json";
import "./PinballEditor.css";

const LS_KEY = "pinball_editor_board";
const HANDLE_R = 9;     // screen pixels
const SNAP = 4;
const MIN_SCALE = 0.25;
const MAX_SCALE = 5;

type Tool = "select" | "wall" | "bumper" | "post" | "flipper-l" | "flipper-r"
  | "slingshot" | "target" | "delete";

type SelKind = "wall" | "bumper" | "post" | "flipper" | "slingshot" | "target";
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
      const next = arr.map((e, i) => i === sel.idx ? { ...e, angle: newAngle } : e);
      return { ...board, [arrKey]: next };
    }

    // Corner resize: symmetric from center
    const lx = dx * Math.cos(a) + dy * Math.sin(a);
    const ly = -dx * Math.sin(a) + dy * Math.cos(a);
    const newW = Math.max(8, 2 * Math.abs(lx));
    const newH = Math.max(8, 2 * Math.abs(ly));
    const next = arr.map((e, i) => i === sel.idx ? { ...e, w: newW, h: newH } : e);
    return { ...board, [arrKey]: next };
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
  const b = { ...board };
  const movedWalls = new Set(items.filter(s => s.kind === "wall").map(s => s.idx));
  const movedBumpers = new Set(items.filter(s => s.kind === "bumper").map(s => s.idx));
  const movedPosts = new Set(items.filter(s => s.kind === "post").map(s => s.idx));
  const movedFlippers = new Set(items.filter(s => s.kind === "flipper").map(s => s.idx));
  const movedSlings = new Set(items.filter(s => s.kind === "slingshot").map(s => s.idx));
  const movedTargets = new Set(items.filter(s => s.kind === "target").map(s => s.idx));
  b.walls = board.walls.map((w, i) => movedWalls.has(i) ? { ...w, x: snap(w.x + dbx), y: snap(w.y + dby) } : w);
  b.bumpers = board.bumpers.map((bm, i) => movedBumpers.has(i) ? { ...bm, x: snap(bm.x + dbx), y: snap(bm.y + dby) } : bm);
  b.posts = board.posts.map((p, i) => movedPosts.has(i) ? { ...p, x: snap(p.x + dbx), y: snap(p.y + dby) } : p);
  b.flippers = board.flippers.map((f, i) => movedFlippers.has(i) ? { ...f, pivotX: snap(f.pivotX + dbx), pivotY: snap(f.pivotY + dby) } : f);
  b.slingshots = board.slingshots.map((sl, i) => movedSlings.has(i) ? { ...sl, x: snap(sl.x + dbx), y: snap(sl.y + dby) } : sl);
  b.targets = board.targets.map((t, i) => movedTargets.has(i) ? { ...t, x: snap(t.x + dbx), y: snap(t.y + dby) } : t);
  return b;
}

function deleteItems(board: Board, items: SelItem[]): Board {
  const toDelete = (k: SelKind) => new Set(items.filter(s => s.kind === k).map(s => s.idx));
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

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawScene(
  ctx: CanvasRenderingContext2D,
  board: Board,
  view: ViewXform,
  selected: SelItem[],
  rubber: { bx1: number; by1: number; bx2: number; by2: number } | null,
  preview: { bx1: number; by1: number; bx2: number; by2: number } | null,
) {
  const { width: W, height: H } = canvas2board(ctx.canvas, view);
  void W; void H;

  // Clear canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#404040";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Apply view transform for board drawing
  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

  const isSelected = (kind: SelKind, idx: number) => selected.some(s => s.kind === kind && s.idx === idx);

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

  // Boundary
  ctx.strokeStyle = "#5030a0";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, board.width - 2, board.height - 2);

  // Walls
  board.walls.forEach((w, i) => {
    const sel = isSelected("wall", i);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.angle ?? 0);
    ctx.fillStyle = sel ? "#8060ff" : "#2a1050";
    ctx.strokeStyle = sel ? "#c0a0ff" : "#5030a0";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-w.w / 2, -w.h / 2, w.w, w.h);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  });

  // Targets
  board.targets.forEach((t, i) => {
    const sel = isSelected("target", i);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle ?? 0);
    ctx.fillStyle = sel ? "#ff9030" : "#cc4400";
    ctx.strokeStyle = sel ? "#ffc080" : "#ffcc88";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-t.w / 2, -t.h / 2, t.w, t.h);
    ctx.fill(); ctx.stroke();
    if (t.label) {
      ctx.fillStyle = "#fff";
      ctx.font = "5px 'Press Start 2P'";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t.label, 0, 0);
    }
    ctx.restore();
  });

  // Slingshots
  board.slingshots.forEach((sl, i) => {
    const sel = isSelected("slingshot", i);
    ctx.save();
    ctx.translate(sl.x, sl.y);
    ctx.rotate(sl.angle ?? 0);
    ctx.fillStyle = sel ? "#9060e0" : "#5b2d8e";
    ctx.strokeStyle = sel ? "#d0a0ff" : "#9060d0";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-sl.w / 2, -sl.h / 2, sl.w, sl.h);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  });

  // Bumpers
  board.bumpers.forEach((b, i) => {
    const sel = isSelected("bumper", i);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
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
    const sel = isSelected("post", i);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#ffffff" : "#c0c0c0";
    ctx.strokeStyle = sel ? "#ffd700" : "#808080";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.fill(); ctx.stroke();
  });

  // Flippers
  board.flippers.forEach((f, i) => {
    const sel = isSelected("flipper", i);
    const ra = f.side === "left" ? 0.5 : -0.5;
    ctx.save();
    ctx.translate(f.pivotX, f.pivotY);
    ctx.rotate(ra);
    ctx.fillStyle = sel ? "#ffffff" : "#c0c0c0";
    ctx.strokeStyle = sel ? "#ffd700" : "#606060";
    ctx.lineWidth = sel ? 2 : 1;
    if (f.side === "left") {
      ctx.beginPath(); ctx.rect(0, -4, f.length, 8); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.rect(-f.length, -4, f.length, 8); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(f.pivotX, f.pivotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#ffd700" : "#d0d0d0";
    ctx.fill();
  });

  // Plunger lane
  const pl = board.plunger;
  ctx.fillStyle = "rgba(200,150,255,0.3)";
  ctx.strokeStyle = "#a080e0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect((pl.x - 15), pl.topY, 20, pl.bottomY - pl.topY);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a080e0";
  ctx.font = "5px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("P", pl.x, pl.topY + 10);

  // Ball start
  ctx.beginPath();
  ctx.arc(board.ballStartX, board.ballStartY, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "5px 'Press Start 2P'";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("B", board.ballStartX, board.ballStartY);

  // Draw preview rect (wall/sling/target in progress)
  if (preview) {
    const px = Math.min(preview.bx1, preview.bx2);
    const py = Math.min(preview.by1, preview.by2);
    const pw = Math.abs(preview.bx2 - preview.bx1);
    const ph = Math.abs(preview.by2 - preview.by1);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
  }

  // Rubber band selection rect
  if (rubber) {
    const rx = Math.min(rubber.bx1, rubber.bx2);
    const ry = Math.min(rubber.by1, rubber.by2);
    const rw = Math.abs(rubber.bx2 - rubber.bx1);
    const rh = Math.abs(rubber.by2 - rubber.by1);
    ctx.strokeStyle = "#00aaff";
    ctx.fillStyle = "rgba(0,170,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Handles (drawn in screen space at fixed size)
  if (selected.length === 1) {
    const handles = getHandles(board, selected, view);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    handles.forEach(h => {
      const [sx, sy] = b2s(h.bx, h.by, view);
      ctx.beginPath();
      ctx.arc(sx, sy, HANDLE_R, 0, Math.PI * 2);
      if (h.kind === "rotate") {
        ctx.fillStyle = "#00ff88";
        ctx.strokeStyle = "#004400";
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#0044cc";
      }
      ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
    });
    // Dashed line from element center to rotate handle
    if (handles.length > 0) {
      const rot = handles.find(h => h.kind === "rotate");
      if (rot) {
        const s = selected[0];
        const cx = s.kind === "wall" ? board.walls[s.idx].x
          : s.kind === "slingshot" ? board.slingshots[s.idx].x
          : s.kind === "target" ? board.targets[s.idx].x : 0;
        const cy = s.kind === "wall" ? board.walls[s.idx].y
          : s.kind === "slingshot" ? board.slingshots[s.idx].y
          : s.kind === "target" ? board.targets[s.idx].y : 0;
        const [csx, csy] = b2s(cx, cy, view);
        const [rsx, rsy] = b2s(rot.bx, rot.by, view);
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(0,255,136,0.5)";
        ctx.lineWidth = 1;
        ctx.moveTo(csx, csy); ctx.lineTo(rsx, rsy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

function canvas2board(_canvas: HTMLCanvasElement, _view: ViewXform) {
  return { width: 0, height: 0 };
}

// ── Tool labels ───────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<Tool, string> = {
  select: "✦ SEL",
  wall: "WALL",
  bumper: "BUMPER",
  post: "POST",
  "flipper-l": "FLIP L",
  "flipper-r": "FLIP R",
  slingshot: "SLING",
  target: "TARGET",
  delete: "✕ DEL",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PinballEditor() {
  const [board, setBoardRaw] = useState<Board>(loadBoard);
  const [tool, setTool] = useState<Tool | null>(null);
  const [selected, setSelected] = useState<SelItem[]>([]);
  const [view, setView] = useState<ViewXform>({ x: 20, y: 20, scale: 1 });
  const [rubber, setRubber] = useState<{ bx1: number; by1: number; bx2: number; by2: number } | null>(null);
  const [preview, setPreview] = useState<{ bx1: number; by1: number; bx2: number; by2: number } | null>(null);
  const [testPlay, setTestPlay] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showProps, setShowProps] = useState(false);

  // Mirror mutable state into refs so handlers always see current values
  const viewRef = useRef(view); viewRef.current = view;
  const boardRef = useRef(board); boardRef.current = board;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const toolRef = useRef(tool); toolRef.current = tool;

  const dragRef = useRef<DragState | null>(null);
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

  // ── Canvas draw ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Sync canvas buffer size to CSS size
    const container = canvas.parentElement;
    if (container) {
      const w = container.clientWidth, h = container.clientHeight;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    drawScene(ctx, board, view, selected, rubber, preview);
  }, [board, view, selected, rubber, preview]);

  // Resize observer: redraw when container size changes
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
      drawScene(ctx, boardRef.current, viewRef.current, selectedRef.current, null, null);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Pointer event utilities ─────────────────────────────────────────────────

  const getCanvasCoords = useCallback((clientX: number, clientY: number): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  }, []);

  // ── Pointer down ────────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const pt = { x: e.clientX, y: e.clientY };
    pointersRef.current.set(e.pointerId, pt);

    const v = viewRef.current;
    const t = toolRef.current;
    const [sx, sy] = getCanvasCoords(e.clientX, e.clientY);
    const [bx, by] = s2b(sx, sy, v);

    // Two-finger pinch already in progress
    if (pointersRef.current.size >= 2) {
      dragRef.current = null;
      return;
    }

    // Pan mode (no tool)
    if (t === null) {
      dragRef.current = { type: "pan", startSX: sx, startSY: sy, startBX: bx, startBY: by, startViewX: v.x, startViewY: v.y };
      return;
    }

    if (t === "delete") {
      const hit = hitTest(boardRef.current, bx, by);
      if (hit) {
        setBoard(prev => deleteItems(prev, [hit]));
        setSelected([]);
      }
      return;
    }

    if (t === "select") {
      const b = boardRef.current;
      const sel = selectedRef.current;
      // Check handles first
      if (sel.length === 1) {
        const handles = getHandles(b, sel, v);
        const hh = hitHandle(handles, bx, by, v);
        if (hh) {
          dragRef.current = { type: "handle", startSX: sx, startSY: sy, startBX: bx, startBY: by, handle: hh, origBoard: b };
          return;
        }
      }
      // Check if hitting a selected element → move
      const hitSel = sel.find(s => {
        const h = hitTest(b, bx, by);
        return h && h.kind === s.kind && h.idx === s.idx;
      });
      if (hitSel || (sel.length > 0 && hitTest(b, bx, by) && sel.some(s => {
        const h = hitTest(b, bx, by);
        return h && h.kind === s.kind && h.idx === s.idx;
      }))) {
        dragRef.current = { type: "move", startSX: sx, startSY: sy, startBX: bx, startBY: by, origBoard: b };
        return;
      }
      // Hit any element → select it and move
      const hit = hitTest(b, bx, by);
      if (hit) {
        setSelected([hit]);
        selectedRef.current = [hit];
        dragRef.current = { type: "move", startSX: sx, startSY: sy, startBX: bx, startBY: by, origBoard: b };
        return;
      }
      // Empty space → rubber band
      setSelected([]);
      selectedRef.current = [];
      setRubber({ bx1: bx, by1: by, bx2: bx, by2: by });
      dragRef.current = { type: "rubber", startSX: sx, startSY: sy, startBX: bx, startBY: by };
      return;
    }

    // Placement tools that require drag (draw rect)
    if (t === "wall" || t === "slingshot" || t === "target") {
      setPreview({ bx1: bx, by1: by, bx2: bx, by2: by });
      dragRef.current = { type: "draw", startSX: sx, startSY: sy, startBX: bx, startBY: by };
      return;
    }

    // Point-place tools
    const b = boardRef.current;
    if (t === "bumper") {
      const nb: BoardBumper = { x: snap(bx), y: snap(by), r: 16, label: String.fromCharCode(65 + b.bumpers.length) };
      setBoard(prev => ({ ...prev, bumpers: [...prev.bumpers, nb] }));
    } else if (t === "post") {
      const np: BoardPost = { x: snap(bx), y: snap(by), r: 5 };
      setBoard(prev => ({ ...prev, posts: [...prev.posts, np] }));
    } else if (t === "flipper-l") {
      const nf: BoardFlipper = { side: "left", pivotX: snap(bx), pivotY: snap(by), length: 60 };
      setBoard(prev => ({ ...prev, flippers: [...prev.flippers, nf] }));
    } else if (t === "flipper-r") {
      const nf: BoardFlipper = { side: "right", pivotX: snap(bx), pivotY: snap(by), length: 60 };
      setBoard(prev => ({ ...prev, flippers: [...prev.flippers, nf] }));
    }
  }, [getCanvasCoords, setBoard]);

  // ── Pointer move ────────────────────────────────────────────────────────────

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;

    // Pinch-to-zoom: two active pointers
    const ptrs = [...pointersRef.current.values()];
    if (ptrs.length === 2) {
      const [p0, p1] = ptrs;
      const [ax0, ay0] = getCanvasCoords(p0.x, p0.y);
      const [ax1, ay1] = getCanvasCoords(p1.x, p1.y);
      const dist = Math.hypot(ax1 - ax0, ay1 - ay0);
      const midSX = (ax0 + ax1) / 2, midSY = (ay0 + ay1) / 2;

      const prev = (dragRef.current as { prevDist?: number; prevMidX?: number; prevMidY?: number } | null);
      if (prev && prev.prevDist) {
        const ratio = dist / prev.prevDist;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * ratio));
        const pinchBX = (midSX - v.x) / v.scale;
        const pinchBY = (midSY - v.y) / v.scale;
        const newX = midSX - pinchBX * newScale + (midSX - prev.prevMidX!) * 0;
        const newY = midSY - pinchBY * newScale + (midSY - prev.prevMidY!) * 0;
        setView({ x: newX, y: newY, scale: newScale });
      }
      (dragRef.current as { prevDist?: number; prevMidX?: number; prevMidY?: number } | null) && Object.assign(dragRef.current!, { prevDist: dist, prevMidX: midSX, prevMidY: midSY });
      if (!dragRef.current) dragRef.current = { type: "pan", startSX: 0, startSY: 0, startBX: 0, startBY: 0 };
      Object.assign(dragRef.current, { prevDist: dist, prevMidX: midSX, prevMidY: midSY });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const [sx, sy] = getCanvasCoords(e.clientX, e.clientY);
    const [bx, by] = s2b(sx, sy, v);

    if (drag.type === "pan") {
      const newX = (drag.startViewX ?? v.x) + (sx - drag.startSX);
      const newY = (drag.startViewY ?? v.y) + (sy - drag.startSY);
      setView({ ...v, x: newX, y: newY });
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
      // Re-read latest board for handle drag, keep applying to original for stable ref handling
      setBoard(() => applyHandleDrag(drag.origBoard!, sel[0], drag.handle!, bx, by));
      return;
    }
  }, [getCanvasCoords, setBoard]);

  // ── Pointer up ──────────────────────────────────────────────────────────────

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    pointersRef.current.delete(e.pointerId);
    const v = viewRef.current;
    const drag = dragRef.current;

    if (drag?.type === "rubber") {
      const sel = selectAllInBand(boardRef.current, drag.startBX, drag.startBY,
        ...s2b(...getCanvasCoords(e.clientX, e.clientY) as [number, number], v) as [number, number]);
      setSelected(sel);
      selectedRef.current = sel;
      setRubber(null);
      dragRef.current = null;
      return;
    }

    if (drag?.type === "draw") {
      const t = toolRef.current;
      const [sx, sy] = getCanvasCoords(e.clientX, e.clientY);
      const [bx, by] = s2b(sx, sy, v);
      const cx = snap((drag.startBX + bx) / 2);
      const cy = snap((drag.startBY + by) / 2);
      const w = Math.max(8, Math.abs(bx - drag.startBX));
      const h = Math.max(8, Math.abs(by - drag.startBY));
      if (t === "wall") {
        const nw: BoardWall = { x: cx, y: cy, w, h };
        setBoard(prev => ({ ...prev, walls: [...prev.walls, nw] }));
      } else if (t === "slingshot") {
        const ns: BoardSlingshot = { x: cx, y: cy, w, h };
        setBoard(prev => ({ ...prev, slingshots: [...prev.slingshots, ns] }));
      } else if (t === "target") {
        const nt: BoardTarget = { x: cx, y: cy, w, h, label: String(boardRef.current.targets.length + 1) };
        setBoard(prev => ({ ...prev, targets: [...prev.targets, nt] }));
      }
      setPreview(null);
      dragRef.current = null;
      return;
    }

    dragRef.current = null;
  }, [getCanvasCoords, setBoard]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    dragRef.current = null;
    setRubber(null);
    setPreview(null);
  }, []);

  // ── Mouse wheel zoom ────────────────────────────────────────────────────────

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const v = viewRef.current;
    const [sx, sy] = getCanvasCoords(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
    const bx = (sx - v.x) / v.scale;
    const by = (sy - v.y) / v.scale;
    setView({ scale: newScale, x: sx - bx * newScale, y: sy - by * newScale });
  }, [getCanvasCoords]);

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = selectedRef.current;
        if (sel.length > 0) {
          setBoard(prev => deleteItems(prev, sel));
          setSelected([]);
        }
      }
      if (e.key === "Escape") {
        setSelected([]);
        setShowProps(false);
        setShowFileMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setBoard]);

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target?.result as string) as Board;
          setBoard(parsed);
          setSelected([]);
        } catch { /* ignore */ }
      };
      reader.readAsText(file);
    };
    input.click();
    setShowFileMenu(false);
  }, [setBoard]);

  // ── Properties form ─────────────────────────────────────────────────────────

  const renderPropsModal = () => {
    if (!showProps || selected.length !== 1) return null;
    const s = selected[0];

    const numField = (label: string, val: number, onChange: (v: number) => void) => (
      <div className="pbed__field" key={label}>
        <label>{label}</label>
        <input type="number" value={val} onChange={ev => onChange(Number(ev.target.value))} />
      </div>
    );
    const strField = (label: string, val: string, onChange: (v: string) => void) => (
      <div className="pbed__field" key={label}>
        <label>{label}</label>
        <input type="text" value={val} onChange={ev => onChange(ev.target.value)} />
      </div>
    );

    const deleteEl = () => {
      setBoard(prev => deleteItems(prev, selected));
      setSelected([]);
      setShowProps(false);
    };

    let fields: React.ReactNode = null;
    let title = "";

    if (s.kind === "wall") {
      const w = board.walls[s.idx];
      const upd = (p: Partial<BoardWall>) => setBoard(prev => {
        const walls = [...prev.walls]; walls[s.idx] = { ...walls[s.idx], ...p }; return { ...prev, walls };
      });
      title = "WALL";
      fields = <>
        {numField("X", w.x, v => upd({ x: v }))}
        {numField("Y", w.y, v => upd({ y: v }))}
        {numField("W", w.w, v => upd({ w: v }))}
        {numField("H", w.h, v => upd({ h: v }))}
        {numField("ANGLE", w.angle ?? 0, v => upd({ angle: v }))}
      </>;
    } else if (s.kind === "bumper") {
      const b = board.bumpers[s.idx];
      const upd = (p: Partial<BoardBumper>) => setBoard(prev => {
        const bumpers = [...prev.bumpers]; bumpers[s.idx] = { ...bumpers[s.idx], ...p }; return { ...prev, bumpers };
      });
      title = "BUMPER";
      fields = <>
        {numField("X", b.x, v => upd({ x: v }))}
        {numField("Y", b.y, v => upd({ y: v }))}
        {numField("RADIUS", b.r, v => upd({ r: v }))}
        {strField("LABEL", b.label ?? "", v => upd({ label: v }))}
      </>;
    } else if (s.kind === "post") {
      const p = board.posts[s.idx];
      const upd = (patch: Partial<BoardPost>) => setBoard(prev => {
        const posts = [...prev.posts]; posts[s.idx] = { ...posts[s.idx], ...patch }; return { ...prev, posts };
      });
      title = "POST";
      fields = <>
        {numField("X", p.x, v => upd({ x: v }))}
        {numField("Y", p.y, v => upd({ y: v }))}
        {numField("RADIUS", p.r, v => upd({ r: v }))}
      </>;
    } else if (s.kind === "flipper") {
      const f = board.flippers[s.idx];
      const upd = (p: Partial<BoardFlipper>) => setBoard(prev => {
        const flippers = [...prev.flippers]; flippers[s.idx] = { ...flippers[s.idx], ...p }; return { ...prev, flippers };
      });
      title = `FLIPPER (${f.side.toUpperCase()})`;
      fields = <>
        {numField("PIVOT X", f.pivotX, v => upd({ pivotX: v }))}
        {numField("PIVOT Y", f.pivotY, v => upd({ pivotY: v }))}
        {numField("LENGTH", f.length, v => upd({ length: v }))}
      </>;
    } else if (s.kind === "slingshot") {
      const sl = board.slingshots[s.idx];
      const upd = (p: Partial<BoardSlingshot>) => setBoard(prev => {
        const slingshots = [...prev.slingshots]; slingshots[s.idx] = { ...slingshots[s.idx], ...p }; return { ...prev, slingshots };
      });
      title = "SLINGSHOT";
      fields = <>
        {numField("X", sl.x, v => upd({ x: v }))}
        {numField("Y", sl.y, v => upd({ y: v }))}
        {numField("W", sl.w, v => upd({ w: v }))}
        {numField("H", sl.h, v => upd({ h: v }))}
        {numField("ANGLE", sl.angle ?? 0, v => upd({ angle: v }))}
      </>;
    } else if (s.kind === "target") {
      const t = board.targets[s.idx];
      const upd = (p: Partial<BoardTarget>) => setBoard(prev => {
        const targets = [...prev.targets]; targets[s.idx] = { ...targets[s.idx], ...p }; return { ...prev, targets };
      });
      title = "TARGET";
      fields = <>
        {numField("X", t.x, v => upd({ x: v }))}
        {numField("Y", t.y, v => upd({ y: v }))}
        {numField("W", t.w, v => upd({ w: v }))}
        {numField("H", t.h, v => upd({ h: v }))}
        {numField("ANGLE", t.angle ?? 0, v => upd({ angle: v }))}
        {strField("LABEL", t.label ?? "", v => upd({ label: v }))}
      </>;
    }

    return (
      <div className="pbed__modal-backdrop" onClick={() => setShowProps(false)}>
        <div className="pbed__modal" onClick={e => e.stopPropagation()}>
          <div className="pbed__modal-header">
            <span>{title}</span>
            <button className="pbed__modal-close" onClick={() => setShowProps(false)}>✕</button>
          </div>
          <div className="pbed__modal-body">{fields}</div>
          <div className="pbed__modal-footer">
            <button className="pbed__delete-btn" onClick={deleteEl}>DELETE</button>
            <button className="pbed__ok-btn" onClick={() => setShowProps(false)}>OK</button>
          </div>
        </div>
      </div>
    );
  };

  const tools: Tool[] = ["select", "wall", "bumper", "post", "flipper-l", "flipper-r", "slingshot", "target", "delete"];

  const canvasMode = tool === null ? "pan"
    : tool === "select" ? "select"
    : tool === "delete" ? "delete"
    : "place";

  return (
    <div className="pbed">
      {/* Menu bar */}
      <div className="pbed__menubar">
        <span className="pbed__title">PINBALL EDITOR</span>
        <div style={{ position: "relative" }}>
          <button
            className="pbed__menu-btn"
            onClick={() => setShowFileMenu(v => !v)}
            title="File menu"
          >
            ☰
          </button>
          {showFileMenu && (
            <div className="pbed__dropdown">
              <button className="pbed__dropdown-item" onClick={() => { exportBoard(board); setShowFileMenu(false); }}>EXPORT JSON</button>
              <button className="pbed__dropdown-item" onClick={handleImport}>IMPORT JSON</button>
              <div className="pbed__dropdown-sep" />
              <button className="pbed__dropdown-item" onClick={() => { setTestPlay(true); setShowFileMenu(false); }}>▶ TEST PLAY</button>
              <div className="pbed__dropdown-sep" />
              <button className="pbed__dropdown-item" onClick={() => {
                if (confirm("Reset to classic board?")) { setBoard(classicBoard as Board); setSelected([]); setShowFileMenu(false); }
              }}>RESET TO CLASSIC</button>
              <button className="pbed__dropdown-item pbed__dropdown-item--danger" onClick={() => {
                if (confirm("Clear the entire board?")) { setBoard(prev => ({ ...prev, walls: [], bumpers: [], posts: [], flippers: [], slingshots: [], targets: [] })); setSelected([]); setShowFileMenu(false); }
              }}>CLEAR ALL</button>
            </div>
          )}
        </div>
      </div>

      {/* Tool bar */}
      <div className="pbed__toolbar">
        <button
          className={`pbed__tool-btn${tool === null ? " pbed__tool-btn--active" : ""}`}
          onClick={() => { setTool(null); setSelected([]); }}
          title="Pan / zoom (no tool)"
        >
          ✋
        </button>
        {tools.map(t => (
          <button
            key={t}
            className={`pbed__tool-btn${tool === t ? " pbed__tool-btn--active" : ""}${t === "delete" ? " pbed__tool-btn--danger" : ""}`}
            onClick={() => { setTool(prev => prev === t ? null : t); if (t !== "select") setSelected([]); }}
            title={TOOL_LABELS[t]}
          >
            {TOOL_LABELS[t]}
          </button>
        ))}
      </div>

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
          style={{ touchAction: "none" }}
        />
        {/* Floating ✏️ properties button */}
        {selected.length === 1 && !showProps && (
          <button
            className="pbed__props-fab"
            onClick={() => setShowProps(true)}
            title="Edit properties"
          >
            ✏️
          </button>
        )}
        {/* Floating zoom buttons */}
        <div className="pbed__zoom-btns">
          <button className="pbed__zoom-btn" onClick={() => setView(v => {
            const s = Math.min(MAX_SCALE, v.scale * 1.25);
            const cx = (canvasRef.current?.width ?? 400) / 2;
            const cy = (canvasRef.current?.height ?? 600) / 2;
            const bx = (cx - v.x) / v.scale, by = (cy - v.y) / v.scale;
            return { scale: s, x: cx - bx * s, y: cy - by * s };
          })}>+</button>
          <button className="pbed__zoom-btn" onClick={() => setView({
            x: 20, y: 20, scale: Math.min(
              (canvasRef.current?.width ?? 400) / board.width * 0.9,
              (canvasRef.current?.height ?? 600) / board.height * 0.9
            ),
          })}>FIT</button>
          <button className="pbed__zoom-btn" onClick={() => setView(v => {
            const s = Math.max(MIN_SCALE, v.scale * 0.8);
            const cx = (canvasRef.current?.width ?? 400) / 2;
            const cy = (canvasRef.current?.height ?? 600) / 2;
            const bx = (cx - v.x) / v.scale, by = (cy - v.y) / v.scale;
            return { scale: s, x: cx - bx * s, y: cy - by * s };
          })}>−</button>
        </div>
      </div>

      {/* Properties modal */}
      {renderPropsModal()}

      {/* Test play overlay */}
      {testPlay && (
        <div className="pbed__overlay">
          <div className="pbed__overlay-title">TEST PLAY</div>
          <Pinball board={board} onQuit={() => setTestPlay(false)} />
          <button className="pbed__overlay-btn" onClick={() => setTestPlay(false)}>EXIT TEST PLAY</button>
        </div>
      )}

      {/* Click-away to close file menu */}
      {showFileMenu && <div className="pbed__backdrop" onClick={() => setShowFileMenu(false)} />}
    </div>
  );
}
