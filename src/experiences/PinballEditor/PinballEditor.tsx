import { useEffect, useRef, useState, useCallback } from "react";
import type {
  Board, BoardWall, BoardBumper, BoardPost, BoardFlipper,
  BoardSlingshot, BoardTarget,
} from "../Pinball/boardTypes";
import Pinball from "../Pinball/Pinball";
import classicBoard from "../Pinball/boards/classic.json";
import "./PinballEditor.css";

const LS_KEY = "pinball_editor_board";
const SCALE = 2;

type Tool = "select" | "wall" | "bumper" | "post" | "flipper-l" | "flipper-r"
  | "slingshot" | "target" | "delete";

type SelectedElement =
  | { kind: "wall"; idx: number }
  | { kind: "bumper"; idx: number }
  | { kind: "post"; idx: number }
  | { kind: "flipper"; idx: number }
  | { kind: "slingshot"; idx: number }
  | { kind: "target"; idx: number }
  | null;

function defaultBoard(): Board {
  return classicBoard as Board;
}

function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Board;
  } catch { /* ignore */ }
  return defaultBoard();
}

function saveBoard(board: Board) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(board)); } catch { /* ignore */ }
}

function exportBoard(board: Board) {
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pinball-board.json";
  a.click();
  URL.revokeObjectURL(url);
}

function snap(v: number) { return Math.round(v / 4) * 4; }

