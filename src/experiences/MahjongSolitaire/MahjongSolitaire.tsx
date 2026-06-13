import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { MJ_SCORES_ID, MJ_STATE_ID } from "../NsDoors97/filesystem/types";
import { TILE_DESIGNS_BY_ID } from "./tiles";
import {
  generateTurtleLayout,
  getBoardPixelSize,
  getBoardOrigin,
  HALF_W,
  HALF_H,
  Z_OFFSET,
  type BoardSlot,
} from "./layout";
import {
  generateSolvableBoard,
  getMatchablePairs,
  isFree,
  shuffleBoard,
  type Board,
  type BoardTile,
} from "./board";
import { getTileAssetUrl } from "./mahjongAssets";
import "./MahjongSolitaire.css";

type Phase = "playing" | "won";

const HINT_DURATION_MS = 1500;
const SAVE_VERSION = 1;

interface SavedTile {
  slotId: string;
  designId: string;
  removed: boolean;
}

interface SavedState {
  version: number;
  tiles: SavedTile[];
  score: number;
  elapsedSec: number;
  savedAt: number;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function loadSavedState(slots: BoardSlot[]): SavedState | null {
  const content = fsStore.getFile(MJ_STATE_ID)?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as SavedState;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.tiles)) return null;
    if (parsed.tiles.length !== slots.length) return null;
    const slotIds = new Set(slots.map((s) => s.id));
    for (const tile of parsed.tiles) {
      if (!slotIds.has(tile.slotId)) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildBoardFromSave(slots: BoardSlot[], saved: SavedState): Board {
  const bySlotId = new Map<string, SavedTile>();
  for (const tile of saved.tiles) bySlotId.set(tile.slotId, tile);
  return slots.map((slot) => {
    const savedTile = bySlotId.get(slot.id);
    return {
      slotId: slot.id,
      pos: slot.pos,
      designId: savedTile?.designId ?? "",
      removed: savedTile?.removed ?? false,
    };
  });
}

export default function MahjongSolitaire({ onQuit }: { onQuit?: () => void } = {}) {
  const slots = useState<BoardSlot[]>(() => generateTurtleLayout())[0];
  const boardSize = useMemo(() => getBoardPixelSize(slots), [slots]);
  const boardOrigin = useMemo(() => getBoardOrigin(slots), [slots]);

  const initialSave = useState(() => loadSavedState(slots))[0];

  const [board, setBoard] = useState<Board>(() =>
    initialSave ? buildBoardFromSave(slots, initialSave) : generateSolvableBoard(slots)
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [hintPair, setHintPair] = useState<[string, string] | null>(null);
  const [score, setScore] = useState(() => initialSave?.score ?? 0);
  const [elapsedSec, setElapsedSec] = useState(() => {
    if (!initialSave) return 0;
    const idleSec = Math.max(0, Math.floor((Date.now() - initialSave.savedAt) / 1000));
    return initialSave.elapsedSec + idleSec;
  });
  const [phase, setPhase] = useState<Phase>("playing");
  const [message, setMessage] = useState<string | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const [highScore, setHighScore] = useState<number>(() => {
    const fsContent = fsStore.getFile(MJ_SCORES_ID)?.content;
    if (fsContent) return parseInt(fsContent, 10) || 0;
    return 0;
  });

  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persistence ────────────────────────────────────────────────────────────
  const persist = useCallback((nextBoard: Board, nextScore: number, nextElapsed: number) => {
    const saved: SavedState = {
      version: SAVE_VERSION,
      tiles: nextBoard.map((t) => ({ slotId: t.slotId, designId: t.designId, removed: t.removed })),
      score: nextScore,
      elapsedSec: nextElapsed,
      savedAt: Date.now(),
    };
    try {
      fsStore.writeFile(MJ_STATE_ID, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const clearSave = useCallback(() => {
    try {
      fsStore.writeFile(MJ_STATE_ID, "");
    } catch {
      /* ignore */
    }
  }, []);

  // Persist the restored (or freshly generated) state immediately, so a
  // rotation/refresh right after opening the game doesn't lose progress.
  useEffect(() => {
    persist(board, score, elapsedSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Cleanup hint timeout on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

  // ── New game ───────────────────────────────────────────────────────────────
  const newGame = useCallback(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
    const nextBoard = generateSolvableBoard(slots);
    setBoard(nextBoard);
    setSelectedSlotId(null);
    setHintPair(null);
    setScore(0);
    setElapsedSec(0);
    setPhase("playing");
    setMessage(null);
    setIsNewRecord(false);
    setFinalScore(0);
    persist(nextBoard, 0, 0);
  }, [persist, slots]);

  // ── Hint ───────────────────────────────────────────────────────────────────
  const showHint = useCallback(() => {
    if (phase !== "playing") return;
    const pairs = getMatchablePairs(board);
    if (pairs.length === 0) {
      setMessage("No moves left — try Shuffle!");
      return;
    }
    const pick = pairs[Math.floor(Math.random() * pairs.length)];
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    setHintPair([pick[0].slotId, pick[1].slotId]);
    hintTimeoutRef.current = setTimeout(() => {
      setHintPair(null);
      hintTimeoutRef.current = null;
    }, HINT_DURATION_MS);
  }, [board, phase]);

  // ── Shuffle ────────────────────────────────────────────────────────────────
  const shuffle = useCallback(() => {
    if (phase !== "playing") return;
    setBoard((prev) => {
      const nextBoard = shuffleBoard(prev);
      persist(nextBoard, score, elapsedSec);
      return nextBoard;
    });
    setSelectedSlotId(null);
    setHintPair(null);
    setMessage(null);
  }, [elapsedSec, persist, phase, score]);

  // ── Tile click ─────────────────────────────────────────────────────────────
  const handleTileClick = useCallback(
    (tile: BoardTile) => {
      if (phase !== "playing") return;
      if (!isFree(board, tile)) return;

      if (selectedSlotId === null) {
        setSelectedSlotId(tile.slotId);
        return;
      }

      if (selectedSlotId === tile.slotId) {
        setSelectedSlotId(null);
        return;
      }

      const selectedTile = board.find((t) => t.slotId === selectedSlotId);
      if (!selectedTile) {
        setSelectedSlotId(tile.slotId);
        return;
      }

      if (selectedTile.designId === tile.designId) {
        // Match! Remove both.
        const removedSlotIds = new Set<string>([selectedTile.slotId, tile.slotId]);
        const nextBoard = board.map((t) =>
          removedSlotIds.has(t.slotId) ? { ...t, removed: true } : t
        );
        const nextScore = score + 10;
        setBoard(nextBoard);
        setSelectedSlotId(null);
        setMessage(null);
        setScore(nextScore);

        if (nextBoard.every((t) => t.removed)) {
          setPhase("won");
          const won = nextScore + Math.max(0, 1000 - elapsedSec * 2);
          setFinalScore(won);
          if (won > highScore) {
            try {
              fsStore.writeFile(MJ_SCORES_ID, String(won));
            } catch {
              /* ignore */
            }
            setHighScore(won);
            setIsNewRecord(true);
          }
          clearSave();
        } else {
          persist(nextBoard, nextScore, elapsedSec);
        }
        return;
      }

      // Different design — move selection to the new tile.
      setSelectedSlotId(tile.slotId);
    },
    [board, clearSave, elapsedSec, highScore, persist, phase, score, selectedSlotId]
  );

  // ── Menus ──────────────────────────────────────────────────────────────────
  const menus = useMemo<MenuBarMenu[]>(
    () => [
      {
        label: "Game",
        items: [
          { label: "New Game", onClick: newGame },
          { separator: true },
          { label: "Hint", onClick: showHint },
          { label: "Shuffle", onClick: shuffle },
          ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
        ],
      },
    ],
    [newGame, onQuit, shuffle]
  );
  useWindowMenus(menus);

  const visibleTiles = board.filter((t) => !t.removed);

  return (
    <div className="mj">
      <div className="mj__hud">
        <div className="mj__hud-stat">
          <span className="mj__hud-label">Score</span>
          <span className="mj__hud-value">{score}</span>
        </div>
        <div className="mj__hud-stat">
          <span className="mj__hud-label">Time</span>
          <span className="mj__hud-value">{formatTime(elapsedSec)}</span>
        </div>
        <div className="mj__hud-stat">
          <span className="mj__hud-label">High Score</span>
          <span className="mj__hud-value">{highScore}</span>
        </div>
        <div className="mj__hud-buttons">
          <button type="button" className="mj__btn" onClick={newGame}>
            New Game
          </button>
          <button type="button" className="mj__btn" onClick={showHint} disabled={phase !== "playing"}>
            Hint
          </button>
          <button type="button" className="mj__btn" onClick={shuffle} disabled={phase !== "playing"}>
            Shuffle
          </button>
        </div>
      </div>

      {message && <div className="mj__message">{message}</div>}

      <div className="mj__board-wrap">
        <div
          className="mj__board"
          style={{ width: boardSize.width, height: boardSize.height }}
        >
          {visibleTiles.map((tile) => {
            const design = TILE_DESIGNS_BY_ID[tile.designId];
            const free = isFree(board, tile);
            const isSelected = tile.slotId === selectedSlotId;
            const isHint = hintPair?.includes(tile.slotId) ?? false;

            const left = tile.pos.x * HALF_W + tile.pos.z * Z_OFFSET - boardOrigin.left;
            const top = tile.pos.y * HALF_H - tile.pos.z * Z_OFFSET - boardOrigin.top;
            const zIndex = tile.pos.z * 1000 + tile.pos.y;

            return (
              <div
                key={tile.slotId}
                className={[
                  "mj-tile",
                  free ? "mj-tile--free" : "mj-tile--locked",
                  isSelected ? "mj-tile--selected" : "",
                  isHint ? "mj-tile--hint" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left, top, zIndex }}
                onClick={() => handleTileClick(tile)}
              >
                {design && (
                  <img
                    src={getTileAssetUrl(design.id, design.asset)}
                    alt={design.label}
                    draggable={false}
                  />
                )}
              </div>
            );
          })}
        </div>

        {phase === "won" && (
          <div className="mj__overlay">
            <div className="mj__overlay-panel">
              <div className="mj__overlay-title">Board Cleared!</div>
              <div className="mj__overlay-score">Final Score: {finalScore}</div>
              {isNewRecord && <div className="mj__overlay-record">New High Score!</div>}
              <button type="button" className="mj__btn mj__btn--big" onClick={newGame}>
                New Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
