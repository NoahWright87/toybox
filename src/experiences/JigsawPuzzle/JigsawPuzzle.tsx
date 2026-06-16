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
  PIECE_COUNT_TARGETS,
  ROTATION_INCREMENTS,
  SNAP_THRESHOLDS,
  bestTimeKey,
  formatTime,
  type ImageSource,
  type JigsawConfig,
  type Level,
} from "./types";
import { getImageDimensions } from "../../utils/imageResize";
import JigsawSettings from "./JigsawSettings";
import "./JigsawPuzzle.css";

const SAVE_VERSION = 2;
const ZOOM_MIN = 0.12;
const ZOOM_MAX = 4;
const MINIMAP_MAX_W = 130;
const MINIMAP_MAX_H = 46;

// px movement before a pointer-down is considered a drag (vs a tap-to-rotate)
const TAP_MOVE_THRESHOLD = 6;

interface PieceState {
  row: number;
  col: number;
  pathD: string;
  x: number;
  y: number;
  locked: boolean;
  z: number;
  groupId: number; // pieces with same groupId move together; -1 = solo
  rotation: number; // degrees; always 0 when rotationMode === 0
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
  groupId: number;
  rotation: number;
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
  const cutStyle = (config.cutStyle ?? 2) as 0 | 1 | 2;
  const layout = generatePieceLayout(rows, cols, cell, cell, seed, cutStyle);
  const boardW = cols * cell;
  const boardH = rows * cell;
  const margin = Math.max(boardW, boardH) * 1.2 + cell * 3;
  const workspaceWidth = saved?.workspaceWidth ?? boardW + margin * 2;
  const workspaceHeight = saved?.workspaceHeight ?? boardH + margin * 2;
  const frameX = saved?.frameX ?? (workspaceWidth - boardW) / 2;
  const frameY = saved?.frameY ?? (workspaceHeight - boardH) / 2;

  const rotMode = config.rotationMode ?? 0;
  const inc = ROTATION_INCREMENTS[rotMode];
  const rotations = [0, 90, 180, 270];

  const pieces: PieceState[] = layout.pieces.map((p, i) => {
    const sp = saved?.pieces[i];
    let rot = 0;
    if (!sp && rotMode > 0 && inc > 0) {
      // random initial rotation
      const steps = Math.round(360 / inc);
      rot = Math.floor(Math.random() * steps) * inc;
    } else if (sp) {
      rot = sp.rotation ?? 0;
    }
    return {
      row: p.row,
      col: p.col,
      pathD: p.pathD,
      x: sp?.x ?? frameX + Math.floor(Math.random() * 4) * (workspaceWidth / 4) - layout.pieceBoxW / 2,
      y: sp?.y ?? frameY + Math.floor(Math.random() * 4) * (workspaceHeight / 4) - layout.pieceBoxH / 2,
      locked: sp?.locked ?? false,
      z: i + 1,
      groupId: sp?.groupId ?? -1,
      rotation: rotMode === 0 ? 0 : (sp ? rot : (rotMode === 1 ? rotations[Math.floor(Math.random() * 4)] : rot)),
    };
  });

