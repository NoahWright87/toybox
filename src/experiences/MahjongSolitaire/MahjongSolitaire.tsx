import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { MJ_SCORES_ID } from "../NsDoors97/filesystem/types";
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

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function MahjongSolitaire({ onQuit }: { onQuit?: () => void } = {}) {
  const slots = useState<BoardSlot[]>(() => generateTurtleLayout())[0];
  const boardSize = useMemo(() => getBoardPixelSize(slots), [slots]);
  const boardOrigin = useMemo(() => getBoardOrigin(slots), [slots]);

  const [board, setBoard] = useState<Board>(() => generateSolvableBoard(slots));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [hintPair, setHintPair] = useState<[string, string] | null>(null);
  const [score, setScore] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
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
    setBoard(generateSolvableBoard(slots));
    setSelectedSlotId(null);
    setHintPair(null);
    setScore(0);
    setElapsedSec(0);
    setPhase("playing");
    setMessage(null);
    setIsNewRecord(false);
    setFinalScore(0);
  }, [slots]);

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
    setBoard((prev) => shuffleBoard(prev));
    setSelectedSlotId(null);
    setHintPair(null);
    setMessage(null);
  }, [phase]);

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
        }
        return;
      }

      // Different design — move selection to the new tile.
      setSelectedSlotId(tile.slotId);
    },
    [board, elapsedSec, highScore, phase, selectedSlotId]
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
