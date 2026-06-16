import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { JP_SCORES_ID, JP_STATE_ID, JP_IMAGE_ID } from "../NsDoors97/filesystem/types";
import { generatePieceLayout } from "./pieceShapes";
import { PUZZLE_PRESET_URLS } from "./puzzleImages";
import {
  CELL_SIZE,
  DEFAULT_CONFIG,
  DIFFICULTY_TARGET_PIECES,
  bestTimeKey,
  formatTime,
  type ImageSource,
  type JigsawConfig,
} from "./types";
import { getImageDimensions } from "../../utils/imageResize";
import JigsawSettings from "./JigsawSettings";
import "./JigsawPuzzle.css";

const SAVE_VERSION = 1;
const SNAP_THRESHOLD = 18;
const ZOOM_MIN = 0.12;
const ZOOM_MAX = 4;
const MINIMAP_MAX_W = 130;
const MINIMAP_MAX_H = 46;

interface PieceState {
  row: number;
  col: number;
  pathD: string;
  x: number;
  y: number;
  locked: boolean;
  z: number;
}

interface Session {
  config: JigsawConfig;
  rows: number;
  cols: number;
  cell: number;
  seed: number;
  bumpAmp: number;
  pieceBoxW: number;
  pieceBoxH: number;
  imageUrl: string;
  workspaceWidth: number;
  workspaceHeight: number;
  frameX: number;
  frameY: number;
  boardW: number;
  boardH: number;
  pieces: PieceState[];
}

interface SavedPiece {
  x: number;
  y: number;
  locked: boolean;
}

interface SavedState {
  version: number;
  config: JigsawConfig;
  rows: number;
  cols: number;
  seed: number;
  workspaceWidth: number;
  workspaceHeight: number;
  frameX: number;
  frameY: number;
  boardW: number;
  boardH: number;
  pieces: SavedPiece[];
  elapsedSec: number;
  savedAt: number;
}

function resolveImageUrl(source: ImageSource): string {
  if (source.kind === "preset") return PUZZLE_PRESET_URLS[source.presetId];
  return fsStore.getFile(JP_IMAGE_ID)?.content || PUZZLE_PRESET_URLS.arch;
}

function computeGrid(targetPieces: number, aspect: number): { rows: number; cols: number } {
  const cols = Math.max(2, Math.round(Math.sqrt(targetPieces * aspect)));
  const rows = Math.max(2, Math.round(targetPieces / cols));
  return { rows, cols };
}

function buildSession(
  config: JigsawConfig,
  rows: number,
  cols: number,
  cell: number,
  seed: number,
  imageUrl: string,
  saved?: SavedState
): Session {
  const layout = generatePieceLayout(rows, cols, cell, cell, seed);
  const boardW = cols * cell;
  const boardH = rows * cell;
  const workspaceWidth = saved?.workspaceWidth ?? Math.max(boardW * 2, boardW + 320);
  const workspaceHeight = saved?.workspaceHeight ?? Math.max(boardH * 2, boardH + 320);
  const frameX = saved?.frameX ?? (workspaceWidth - boardW) / 2;
  const frameY = saved?.frameY ?? (workspaceHeight - boardH) / 2;

  const pieces: PieceState[] = layout.pieces.map((p, i) => {
    const sp = saved?.pieces[i];
    return {
      row: p.row,
      col: p.col,
      pathD: p.pathD,
      x: sp?.x ?? Math.random() * (workspaceWidth - layout.pieceBoxW),
      y: sp?.y ?? Math.random() * (workspaceHeight - layout.pieceBoxH),
      locked: sp?.locked ?? false,
      z: i + 1,
    };
  });

  return {
    config, rows, cols, cell, seed,
    bumpAmp: layout.bumpAmp,
    pieceBoxW: layout.pieceBoxW,
    pieceBoxH: layout.pieceBoxH,
    imageUrl, workspaceWidth, workspaceHeight, frameX, frameY, boardW, boardH,
    pieces,
  };
}