  // Clamp piece positions inside workspace
  pieces.forEach((p) => {
    p.x = Math.max(0, Math.min(workspaceWidth - layout.pieceBoxW, p.x));
    p.y = Math.max(0, Math.min(workspaceHeight - layout.pieceBoxH, p.y));
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

// ── Snap helpers ──────────────────────────────────────────────────────────────

/** Next groupId counter (module-level so it persists across re-renders) */
let groupCounter = 1000;

function snapThreshold(cfg: JigsawConfig): number {
  return SNAP_THRESHOLDS[cfg.snapSensitivity ?? 1];
}

function rotationTolerance(cfg: JigsawConfig): number {
  const mode = cfg.rotationMode ?? 0;
  if (mode === 0) return 0;
  if (mode === 1) return 20;
  return 8;
}

/**
 * After dropping a piece, check for snap-to-board and piece-to-piece snaps.
 * Returns updated pieces array and whether a snap occurred.
 */
function trySnap(
  pieces: PieceState[],
  movedIndex: number,
  sess: Session
): PieceState[] {
  const threshold = snapThreshold(sess.config);
  const rotTol = rotationTolerance(sess.config);
  const piece = pieces[movedIndex];
  let next = pieces.slice();

  // Helper: are all pieces in this group at rotation ≈ 0 (snapped-to-board rotation)?
  function nearZeroRot(p: PieceState): boolean {
    const r = ((p.rotation % 360) + 360) % 360;
    return Math.min(r, 360 - r) <= rotTol;
  }

  // 1. Snap to board
  if (nearZeroRot(piece)) {
    const homeX = sess.frameX + piece.col * sess.cell - sess.bumpAmp;
    const homeY = sess.frameY + piece.row * sess.cell - sess.bumpAmp;
    const dist = Math.hypot(piece.x - homeX, piece.y - homeY);
    if (dist <= threshold) {
      // Snap this piece (and its whole group) to their board positions
      const gid = piece.groupId;
      next = next.map((p, i) => {
        if (i === movedIndex || (gid !== -1 && p.groupId === gid)) {
          const px = sess.frameX + p.col * sess.cell - sess.bumpAmp;
          const py = sess.frameY + p.row * sess.cell - sess.bumpAmp;
          return { ...p, x: px, y: py, locked: true, rotation: 0, z: 0 };
        }
        return p;
      });
      return next;
    }
  }

  // 2. Piece-to-piece snap (only for unlocked, only when rotations match)
  const movedRot = ((piece.rotation % 360) + 360) % 360;

  for (let j = 0; j < next.length; j++) {
    if (j === movedIndex) continue;
    const other = next[j];
    if (other.locked) continue;
    // Rotations must match within tolerance
    const otherRot = ((other.rotation % 360) + 360) % 360;
    const rotDiff = Math.abs(movedRot - otherRot);
    const rotMatch = Math.min(rotDiff, 360 - rotDiff) <= rotTol;
    if (!rotMatch) continue;

    // Check if `piece` and `other` are grid-adjacent
    const dr = piece.row - other.row;
    const dc = piece.col - other.col;
    if (Math.abs(dr) + Math.abs(dc) !== 1) continue;

    // Expected offset of piece relative to other at rotation 0
    const rad = (movedRot * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    // Unrotated expected delta (piece center relative to other center)
    const rawDx = dc * sess.cell;
    const rawDy = dr * sess.cell;
    // Rotate the expected delta
    const expDx = rawDx * cosA - rawDy * sinA;
    const expDy = rawDx * sinA + rawDy * cosA;

    const actualDx = piece.x - other.x;
    const actualDy = piece.y - other.y;
    const dist = Math.hypot(actualDx - expDx, actualDy - expDy);

    if (dist > threshold) continue;

    // Snap: align piece to other
    const snappedX = other.x + expDx;
    const snappedY = other.y + expDy;

    // Merge into a single group
    const newGid = piece.groupId !== -1 ? piece.groupId : (other.groupId !== -1 ? other.groupId : ++groupCounter);
    const fromGid = piece.groupId !== -1 ? other.groupId : piece.groupId;

    // Move the dragged piece (and its group) to snap position, fix rotation
    const dx = snappedX - piece.x;
    const dy = snappedY - piece.y;
    const movedGid = piece.groupId;

    next = next.map((p, i) => {
      if (i === movedIndex || (movedGid !== -1 && p.groupId === movedGid)) {
        return { ...p, x: p.x + dx, y: p.y + dy, rotation: other.rotation, groupId: newGid };
      }
      if (fromGid !== -1 && p.groupId === fromGid) {
        return { ...p, groupId: newGid };
      }
      if (i === j) {
        return { ...p, groupId: newGid };
      }
      return p;
    });

    // Also move newGid group so all members align correctly relative to `other`
    // (other may not be at index j after map, find it)
    break; // one snap per drop is enough
  }

  return next;
}

// ── Piece view ────────────────────────────────────────────────────────────────

interface JigsawPieceViewProps {
  piece: PieceState;
  session: Session;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
}

const JigsawPieceView = memo(function JigsawPieceView({
  piece, session, isSelected, onPointerDown, onWheel,
}: JigsawPieceViewProps) {
  const { pieceBoxW, pieceBoxH, cell, bumpAmp, boardW, boardH, imageUrl, seed } = session;
  const clipId = `jigsaw-clip-${seed}-${piece.row}-${piece.col}`;

  const filterLevel = session.config.imageFilter ?? 0;
  const grayscale = filterLevel === 2 ? "grayscale(1)" : filterLevel === 1 ? "grayscale(0.5)" : "none";

  const handleDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    onPointerDown(e);
  }, [onPointerDown]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.stopPropagation();
    onWheel(e);
  }, [onWheel]);

  const cx = pieceBoxW / 2;
  const cy = pieceBoxH / 2;

  return (
    <svg
      className={`jigsaw-piece${piece.locked ? " jigsaw-piece--locked" : ""}${isSelected ? " jigsaw-piece--selected" : ""}`}
      style={{
        left: piece.x,
        top: piece.y,
        width: pieceBoxW,
        height: pieceBoxH,
        zIndex: piece.z,
        transform: piece.rotation !== 0 ? `rotate(${piece.rotation}deg)` : undefined,
        transformOrigin: `${cx}px ${cy}px`,
      }}
      viewBox={`0 0 ${pieceBoxW} ${pieceBoxH}`}
      onPointerDown={piece.locked ? undefined : handleDown}
      onWheel={piece.locked ? undefined : handleWheel}
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
          style={{ filter: grayscale }}
        />
      </g>
      <path d={piece.pathD} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
      {isSelected && <path d={piece.pathD} fill="none" stroke="#ff6b00" strokeWidth={2} />}
    </svg>
  );
});

// ── Corner preview box ────────────────────────────────────────────────────────

function PreviewBox({ session }: { session: Session }) {
  const filterLevel = session.config.imageFilter ?? 0;
  const grayscale = filterLevel === 2 ? "grayscale(1)" : filterLevel === 1 ? "grayscale(0.5)" : "none";
  return (
    <div className="jigsaw__preview-box">
      <img
        src={session.imageUrl}
        alt="Preview"
        className="jigsaw__preview-img"
        style={{ filter: grayscale }}
        draggable={false}
      />
      <div className="jigsaw__preview-label">Preview</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
      CELL_SIZE[initialSave.config.pieceCount ?? 1],
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // View state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs mirroring state for event handlers
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const sessionRef = useRef<Session | null>(session);
  const elapsedSecRef = useRef(elapsedSec);
  const bestTimesRef = useRef(bestTimes);
  const phaseRef = useRef(phase);
  const selectedIndexRef = useRef<number | null>(null);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { elapsedSecRef.current = elapsedSec; }, [elapsedSec]);
  useEffect(() => { bestTimesRef.current = bestTimes; }, [bestTimes]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);

  const arenaRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  const dragRef = useRef<{
    index: number;
    offsetX: number;
    offsetY: number;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);
  const bgPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const zCounterRef = useRef(1000);

  // ── Persistence ────────────────────────────────────────────────────────────
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
      pieces: sess.pieces.map((p) => ({
        x: p.x, y: p.y, locked: p.locked, groupId: p.groupId, rotation: p.rotation,
      })),
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

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !session?.config.timed) return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, session?.config.timed]);

  // ── Minimap ────────────────────────────────────────────────────────────────
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

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      sess.frameX * scale + 0.5, sess.frameY * scale + 0.5,
      sess.boardW * scale - 1, sess.boardH * scale - 1
    );

    const pw = sess.pieceBoxW * scale;
    const ph = sess.pieceBoxH * scale;
    for (const p of sess.pieces) {
      ctx.fillStyle = p.locked ? "rgba(255,255,255,0.75)" : "rgba(255,200,80,0.65)";
      ctx.fillRect(p.x * scale, p.y * scale, pw, ph);
    }

    const z = zoomRef.current;
    const pn = panRef.current;
    const aW = arena.clientWidth;
    const aH = arena.clientHeight;
    ctx.strokeStyle = "#ff6b00";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      (-pn.x / z) * scale + 0.5,
      (-pn.y / z) * scale + 0.5,
      Math.max(2, (aW / z) * scale - 1),
      Math.max(2, (aH / z) * scale - 1)
    );
  }, []);

  const renderMinimapRef = useRef(renderMinimap);
  useEffect(() => { renderMinimapRef.current = renderMinimap; }, [renderMinimap]);
  useEffect(() => { renderMinimapRef.current(); }, [session, zoom, pan]);

  // ── View helpers ───────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!session || phase !== "playing") return;
    const id = requestAnimationFrame(() => fitView(session));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.seed, fitView]);

  // ── Ctrl+wheel zoom ────────────────────────────────────────────────────────
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = arena.getBoundingClientRect();
      applyZoom(
        zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15),
        e.clientX - rect.left, e.clientY - rect.top
      );
    };
    arena.addEventListener("wheel", handler, { passive: false });
    return () => arena.removeEventListener("wheel", handler);
  }, [applyZoom]);

  // ── Minimap click ──────────────────────────────────────────────────────────
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

  // ── Rotation helper ────────────────────────────────────────────────────────
  const rotatePiece = useCallback((index: number, dir: 1 | -1 = 1) => {
    const sess = sessionRef.current;
    if (!sess) return;
    const mode = sess.config.rotationMode ?? 0;
    if (mode === 0) return;
    const inc = ROTATION_INCREMENTS[mode as Level];
    const piece = sess.pieces[index];
    const delta = inc * dir;
    const gid = piece.groupId;

    const pieces = sess.pieces.map((p, i) => {
      if (i !== index && (gid === -1 || p.groupId !== gid)) return p;
      const newRot = ((p.rotation + delta) % 360 + 360) % 360;
      return { ...p, rotation: newRot };
    });

    const next = { ...sess, pieces };
    sessionRef.current = next;
    setSession(next);
  }, []);

  // ── Puzzle start / return ──────────────────────────────────────────────────
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
    const targetPieces = PIECE_COUNT_TARGETS[resolvedConfig.pieceCount ?? 1];
    const { rows, cols } = computeGrid(targetPieces, aspect);
    const cell = CELL_SIZE[resolvedConfig.pieceCount ?? 1];
    const seed = Math.floor(Math.random() * 2 ** 31);
    const newSession = buildSession(resolvedConfig, rows, cols, cell, seed, imageUrl);
    setSession(newSession);
    setElapsedSec(0);
    setIsNewRecord(false);
    setFinalTime(0);
    setSelectedIndex(null);
    setPhase("playing");
    persist(newSession, 0);
  }, [persist]);

  const returnToSettings = useCallback(() => {
    clearSave();
    setSelectedIndex(null);
    setPhase("settings");
  }, [clearSave]);

  const adjustZoom = useCallback((dir: 1 | -1) => {
    const arena = arenaRef.current;
    if (!arena) return;
    applyZoom(zoomRef.current * (dir > 0 ? 1.4 : 1 / 1.4), arena.clientWidth / 2, arena.clientHeight / 2);
  }, [applyZoom]);

  // ── Arena pointer (background pan / pinch) ────────────────────────────────
  const handleArenaPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "playing") return;
    bgPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (bgPointersRef.current.size === 2) {
      const pts = [...bgPointersRef.current.values()];
      lastPinchRef.current = {
        dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
    } else {
      lastPinchRef.current = null;
    }
    // Tap on background deselects
    setSelectedIndex(null);
    e.preventDefault();
  }, []);

  const handleArenaPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const sess = sessionRef.current;
    if (!sess) return;

    // Piece drag
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      // Check if we've moved enough to be a drag (vs a tap)
      if (!drag.moved) {
        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;
        if (Math.hypot(dx, dy) < TAP_MOVE_THRESHOLD) return;
        drag.moved = true;
      }
      const arena = arenaRef.current;
      if (!arena) return;
      const rect = arena.getBoundingClientRect();
      const z = zoomRef.current;
      const p = panRef.current;
      const worldX = (e.clientX - rect.left - p.x) / z;
      const worldY = (e.clientY - rect.top - p.y) / z;
      const piece = sess.pieces[drag.index];
      const gid = piece.groupId;
      const dx = worldX - drag.offsetX - piece.x;
      const dy = worldY - drag.offsetY - piece.y;

      const pieces = sess.pieces.map((p2, i) => {
        if (i !== drag.index && (gid === -1 || p2.groupId !== gid)) return p2;
        return {
          ...p2,
          x: Math.max(0, Math.min(sess.workspaceWidth - sess.pieceBoxW, p2.x + dx)),
          y: Math.max(0, Math.min(sess.workspaceHeight - sess.pieceBoxH, p2.y + dy)),
        };
      });
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

    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      dragRef.current = null;
      (e.target as Element).releasePointerCapture(e.pointerId);

      if (!sess) return;

      // Tap (no move) = rotate piece
      if (!drag.moved) {
        rotatePiece(drag.index);
        setSelectedIndex(drag.index);
        return;
      }

      // Drop: try snap
      let pieces = trySnap(sess.pieces, drag.index, sess);
      const nextSession = { ...sess, pieces };
      sessionRef.current = nextSession;
      setSession(nextSession);
      const elapsed = elapsedSecRef.current;
      persist(nextSession, elapsed);

      if (pieces.every((p) => p.locked)) {
        setPhase("won");
        setFinalTime(elapsed);
        if (nextSession.config.timed) {
          const key = bestTimeKey(nextSession.config.imageSource, nextSession.config.pieceCount ?? 1);
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

    bgPointersRef.current.delete(e.pointerId);
    if (bgPointersRef.current.size < 2) lastPinchRef.current = null;
  }, [persist, clearSave, rotatePiece]);

  // ── Piece pointer down ─────────────────────────────────────────────────────
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
    const gid = piece.groupId;

    // Bring whole group to front
    const pieces = sess.pieces.map((p2, i) => {
      if (i === index || (gid !== -1 && p2.groupId === gid)) {
        return { ...p2, z: zCounterRef.current };
      }
      return p2;
    });
    const next = { ...sess, pieces };
    sessionRef.current = next;
    setSession(next);

    dragRef.current = {
      index,
      offsetX: worldX - piece.x,
      offsetY: worldY - piece.y,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedIndex(index);
  }, []);

  // ── Piece scroll wheel = rotate ────────────────────────────────────────────
  const handlePieceWheel = useCallback((e: React.WheelEvent<SVGSVGElement>, index: number) => {
    const sess = sessionRef.current;
    if (!sess || sess.config.rotationMode === 0) return;
    e.preventDefault();
    rotatePiece(index, e.deltaY > 0 ? 1 : -1);
  }, [rotatePiece]);

  // ── Menus ──────────────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
  const previewMode = session.config.previewMode ?? 0;
  const showGhost = previewMode === 0;
  const showCornerPreview = previewMode === 1;

  return (
    <div className="jigsaw">
      <div
        ref={arenaRef}
        className="jigsaw__arena"
        onPointerDown={handleArenaPointerDown}
        onPointerMove={handleArenaPointerMove}
        onPointerUp={handleArenaPointerUp}
        onPointerCancel={handleArenaPointerUp}
      >
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
            {showGhost && (
              <img
                src={session.imageUrl}
                alt=""
                className="jigsaw__frame-ghost"
                draggable={false}
                style={{
                  filter: session.config.imageFilter === 2 ? "grayscale(1)"
                    : session.config.imageFilter === 1 ? "grayscale(0.5)" : "none",
                }}
              />
            )}
          </div>

          {session.pieces.map((piece, i) => (
            <JigsawPieceView
              key={`${piece.row}-${piece.col}`}
              piece={piece}
              session={session}
              isSelected={selectedIndex === i}
              onPointerDown={(e) => handlePiecePointerDown(e, i)}
              onWheel={(e) => handlePieceWheel(e, i)}
            />
          ))}
        </div>

        {/* Corner preview box (previewMode === 1) */}
        {showCornerPreview && <PreviewBox session={session} />}

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
