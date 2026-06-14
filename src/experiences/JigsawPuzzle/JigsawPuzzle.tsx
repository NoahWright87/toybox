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
  const workspaceWidth = saved?.workspaceWidth ?? Math.max(boardW * 1.8, boardW + 240);
  const workspaceHeight = saved?.workspaceHeight ?? Math.max(boardH * 1.8, boardH + 240);
  const frameX = saved?.frameX ?? (workspaceWidth - boardW) / 2;
  const frameY = saved?.frameY ?? (workspaceHeight - boardH) / 2;

  const pieces: PieceState[] = layout.pieces.map((p, i) => {
    const savedPiece = saved?.pieces[i];
    return {
      row: p.row,
      col: p.col,
      pathD: p.pathD,
      x: savedPiece?.x ?? Math.random() * (workspaceWidth - layout.pieceBoxW),
      y: savedPiece?.y ?? Math.random() * (workspaceHeight - layout.pieceBoxH),
      locked: savedPiece?.locked ?? false,
      z: i + 1,
    };
  });

  return {
    config,
    rows,
    cols,
    cell,
    seed,
    bumpAmp: layout.bumpAmp,
    pieceBoxW: layout.pieceBoxW,
    pieceBoxH: layout.pieceBoxH,
    imageUrl,
    workspaceWidth,
    workspaceHeight,
    frameX,
    frameY,
    boardW,
    boardH,
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
  onPointerDown: (e: React.PointerEvent) => void;
}