function drawBoard(ctx: CanvasRenderingContext2D, board: Board, selected: SelectedElement, scale: number) {
  const W = board.width * scale;
  const H = board.height * scale;
  const s = scale;

  ctx.fillStyle = "#0a0018";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(80,40,140,0.3)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= board.width; x += 10) {
    ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, H); ctx.stroke();
  }
  for (let y = 0; y <= board.height; y += 10) {
    ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(W, y * s); ctx.stroke();
  }

  // Outer boundary
  ctx.strokeStyle = "#5030a0";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Walls
  board.walls.forEach((w, i) => {
    const sel = selected?.kind === "wall" && selected.idx === i;
    ctx.save();
    ctx.translate(w.x * s, w.y * s);
    ctx.rotate(w.angle ?? 0);
    ctx.fillStyle = sel ? "#8060ff" : "#2a1050";
    ctx.strokeStyle = sel ? "#c0a0ff" : "#5030a0";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-w.w / 2 * s, -w.h / 2 * s, w.w * s, w.h * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // Targets
  board.targets.forEach((t, i) => {
    const sel = selected?.kind === "target" && selected.idx === i;
    ctx.save();
    ctx.translate(t.x * s, t.y * s);
    ctx.rotate(t.angle ?? 0);
    ctx.fillStyle = sel ? "#ff9030" : "#cc4400";
    ctx.strokeStyle = sel ? "#ffc080" : "#ffcc88";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-t.w / 2 * s, -t.h / 2 * s, t.w * s, t.h * s);
    ctx.fill();
    ctx.stroke();
    if (t.label) {
      ctx.fillStyle = "#fff";
      ctx.font = `${5 * s}px 'Press Start 2P'`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.label, 0, 0);
    }
    ctx.restore();
  });

  // Slingshots
  board.slingshots.forEach((sl, i) => {
    const sel = selected?.kind === "slingshot" && selected.idx === i;
    ctx.save();
    ctx.translate(sl.x * s, sl.y * s);
    ctx.rotate(sl.angle ?? 0);
    ctx.fillStyle = sel ? "#9060e0" : "#5b2d8e";
    ctx.strokeStyle = sel ? "#d0a0ff" : "#9060d0";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-sl.w / 2 * s, -sl.h / 2 * s, sl.w * s, sl.h * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // Bumpers
  board.bumpers.forEach((b, i) => {
    const sel = selected?.kind === "bumper" && selected.idx === i;
    ctx.beginPath();
    ctx.arc(b.x * s, b.y * s, b.r * s, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#e0b0ff" : "#7b3dbe";
    ctx.strokeStyle = sel ? "#fff" : "#c080ff";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.fill();
    ctx.stroke();
    if (b.label) {
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(5, Math.floor(b.r * 0.6)) * s}px 'Press Start 2P'`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x * s, b.y * s);
    }
  });

  // Posts
  board.posts.forEach((p, i) => {
    const sel = selected?.kind === "post" && selected.idx === i;
    ctx.beginPath();
    ctx.arc(p.x * s, p.y * s, p.r * s, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#ffffff" : "#c0c0c0";
    ctx.strokeStyle = sel ? "#ffd700" : "#808080";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.fill();
    ctx.stroke();
  });

  // Flippers
  board.flippers.forEach((f, i) => {
    const sel = selected?.kind === "flipper" && selected.idx === i;
    const restAngle = f.side === "left" ? 0.5 : -0.5;
    const len = f.length;
    ctx.save();
    ctx.translate(f.pivotX * s, f.pivotY * s);
    ctx.rotate(restAngle);
    ctx.fillStyle = sel ? "#ffffff" : "#c0c0c0";
    ctx.strokeStyle = sel ? "#ffd700" : "#606060";
    ctx.lineWidth = sel ? 2 : 1;
    if (f.side === "left") {
      ctx.beginPath();
      ctx.rect(0, -4 * s, len * s, 8 * s);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(-len * s, -4 * s, len * s, 8 * s);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    // Pivot dot
    ctx.beginPath();
    ctx.arc(f.pivotX * s, f.pivotY * s, 4 * s, 0, Math.PI * 2);
    ctx.fillStyle = sel ? "#ffd700" : "#d0d0d0";
    ctx.fill();
  });

  // Plunger lane
  const pl = board.plunger;
  ctx.fillStyle = "rgba(200,150,255,0.3)";
  ctx.strokeStyle = "#a080e0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect((pl.x - 15) * s, pl.topY * s, 20 * s, (pl.bottomY - pl.topY) * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a080e0";
  ctx.font = `${5 * s}px 'Press Start 2P'`;
  ctx.textAlign = "center";
  ctx.fillText("P", pl.x * s, (pl.topY + 10) * s);

  // Ball start
  ctx.beginPath();
  ctx.arc(board.ballStartX * s, board.ballStartY * s, 10 * s, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `${5 * s}px 'Press Start 2P'`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B", board.ballStartX * s, board.ballStartY * s);
}

function hitTest(board: Board, bx: number, by: number): SelectedElement {
  // Reverse order so top-drawn items take priority
  for (let i = board.flippers.length - 1; i >= 0; i--) {
    const f = board.flippers[i];
    const dx = bx - f.pivotX, dy = by - f.pivotY;
    if (Math.hypot(dx, dy) < 12) return { kind: "flipper", idx: i };
    const restAngle = f.side === "left" ? 0.5 : -0.5;
    const cos = Math.cos(-restAngle), sin = Math.sin(-restAngle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const halfLen = f.length / 2;
    if (f.side === "left") {
      if (lx >= -4 && lx <= f.length + 4 && ly >= -8 && ly <= 8) return { kind: "flipper", idx: i };
    } else {
      if (lx >= -f.length - 4 && lx <= 4 && ly >= -8 && ly <= 8) return { kind: "flipper", idx: i };
    }
    void halfLen;
  }
  for (let i = board.bumpers.length - 1; i >= 0; i--) {
    const b = board.bumpers[i];
    if (Math.hypot(bx - b.x, by - b.y) <= b.r + 4) return { kind: "bumper", idx: i };
  }
  for (let i = board.posts.length - 1; i >= 0; i--) {
    const p = board.posts[i];
    if (Math.hypot(bx - p.x, by - p.y) <= p.r + 4) return { kind: "post", idx: i };
  }
  for (let i = board.slingshots.length - 1; i >= 0; i--) {
    const sl = board.slingshots[i];
    const angle = sl.angle ?? 0;
    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    const dx = bx - sl.x, dy = by - sl.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (Math.abs(lx) <= sl.w / 2 + 4 && Math.abs(ly) <= sl.h / 2 + 4) return { kind: "slingshot", idx: i };
  }
  for (let i = board.targets.length - 1; i >= 0; i--) {
    const t = board.targets[i];
    const angle = t.angle ?? 0;
    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    const dx = bx - t.x, dy = by - t.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (Math.abs(lx) <= t.w / 2 + 4 && Math.abs(ly) <= t.h / 2 + 4) return { kind: "target", idx: i };
  }
  for (let i = board.walls.length - 1; i >= 0; i--) {
    const w = board.walls[i];
    const angle = w.angle ?? 0;
    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    const dx = bx - w.x, dy = by - w.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (Math.abs(lx) <= w.w / 2 + 4 && Math.abs(ly) <= w.h / 2 + 4) return { kind: "wall", idx: i };
  }
  return null;
}

const TOOL_LABELS: Record<Tool, string> = {
  select: "SELECT",
  wall: "WALL",
  bumper: "BUMPER",
  post: "POST",
  "flipper-l": "FLIP L",
  "flipper-r": "FLIP R",
  slingshot: "SLING",
  target: "TARGET",
  delete: "DELETE",
};

export default function PinballEditor() {
  const [board, setBoardRaw] = useState<Board>(loadBoard);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<SelectedElement>(null);
  const [testPlay, setTestPlay] = useState(false);
  const [status, setStatus] = useState("Ready. Click canvas to place elements.");
  const [dragStart, setDragStart] = useState<{ bx: number; by: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef(board);

  const setBoard = useCallback((b: Board | ((prev: Board) => Board)) => {
    setBoardRaw((prev) => {
      const next = typeof b === "function" ? b(prev) : b;
      boardRef.current = next;
      saveBoard(next);
      return next;
    });
  }, []);

  // Draw whenever board/selected/drawRect changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBoard(ctx, board, selected, SCALE);

    // Draw in-progress rect
    if (drawRect) {
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(drawRect.x * SCALE, drawRect.y * SCALE, drawRect.w * SCALE, drawRect.h * SCALE);
      ctx.setLineDash([]);
    }
  }, [board, selected, drawRect]);

  const canvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { bx: number; by: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / SCALE;
    const cy = (e.clientY - rect.top) / SCALE;
    return { bx: snap(cx), by: snap(cy) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { bx, by } = canvasCoords(e);

    if (tool === "select") {
      const hit = hitTest(board, bx, by);
      setSelected(hit);
      if (hit) setDragStart({ bx, by });
      return;
    }

    if (tool === "delete") {
      const hit = hitTest(board, bx, by);
      if (!hit) return;
      setBoard((prev) => {
        const next = { ...prev };
        if (hit.kind === "wall") next.walls = prev.walls.filter((_, i) => i !== hit.idx);
        else if (hit.kind === "bumper") next.bumpers = prev.bumpers.filter((_, i) => i !== hit.idx);
        else if (hit.kind === "post") next.posts = prev.posts.filter((_, i) => i !== hit.idx);
        else if (hit.kind === "flipper") next.flippers = prev.flippers.filter((_, i) => i !== hit.idx);
        else if (hit.kind === "slingshot") next.slingshots = prev.slingshots.filter((_, i) => i !== hit.idx);
        else if (hit.kind === "target") next.targets = prev.targets.filter((_, i) => i !== hit.idx);
        return next;
      });
      setSelected(null);
      return;
    }

    if (tool === "wall" || tool === "slingshot" || tool === "target") {
      setDragStart({ bx, by });
      return;
    }

    // Point-place tools
    if (tool === "bumper") {
      const newBumper: BoardBumper = { x: bx, y: by, r: 16, label: String.fromCharCode(65 + board.bumpers.length) };
      setBoard((prev) => ({ ...prev, bumpers: [...prev.bumpers, newBumper] }));
      setStatus(`Added bumper at (${bx}, ${by})`);
    } else if (tool === "post") {
      const newPost: BoardPost = { x: bx, y: by, r: 5 };
      setBoard((prev) => ({ ...prev, posts: [...prev.posts, newPost] }));
      setStatus(`Added post at (${bx}, ${by})`);
    } else if (tool === "flipper-l") {
      const newFlipper: BoardFlipper = { side: "left", pivotX: bx, pivotY: by, length: 60 };
      setBoard((prev) => ({ ...prev, flippers: [...prev.flippers, newFlipper] }));
      setStatus(`Added left flipper at (${bx}, ${by})`);
    } else if (tool === "flipper-r") {
      const newFlipper: BoardFlipper = { side: "right", pivotX: bx, pivotY: by, length: 60 };
      setBoard((prev) => ({ ...prev, flippers: [...prev.flippers, newFlipper] }));
      setStatus(`Added right flipper at (${bx}, ${by})`);
    }
  }, [tool, board, canvasCoords, setBoard]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { bx, by } = canvasCoords(e);
    setStatus(`(${bx}, ${by})`);

    if (!dragStart) return;

    if (tool === "select" && selected) {
      const dx = bx - dragStart.bx;
      const dy = by - dragStart.by;
      setDragStart({ bx, by });
      setBoard((prev) => {
        const next = { ...prev };
        if (selected.kind === "wall") {
          next.walls = prev.walls.map((w, i) =>
            i === selected.idx ? { ...w, x: snap(w.x + dx), y: snap(w.y + dy) } : w
          );
        } else if (selected.kind === "bumper") {
          next.bumpers = prev.bumpers.map((b, i) =>
            i === selected.idx ? { ...b, x: snap(b.x + dx), y: snap(b.y + dy) } : b
          );
        } else if (selected.kind === "post") {
          next.posts = prev.posts.map((p, i) =>
            i === selected.idx ? { ...p, x: snap(p.x + dx), y: snap(p.y + dy) } : p
          );
        } else if (selected.kind === "flipper") {
          next.flippers = prev.flippers.map((f, i) =>
            i === selected.idx ? { ...f, pivotX: snap(f.pivotX + dx), pivotY: snap(f.pivotY + dy) } : f
          );
        } else if (selected.kind === "slingshot") {
          next.slingshots = prev.slingshots.map((sl, i) =>
            i === selected.idx ? { ...sl, x: snap(sl.x + dx), y: snap(sl.y + dy) } : sl
          );
        } else if (selected.kind === "target") {
          next.targets = prev.targets.map((t, i) =>
            i === selected.idx ? { ...t, x: snap(t.x + dx), y: snap(t.y + dy) } : t
          );
        }
        return next;
      });
      return;
    }

    if ((tool === "wall" || tool === "slingshot" || tool === "target") && dragStart) {
      const x = Math.min(dragStart.bx, bx);
      const y = Math.min(dragStart.by, by);
      const w = Math.abs(bx - dragStart.bx);
      const h = Math.abs(by - dragStart.by);
      setDrawRect({ x, y, w, h });
    }
  }, [dragStart, tool, selected, canvasCoords, setBoard]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { bx, by } = canvasCoords(e);
    if (!dragStart) return;

    if (tool === "wall" || tool === "slingshot" || tool === "target") {
      const x = snap((dragStart.bx + bx) / 2);
      const y = snap((dragStart.by + by) / 2);
      const w = Math.max(8, Math.abs(bx - dragStart.bx));
      const h = Math.max(8, Math.abs(by - dragStart.by));
      if (tool === "wall") {
        const newWall: BoardWall = { x, y, w, h };
        setBoard((prev) => ({ ...prev, walls: [...prev.walls, newWall] }));
        setStatus(`Added wall ${w}×${h} at (${x}, ${y})`);
      } else if (tool === "slingshot") {
        const newSling: BoardSlingshot = { x, y, w, h };
        setBoard((prev) => ({ ...prev, slingshots: [...prev.slingshots, newSling] }));
        setStatus(`Added slingshot at (${x}, ${y})`);
      } else if (tool === "target") {
        const newTarget: BoardTarget = { x, y, w, h, label: String(board.targets.length + 1) };
        setBoard((prev) => ({ ...prev, targets: [...prev.targets, newTarget] }));
        setStatus(`Added target at (${x}, ${y})`);
      }
    }

    setDragStart(null);
    setDrawRect(null);
  }, [dragStart, tool, board, canvasCoords, setBoard]);

  const handleMouseLeave = useCallback(() => {
    if (tool !== "select") {
      setDragStart(null);
      setDrawRect(null);
    }
  }, [tool]);

  const handleClearAll = useCallback(() => {
    if (!confirm("Clear the entire board?")) return;
    setBoard({ ...board, walls: [], bumpers: [], posts: [], flippers: [], slingshots: [], targets: [] });
    setSelected(null);
  }, [board, setBoard]);

  const handleResetToClassic = useCallback(() => {
    if (!confirm("Reset to classic board? All changes will be lost.")) return;
    const b = defaultBoard();
    setBoard(b);
    setSelected(null);
  }, [setBoard]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string) as Board;
          setBoard(parsed);
          setSelected(null);
          setStatus("Board imported.");
        } catch { setStatus("Import failed: invalid JSON."); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setBoard]);

  // Properties panel for selected element
  const renderProperties = () => {
    if (!selected) return <div className="pbed__panel-section"><div className="pbed__panel-title">PROPERTIES</div><div style={{ fontSize: "5px", color: "#666" }}>Nothing selected.<br/>Use Select tool and click an element.</div></div>;

    const deleteSelected = () => {
      setBoard((prev) => {
        const next = { ...prev };
        if (selected.kind === "wall") next.walls = prev.walls.filter((_, i) => i !== selected.idx);
        else if (selected.kind === "bumper") next.bumpers = prev.bumpers.filter((_, i) => i !== selected.idx);
        else if (selected.kind === "post") next.posts = prev.posts.filter((_, i) => i !== selected.idx);
        else if (selected.kind === "flipper") next.flippers = prev.flippers.filter((_, i) => i !== selected.idx);
        else if (selected.kind === "slingshot") next.slingshots = prev.slingshots.filter((_, i) => i !== selected.idx);
        else if (selected.kind === "target") next.targets = prev.targets.filter((_, i) => i !== selected.idx);
        return next;
      });
      setSelected(null);
    };

    const numField = (label: string, value: number, onChange: (v: number) => void) => (
      <div className="pbed__field" key={label}>
        <label>{label}</label>
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    );

    const strField = (label: string, value: string, onChange: (v: string) => void) => (
      <div className="pbed__field" key={label}>
        <label>{label}</label>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    );

    if (selected.kind === "wall") {
      const w = board.walls[selected.idx];
      const upd = (patch: Partial<BoardWall>) => setBoard((prev) => {
        const walls = [...prev.walls];
        walls[selected.idx] = { ...walls[selected.idx], ...patch };
        return { ...prev, walls };
      });
      return (
        <div className="pbed__panel-section">
          <div className="pbed__panel-title">WALL</div>
          {numField("X", w.x, (v) => upd({ x: v }))}
          {numField("Y", w.y, (v) => upd({ y: v }))}
          {numField("W", w.w, (v) => upd({ w: v }))}
          {numField("H", w.h, (v) => upd({ h: v }))}
          {numField("ANGLE (rad)", w.angle ?? 0, (v) => upd({ angle: v }))}
          <button className="pbed__delete-btn" onClick={deleteSelected}>DELETE</button>
        </div>
      );
    }
    if (selected.kind === "bumper") {
      const b = board.bumpers[selected.idx];
      const upd = (patch: Partial<BoardBumper>) => setBoard((prev) => {
        const bumpers = [...prev.bumpers];
        bumpers[selected.idx] = { ...bumpers[selected.idx], ...patch };
        return { ...prev, bumpers };
      });
      return (
        <div className="pbed__panel-section">
          <div className="pbed__panel-title">BUMPER</div>
          {numField("X", b.x, (v) => upd({ x: v }))}
          {numField("Y", b.y, (v) => upd({ y: v }))}
          {numField("RADIUS", b.r, (v) => upd({ r: v }))}
          {strField("LABEL", b.label ?? "", (v) => upd({ label: v }))}
          <button className="pbed__delete-btn" onClick={deleteSelected}>DELETE</button>
        </div>
      );
    }
    if (selected.kind === "post") {
      const p = board.posts[selected.idx];
      const upd = (patch: Partial<BoardPost>) => setBoard((prev) => {
        const posts = [...prev.posts];
        posts[selected.idx] = { ...posts[selected.idx], ...patch };
        return { ...prev, posts };
      });
      return (
        <div className="pbed__panel-section">
          <div className="pbed__panel-title">POST</div>
          {numField("X", p.x, (v) => upd({ x: v }))}
          {numField("Y", p.y, (v) => upd({ y: v }))}
          {numField("RADIUS", p.r, (v) => upd({ r: v }))}
          <button className="pbed__delete-btn" onClick={deleteSelected}>DELETE</button>
        </div>
      );
    }
    if (selected.kind === "flipper") {
      const f = board.flippers[selected.idx];
      const upd = (patch: Partial<BoardFlipper>) => setBoard((prev) => {
        const flippers = [...prev.flippers];
        flippers[selected.idx] = { ...flippers[selected.idx], ...patch };
        return { ...prev, flippers };
      });
      return (
        <div className="pbed__panel-section">
          <div className="pbed__panel-title">FLIPPER ({f.side.toUpperCase()})</div>
          {numField("PIVOT X", f.pivotX, (v) => upd({ pivotX: v }))}
          {numField("PIVOT Y", f.pivotY, (v) => upd({ pivotY: v }))}
          {numField("LENGTH", f.length, (v) => upd({ length: v }))}
          <button className="pbed__delete-btn" onClick={deleteSelected}>DELETE</button>
        </div>
      );
    }
    if (selected.kind === "slingshot") {
      const sl = board.slingshots[selected.idx];
      const upd = (patch: Partial<BoardSlingshot>) => setBoard((prev) => {
        const slingshots = [...prev.slingshots];
        slingshots[selected.idx] = { ...slingshots[selected.idx], ...patch };
        return { ...prev, slingshots };
      });
      return (
        <div className="pbed__panel-section">
          <div className="pbed__panel-title">SLINGSHOT</div>
          {numField("X", sl.x, (v) => upd({ x: v }))}
          {numField("Y", sl.y, (v) => upd({ y: v }))}
          {numField("W", sl.w, (v) => upd({ w: v }))}
          {numField("H", sl.h, (v) => upd({ h: v }))}
          {numField("ANGLE (rad)", sl.angle ?? 0, (v) => upd({ angle: v }))}
          <button className="pbed__delete-btn" onClick={deleteSelected}>DELETE</button>
        </div>
      );
    }
    if (selected.kind === "target") {
      const t = board.targets[selected.idx];
      const upd = (patch: Partial<BoardTarget>) => setBoard((prev) => {
        const targets = [...prev.targets];
        targets[selected.idx] = { ...targets[selected.idx], ...patch };
        return { ...prev, targets };
      });
      return (
        <div className="pbed__panel-section">
          <div className="pbed__panel-title">TARGET</div>
          {numField("X", t.x, (v) => upd({ x: v }))}
          {numField("Y", t.y, (v) => upd({ y: v }))}
          {numField("W", t.w, (v) => upd({ w: v }))}
          {numField("H", t.h, (v) => upd({ h: v }))}
          {numField("ANGLE (rad)", t.angle ?? 0, (v) => upd({ angle: v }))}
          {strField("LABEL", t.label ?? "", (v) => upd({ label: v }))}
          <button className="pbed__delete-btn" onClick={deleteSelected}>DELETE</button>
        </div>
      );
    }
    return null;
  };

  const tools: Tool[] = ["select", "wall", "bumper", "post", "flipper-l", "flipper-r", "slingshot", "target", "delete"];

  return (
    <div className="pbed">
      <div className="pbed__toolbar">
        <div className="pbed__toolbar-group">
          {tools.map((t) => (
            <button
              key={t}
              className={`pbed__tool-btn${tool === t ? " pbed__tool-btn--active" : ""}${t === "delete" ? " pbed__tool-btn--danger" : ""}`}
              onClick={() => { setTool(t); setSelected(null); }}
              title={TOOL_LABELS[t]}
            >
              {TOOL_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="pbed__toolbar-group">
          <button className="pbed__tool-btn" onClick={() => exportBoard(board)}>EXPORT</button>
          <button className="pbed__tool-btn" onClick={handleImport}>IMPORT</button>
          <button className="pbed__tool-btn" onClick={handleResetToClassic}>RESET</button>
          <button className="pbed__tool-btn pbed__tool-btn--danger" onClick={handleClearAll}>CLEAR ALL</button>
          <button className="pbed__tool-btn pbed__tool-btn--play" onClick={() => setTestPlay(true)}>▶ TEST PLAY</button>
        </div>
      </div>

      <div className="pbed__body">
        <div className="pbed__canvas-area">
          <canvas
            ref={canvasRef}
            width={board.width * SCALE}
            height={board.height * SCALE}
            className={`pbed__canvas${tool === "select" ? " pbed__canvas--select" : ""}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        </div>
        <div className="pbed__panel">
          <div className="pbed__panel-section">
            <div className="pbed__panel-title">TOOL</div>
            <div style={{ fontSize: "6px" }}>{TOOL_LABELS[tool]}</div>
          </div>
          {renderProperties()}
          <div className="pbed__panel-section">
            <div className="pbed__panel-title">BOARD INFO</div>
            <div style={{ fontSize: "5px", lineHeight: "1.8" }}>
              Walls: {board.walls.length}<br/>
              Bumpers: {board.bumpers.length}<br/>
              Posts: {board.posts.length}<br/>
              Flippers: {board.flippers.length}<br/>
              Slings: {board.slingshots.length}<br/>
              Targets: {board.targets.length}
            </div>
          </div>
          <div className="pbed__panel-section">
            <div className="pbed__panel-title">TIPS</div>
            <div style={{ fontSize: "5px", lineHeight: "1.8", color: "#333" }}>
              WALL/SLING/TARGET: drag to draw.<br/>
              Others: click to place.<br/>
              SELECT: click + drag to move.<br/>
              Auto-saved to localStorage.
            </div>
          </div>
        </div>
      </div>

      <div className="pbed__status">{status}</div>

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