function loadSavedState(): SavedState | null {
  const content = fsStore.getFile(JP_STATE_ID)?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as SavedState;
    if (parsed.version !== SAVE_VERSION) return null;
    if (!Array.isArray(parsed.pieces) || parsed.pieces.length !== parsed.rows * parsed.cols) return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadBestTimes(): Record<string, number> {
  const content = fsStore.getFile(JP_SCORES_ID)?.content;
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") return parsed as Record<string, number>;
    return {};
  } catch {
    return {};
  }
}

// ── Piece view ────────────────────────────────────────────────────────────

interface JigsawPieceViewProps {
  piece: PieceState;
  session: Session;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
}

const JigsawPieceView = memo(function JigsawPieceView({ piece, session, onPointerDown }: JigsawPieceViewProps) {
  const { pieceBoxW, pieceBoxH, cell, bumpAmp, boardW, boardH, imageUrl, seed } = session;
  const clipId = `jigsaw-clip-${seed}-${piece.row}-${piece.col}`;

  const handleDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation(); // prevent arena's pan handler from firing for piece touches
    onPointerDown(e);
  }, [onPointerDown]);

  return (
    <svg
      className={`jigsaw-piece${piece.locked ? " jigsaw-piece--locked" : ""}`}
      style={{ left: piece.x, top: piece.y, width: pieceBoxW, height: pieceBoxH, zIndex: piece.z }}
      viewBox={`0 0 ${pieceBoxW} ${pieceBoxH}`}
      onPointerDown={piece.locked ? undefined : handleDown}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={piece.pathD} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={imageUrl}
          x={bumpAmp - piece.col * cell}
          y={bumpAmp - piece.row * cell}
          width={boardW}
          height={boardH}
          preserveAspectRatio="none"
        />
      </g>
      <path d={piece.pathD} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
    </svg>
  );
});

// ── Main component ───────────────────────────────────────────────────────