const JigsawPieceView = memo(function JigsawPieceView({ piece, session, onPointerDown }: JigsawPieceViewProps) {
  const { pieceBoxW, pieceBoxH, cell, bumpAmp, boardW, boardH, imageUrl, seed } = session;
  const clipId = `jigsaw-clip-${seed}-${piece.row}-${piece.col}`;

  return (
    <svg
      className={`jigsaw-piece${piece.locked ? " jigsaw-piece--locked" : ""}`}
      style={{ left: piece.x, top: piece.y, width: pieceBoxW, height: pieceBoxH, zIndex: piece.z }}
      viewBox={`0 0 ${pieceBoxW} ${pieceBoxH}`}
      onPointerDown={piece.locked ? undefined : onPointerDown}
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

  const workspaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const zCounterRef = useRef(1000);

  // ── Persistence ────────────────────────────────────────────────────────
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
    try {
      fsStore.writeFile(JP_STATE_ID, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const clearSave = useCallback(() => {
    try {
      fsStore.writeFile(JP_STATE_ID, "");
    } catch {
      /* ignore */
    }
  }, []);

  // Persist a restored session immediately so a rotation/refresh right after
  // opening doesn't lose progress.
  useEffect(() => {
    if (session && phase === "playing") {
      persist(session, elapsedSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !session?.config.timed) return;
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [phase, session?.config.timed]);

  // ── New puzzle ─────────────────────────────────────────────────────────
  const startNewPuzzle = useCallback(async (config: JigsawConfig, customDataUrl: string | null) => {
    let resolvedConfig = config;

    if (config.imageSource.kind === "custom") {
      if (customDataUrl) {
        try {
          fsStore.writeFile(JP_IMAGE_ID, customDataUrl);
        } catch {
          /* ignore */
        }
      } else if (!fsStore.getFile(JP_IMAGE_ID)?.content) {
        resolvedConfig = { ...config, imageSource: { kind: "preset", presetId: "arch" } };
      }
    }

    const imageUrl = resolveImageUrl(resolvedConfig.imageSource);

    let aspect = 1.33;
    try {
      const dims = await getImageDimensions(imageUrl);
      aspect = dims.width / dims.height;
    } catch {
      /* fall back to default aspect */
    }

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

  // ── Drag handling ──────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (!session || phase !== "playing") return;
    const piece = session.pieces[index];
    if (piece.locked) return;

    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect || !workspaceRef.current) return;

    const pointerX = e.clientX - rect.left + workspaceRef.current.scrollLeft;
    const pointerY = e.clientY - rect.top + workspaceRef.current.scrollTop;

    dragRef.current = { index, offsetX: pointerX - piece.x, offsetY: pointerY - piece.y };
    zCounterRef.current += 1;

    const pieces = session.pieces.slice();
    pieces[index] = { ...pieces[index], z: zCounterRef.current };
    setSession({ ...session, pieces });

    e.currentTarget.setPointerCapture(e.pointerId);
  }, [session, phase]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !session) return;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect || !workspaceRef.current) return;

    const pointerX = e.clientX - rect.left + workspaceRef.current.scrollLeft;
    const pointerY = e.clientY - rect.top + workspaceRef.current.scrollTop;

    const x = Math.max(0, Math.min(session.workspaceWidth - session.pieceBoxW, pointerX - drag.offsetX));
    const y = Math.max(0, Math.min(session.workspaceHeight - session.pieceBoxH, pointerY - drag.offsetY));

    const pieces = session.pieces.slice();
    pieces[drag.index] = { ...pieces[drag.index], x, y };
    setSession({ ...session, pieces });
  }, [session]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !session) return;
    dragRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);

    const pieces = session.pieces.slice();
    const piece = pieces[drag.index];
    const homeX = session.frameX + piece.col * session.cell - session.bumpAmp;
    const homeY = session.frameY + piece.row * session.cell - session.bumpAmp;
    const dist = Math.hypot(piece.x - homeX, piece.y - homeY);

    if (dist <= SNAP_THRESHOLD) {
      pieces[drag.index] = { ...piece, x: homeX, y: homeY, locked: true, z: 0 };
    }

    const nextSession = { ...session, pieces };
    setSession(nextSession);
    persist(nextSession, elapsedSec);

    if (pieces.every((p) => p.locked)) {
      setPhase("won");
      setFinalTime(elapsedSec);
      if (nextSession.config.timed) {
        const key = bestTimeKey(nextSession.config.imageSource, nextSession.config.difficulty);
        const currentBest = bestTimes[key];
        if (currentBest === undefined || elapsedSec < currentBest) {
          const updated = { ...bestTimes, [key]: elapsedSec };
          setBestTimes(updated);
          try {
            fsStore.writeFile(JP_SCORES_ID, JSON.stringify(updated));
          } catch {
            /* ignore */
          }
          setIsNewRecord(true);
        }
      }
      clearSave();
    }
  }, [session, persist, clearSave, elapsedSec, bestTimes]);

  // ── Menus ──────────────────────────────────────────────────────────────
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
        <JigsawSettings
          initial={session?.config ?? DEFAULT_CONFIG}
          customThumbUrl={fsStore.getFile(JP_IMAGE_ID)?.content || null}
          bestTimes={bestTimes}
          onStart={startNewPuzzle}
        />
      </div>
    );
  }

  if (!session) return null;

  const lockedCount = session.pieces.filter((p) => p.locked).length;
  const totalCount = session.pieces.length;

  return (
    <div className="jigsaw">
      <div className="jigsaw__hud">
        <div className="jigsaw__hud-stat">
          <span className="jigsaw__hud-label">Pieces</span>
          <span className="jigsaw__hud-value">{lockedCount} / {totalCount}</span>
        </div>
        {session.config.timed && (
          <div className="jigsaw__hud-stat">
            <span className="jigsaw__hud-label">Time</span>
            <span className="jigsaw__hud-value">{formatTime(elapsedSec)}</span>
          </div>
        )}
        <div className="jigsaw__hud-buttons">
          <button type="button" className="jigsaw__btn" onClick={returnToSettings}>
            New Puzzle
          </button>
        </div>
      </div>

      <div
        className="jigsaw__workspace"
        ref={workspaceRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
            onPointerDown={(e) => handlePointerDown(e, i)}
          />
        ))}
      </div>

      {phase === "won" && (
        <div className="jigsaw__overlay">
          <div className="jigsaw__overlay-panel">
            <div className="jigsaw__overlay-title">Puzzle Complete!</div>
            {session.config.timed && <div className="jigsaw__overlay-time">Time: {formatTime(finalTime)}</div>}
            {isNewRecord && <div className="jigsaw__overlay-record">New Best Time!</div>}
            <button type="button" className="jigsaw__btn jigsaw__btn--big" onClick={returnToSettings}>
              New Puzzle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