export default function JigsawPuzzle({ onQuit }: { onQuit?: () => void } = {}) {
  const initialSave = useState(() => loadSavedState())[0];

  const [phase, setPhase] = useState<"settings" | "playing" | "won">(() =>
    initialSave ? "playing" : "settings"
  );

  const [session, setSession] = useState<Session | null>(() => {
    if (!initialSave) return null;
    const imageUrl = resolveImageUrl(initialSave.config.imageSource);
    return buildSession(
      initialSave.config,
      initialSave.rows,
      initialSave.cols,
      CELL_SIZE[initialSave.config.difficulty],
      initialSave.seed,
      imageUrl,
      initialSave
    );
  });

  const [elapsedSec, setElapsedSec] = useState(() => {
    if (!initialSave) return 0;
    const idleSec = Math.max(0, Math.floor((Date.now() - initialSave.savedAt) / 1000));
    return initialSave.elapsedSec + idleSec;
  });

  const [bestTimes, setBestTimes] = useState<Record<string, number>>(() => loadBestTimes());
  const [finalTime, setFinalTime] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);

  // View state (zoom & pan of the arena viewport)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs that mirror state for use inside event handlers (avoid stale closures)
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const sessionRef = useRef<Session | null>(session);
  const elapsedSecRef = useRef(elapsedSec);
  const bestTimesRef = useRef(bestTimes);
  const phaseRef = useRef(phase);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { elapsedSecRef.current = elapsedSec; }, [elapsedSec]);
  useEffect(() => { bestTimesRef.current = bestTimes; }, [bestTimes]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // DOM refs
  const arenaRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  // Drag & pan tracking
  const dragRef = useRef<{ index: number; offsetX: number; offsetY: number; pointerId: number } | null>(null);
  const bgPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const zCounterRef = useRef(1000);

  // ── Persistence ──────────────────────────────────────────────────────────
  const persist = useCallback((sess: Session, elapsed: number) => {
    const saved: SavedState = {
      version: SAVE_VERSION,
      config: sess.config,
      rows: sess.rows,
      cols: sess.cols,
      seed: sess.seed,
      workspaceWidth: sess.workspaceWidth,
      workspaceHeight: sess.workspaceHeight,
      frameX: sess.frameX,
      frameY: sess.frameY,
      boardW: sess.boardW,
      boardH: sess.boardH,
      pieces: sess.pieces.map((p) => ({ x: p.x, y: p.y, locked: p.locked })),
      elapsedSec: elapsed,
      savedAt: Date.now(),
    };
    try { fsStore.writeFile(JP_STATE_ID, JSON.stringify(saved)); } catch { /* ignore */ }
  }, []);

  const clearSave = useCallback(() => {
    try { fsStore.writeFile(JP_STATE_ID, ""); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (session && phase === "playing") persist(session, elapsedSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !session?.config.timed) return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, session?.config.timed]);

  // ── Minimap rendering ────────────────────────────────────────────────────
  const renderMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    const sess = sessionRef.current;
    const arena = arenaRef.current;
    if (!canvas || !sess || !arena) return;

    const { workspaceWidth: wW, workspaceHeight: wH } = sess;
    const scale = Math.min(MINIMAP_MAX_W / wW, MINIMAP_MAX_H / wH);
    const mmW = Math.max(1, Math.round(wW * scale));
    const mmH = Math.max(1, Math.round(wH * scale));

    if (canvas.width !== mmW || canvas.height !== mmH) {
      canvas.width = mmW;
      canvas.height = mmH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#2a4d2a";
    ctx.fillRect(0, 0, mmW, mmH);

    // Frame outline
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(sess.frameX * scale + 0.5, sess.frameY * scale + 0.5,
      sess.boardW * scale - 1, sess.boardH * scale - 1);

    // Pieces
    const pw = sess.pieceBoxW * scale;
    const ph = sess.pieceBoxH * scale;
    for (const p of sess.pieces) {
      ctx.fillStyle = p.locked ? "rgba(255,255,255,0.75)" : "rgba(255,200,80,0.65)";
      ctx.fillRect(p.x * scale, p.y * scale, pw, ph);
    }

    // Viewport rect
    const z = zoomRef.current;
    const pn = panRef.current;
    const aW = arena.clientWidth;
    const aH = arena.clientHeight;
    const vx = (-pn.x / z) * scale;
    const vy = (-pn.y / z) * scale;
    const vw = (aW / z) * scale;
    const vh = (aH / z) * scale;
    ctx.strokeStyle = "#ff6b00";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx + 0.5, vy + 0.5, Math.max(2, vw - 1), Math.max(2, vh - 1));
  }, []);

  const renderMinimapRef = useRef(renderMinimap);
  useEffect(() => { renderMinimapRef.current = renderMinimap; }, [renderMinimap]);
  useEffect(() => { renderMinimapRef.current(); }, [session, zoom, pan]);

  // ── View helpers ─────────────────────────────────────────────────────────
  const applyZoom = useCallback((newZ: number, screenCx: number, screenCy: number) => {
    const oldZ = zoomRef.current;
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZ));
    if (clamped === oldZ) return;
    const newPanX = screenCx - (screenCx - panRef.current.x) * (clamped / oldZ);
    const newPanY = screenCy - (screenCy - panRef.current.y) * (clamped / oldZ);
    zoomRef.current = clamped;
    panRef.current = { x: newPanX, y: newPanY };
    setZoom(clamped);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  const fitView = useCallback((sess: Session) => {
    const arena = arenaRef.current;
    if (!arena) return;
    const aW = arena.clientWidth || 600;
    const aH = arena.clientHeight || 400;
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
      Math.min(aW / (sess.boardW * 1.15), aH / (sess.boardH * 1.15))
    ));
    const px = aW / 2 - (sess.frameX + sess.boardW / 2) * z;
    const py = aH / 2 - (sess.frameY + sess.boardH / 2) * z;
    zoomRef.current = z;
    panRef.current = { x: px, y: py };
    setZoom(z);
    setPan({ x: px, y: py });
  }, []);

  // Fit view when a new puzzle starts (keyed on seed, deferred so DOM has dimensions)
  useEffect(() => {
    if (!session || phase !== "playing") return;
    const id = requestAnimationFrame(() => fitView(session));
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.seed, fitView]);

  // ── Ctrl+wheel zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = arena.getBoundingClientRect();
      applyZoom(zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15),
        e.clientX - rect.left, e.clientY - rect.top);
    };
    arena.addEventListener("wheel", handler, { passive: false });
    return () => arena.removeEventListener("wheel", handler);
  }, [applyZoom]);

  // ── Minimap interaction ──────────────────────────────────────────────────
  const handleMinimapPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 0) return;
    const canvas = minimapRef.current;
    const sess = sessionRef.current;
    const arena = arenaRef.current;
    if (!canvas || !sess || !arena || !canvas.width) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / sess.workspaceWidth;
    const worldX = ((e.clientX - rect.left) / rect.width) * canvas.width / scale;
    const worldY = ((e.clientY - rect.top) / rect.height) * canvas.height / scale;
    const z = zoomRef.current;
    const px = arena.clientWidth / 2 - worldX * z;
    const py = arena.clientHeight / 2 - worldY * z;
    panRef.current = { x: px, y: py };
    setPan({ x: px, y: py });
    e.preventDefault();
  }, []);

  // ── Puzzle actions ───────────────────────────────────────────────────────
  const startNewPuzzle = useCallback(async (config: JigsawConfig, customDataUrl: string | null) => {
    let resolvedConfig = config;
    if (config.imageSource.kind === "custom") {
      if (customDataUrl) {
        try { fsStore.writeFile(JP_IMAGE_ID, customDataUrl); } catch { /* ignore */ }
      } else if (!fsStore.getFile(JP_IMAGE_ID)?.content) {
        resolvedConfig = { ...config, imageSource: { kind: "preset", presetId: "arch" } };
      }
    }
    const imageUrl = resolveImageUrl(resolvedConfig.imageSource);
    let aspect = 1.33;
    try {
      const dims = await getImageDimensions(imageUrl);
      aspect = dims.width / dims.height;
    } catch { /* fallback */ }
    const targetPieces = DIFFICULTY_TARGET_PIECES[resolvedConfig.difficulty];
    const { rows, cols } = computeGrid(targetPieces, aspect);
    const cell = CELL_SIZE[resolvedConfig.difficulty];
    const seed = Math.floor(Math.random() * 2 ** 31);
    const newSession = buildSession(resolvedConfig, rows, cols, cell, seed, imageUrl);
    setSession(newSession);
    setElapsedSec(0);
    setIsNewRecord(false);
    setFinalTime(0);
    setPhase("playing");
    persist(newSession, 0);
  }, [persist]);

  const returnToSettings = useCallback(() => {
    clearSave();
    setPhase("settings");
  }, [clearSave]);

  const adjustZoom = useCallback((dir: 1 | -1) => {
    const arena = arenaRef.current;
    if (!arena) return;
    const cx = arena.clientWidth / 2;
    const cy = arena.clientHeight / 2;
    applyZoom(zoomRef.current * (dir > 0 ? 1.4 : 1 / 1.4), cx, cy);
  }, [applyZoom]);

  // ── Arena pointer: piece drag + background pan/pinch ─────────────────────
  // Piece SVGs call e.stopPropagation() on pointerdown, so this only fires for background.
  const handleArenaPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "playing") return;
    bgPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (bgPointersRef.current.size === 2) {
      const pts = [...bgPointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      lastPinchRef.current = { dist, midX, midY };
    } else {
      lastPinchRef.current = null;
    }
    e.preventDefault();
  }, []);

  const handleArenaPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const sess = sessionRef.current;
    if (!sess) return;

    // Piece drag (pointer was captured by a piece SVG and bubbles up)
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      const arena = arenaRef.current;
      if (!arena) return;
      const rect = arena.getBoundingClientRect();
      const z = zoomRef.current;
      const p = panRef.current;
      const worldX = (e.clientX - rect.left - p.x) / z;
      const worldY = (e.clientY - rect.top - p.y) / z;
      const x = Math.max(0, Math.min(sess.workspaceWidth - sess.pieceBoxW, worldX - drag.offsetX));
      const y = Math.max(0, Math.min(sess.workspaceHeight - sess.pieceBoxH, worldY - drag.offsetY));
      const pieces = sess.pieces.slice();
      pieces[drag.index] = { ...pieces[drag.index], x, y };
      const next = { ...sess, pieces };
      sessionRef.current = next;
      setSession(next);
      return;
    }

    // Background pan / pinch
    if (!bgPointersRef.current.has(e.pointerId)) return;
    const oldPos = bgPointersRef.current.get(e.pointerId)!;
    bgPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...bgPointersRef.current.values()];

    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const last = lastPinchRef.current;
      if (last) {
        const arena = arenaRef.current;
        if (!arena) return;
        const rect = arena.getBoundingClientRect();
        const cx = midX - rect.left;
        const cy = midY - rect.top;
        const oldZ = zoomRef.current;
        const newZ = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZ * dist / last.dist));
        const dcx = midX - last.midX;
        const dcy = midY - last.midY;
        const newPanX = cx - (cx - panRef.current.x) * (newZ / oldZ) + dcx;
        const newPanY = cy - (cy - panRef.current.y) * (newZ / oldZ) + dcy;
        zoomRef.current = newZ;
        panRef.current = { x: newPanX, y: newPanY };
        setZoom(newZ);
        setPan({ x: newPanX, y: newPanY });
      }
      lastPinchRef.current = { dist, midX, midY };
    } else {
      // Single-finger pan
      const dx = e.clientX - oldPos.x;
      const dy = e.clientY - oldPos.y;
      const newPan = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      panRef.current = newPan;
      setPan(newPan);
      lastPinchRef.current = null;
    }
  }, []);

  const handleArenaPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const sess = sessionRef.current;

    // End piece drag
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      dragRef.current = null;
      (e.target as Element).releasePointerCapture(e.pointerId);

      if (!sess) return;
      const pieces = sess.pieces.slice();
      const piece = pieces[drag.index];
      const homeX = sess.frameX + piece.col * sess.cell - sess.bumpAmp;
      const homeY = sess.frameY + piece.row * sess.cell - sess.bumpAmp;
      const dist = Math.hypot(piece.x - homeX, piece.y - homeY);

      if (dist <= SNAP_THRESHOLD) {
        pieces[drag.index] = { ...piece, x: homeX, y: homeY, locked: true, z: 0 };
      }

      const nextSession = { ...sess, pieces };
      sessionRef.current = nextSession;
      setSession(nextSession);
      const elapsed = elapsedSecRef.current;
      persist(nextSession, elapsed);

      if (pieces.every((p) => p.locked)) {
        setPhase("won");
        setFinalTime(elapsed);
        if (nextSession.config.timed) {
          const key = bestTimeKey(nextSession.config.imageSource, nextSession.config.difficulty);
          const currentBest = bestTimesRef.current[key];
          if (currentBest === undefined || elapsed < currentBest) {
            const updated = { ...bestTimesRef.current, [key]: elapsed };
            setBestTimes(updated);
            try { fsStore.writeFile(JP_SCORES_ID, JSON.stringify(updated)); } catch { /* ignore */ }
            setIsNewRecord(true);
          }
        }
        clearSave();
      }
      return;
    }

    // End background pan pointer
    bgPointersRef.current.delete(e.pointerId);
    if (bgPointersRef.current.size < 2) lastPinchRef.current = null;
  }, [persist, clearSave]);

  // Piece drag start (called from JigsawPieceView via stopPropagation)
  const handlePiecePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>, index: number) => {
    const sess = sessionRef.current;
    if (!sess || phaseRef.current !== "playing") return;
    const piece = sess.pieces[index];
    if (piece.locked) return;

    const arena = arenaRef.current;
    if (!arena) return;
    const rect = arena.getBoundingClientRect();
    const z = zoomRef.current;
    const p = panRef.current;
    const worldX = (e.clientX - rect.left - p.x) / z;
    const worldY = (e.clientY - rect.top - p.y) / z;

    zCounterRef.current += 1;
    dragRef.current = {
      index,
      offsetX: worldX - piece.x,
      offsetY: worldY - piece.y,
      pointerId: e.pointerId,
    };

    const pieces = sess.pieces.slice();
    pieces[index] = { ...pieces[index], z: zCounterRef.current };
    const next = { ...sess, pieces };
    sessionRef.current = next;
    setSession(next);

    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  // ── Menus ────────────────────────────────────────────────────────────────
  const menus = useMemo<MenuBarMenu[]>(
    () => [
      {
        label: "Game",
        items: [
          { label: "New Puzzle...", onClick: returnToSettings },
          ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
        ],
      },
    ],
    [returnToSettings, onQuit]
  );
  useWindowMenus(menus);

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === "settings") {
    return (
      <div className="jigsaw">
        <div className="jigsaw__settings-wrap">
          <JigsawSettings
            initial={session?.config ?? DEFAULT_CONFIG}
            customThumbUrl={fsStore.getFile(JP_IMAGE_ID)?.content || null}
            bestTimes={bestTimes}
            onStart={startNewPuzzle}
          />
        </div>
      </div>
    );
  }

  if (!session) return null;

  const lockedCount = session.pieces.filter((p) => p.locked).length;
  const totalCount = session.pieces.length;

  return (
    <div className="jigsaw">
      {/* ── Arena: the zoomable/pannable viewport ── */}
      <div
        ref={arenaRef}
        className="jigsaw__arena"
        onPointerDown={handleArenaPointerDown}
        onPointerMove={handleArenaPointerMove}
        onPointerUp={handleArenaPointerUp}
        onPointerCancel={handleArenaPointerUp}
      >
        {/* Inner canvas scaled+translated via CSS transform */}
        <div
          className="jigsaw__canvas"
          style={{
            width: session.workspaceWidth,
            height: session.workspaceHeight,
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          <div
            className="jigsaw__frame"
            style={{ left: session.frameX, top: session.frameY, width: session.boardW, height: session.boardH }}
          >
            <img src={session.imageUrl} alt="" className="jigsaw__frame-ghost" draggable={false} />
          </div>

          {session.pieces.map((piece, i) => (
            <JigsawPieceView
              key={`${piece.row}-${piece.col}`}
              piece={piece}
              session={session}
              onPointerDown={(e) => handlePiecePointerDown(e, i)}
            />
          ))}
        </div>

        {/* Win overlay sits inside arena so it covers the puzzle */}
        {phase === "won" && (
          <div className="jigsaw__overlay">
            <div className="jigsaw__overlay-panel">
              <div className="jigsaw__overlay-title">Puzzle Complete!</div>
              {session.config.timed && (
                <div className="jigsaw__overlay-time">Time: {formatTime(finalTime)}</div>
              )}
              {isNewRecord && <div className="jigsaw__overlay-record">New Best Time!</div>}
              <button type="button" className="jigsaw__btn jigsaw__btn--big" onClick={returnToSettings}>
                New Puzzle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: minimap + stats + controls ── */}
      <div className="jigsaw__footer">
        <canvas
          ref={minimapRef}
          className="jigsaw__minimap"
          onPointerDown={handleMinimapPointer}
          onPointerMove={handleMinimapPointer}
        />

        <div className="jigsaw__footer-stats">
          <div className="jigsaw__footer-stat">
            <span className="jigsaw__footer-label">Pieces</span>
            <span className="jigsaw__footer-value">{lockedCount} / {totalCount}</span>
          </div>
          {session.config.timed && (
            <div className="jigsaw__footer-stat">
              <span className="jigsaw__footer-label">Time</span>
              <span className="jigsaw__footer-value">{formatTime(elapsedSec)}</span>
            </div>
          )}
        </div>

        <div className="jigsaw__footer-btns">
          <button type="button" className="jigsaw__btn jigsaw__btn--zoom" onClick={() => adjustZoom(-1)}>−</button>
          <button type="button" className="jigsaw__btn jigsaw__btn--zoom" onClick={() => adjustZoom(1)}>+</button>
          <button type="button" className="jigsaw__btn" onClick={returnToSettings}>New Puzzle</button>
        </div>
      </div>
    </div>
  );
}
