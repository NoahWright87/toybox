import { useState, useEffect, useCallback, useRef } from "react";
import "./BombFinder.css";

export type Difficulty = "beginner" | "intermediate" | "expert";
type GameStatus = "idle" | "playing" | "won" | "lost";

interface Cell {
  hasBomb: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentCount: number;
  wrongFlag?: boolean;
}

const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mines: number; label: string }> = {
  beginner:     { rows: 9,  cols: 9,  mines: 10, label: "Beginner"     },
  intermediate: { rows: 16, cols: 16, mines: 40, label: "Intermediate" },
  expert:       { rows: 16, cols: 30, mines: 99, label: "Expert"       },
};

// Classic Minesweeper number colors
const NUMBER_COLORS: string[] = [
  "",          // 0 (not shown)
  "#0000cc",   // 1 blue
  "#007700",   // 2 green
  "#cc0000",   // 3 red
  "#000077",   // 4 dark blue
  "#770000",   // 5 dark red
  "#007777",   // 6 teal
  "#000000",   // 7 black
  "#777777",   // 8 gray
];

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      hasBomb: false,
      revealed: false,
      flagged: false,
      adjacentCount: 0,
    }))
  );
}

function placeBombs(
  board: Cell[][],
  rows: number,
  cols: number,
  mines: number,
  safeRow: number,
  safeCol: number
): Cell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));

  // Collect positions outside the 3×3 safe zone around first click
  const positions: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.abs(r - safeRow) > 1 || Math.abs(c - safeCol) > 1) {
        positions.push([r, c]);
      }
    }
  }

  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  const count = Math.min(mines, positions.length);
  for (let i = 0; i < count; i++) {
    const [r, c] = positions[i];
    newBoard[r][c].hasBomb = true;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (newBoard[r][c].hasBomb) continue;
      let adj = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newBoard[nr][nc].hasBomb) {
            adj++;
          }
        }
      }
      newBoard[r][c].adjacentCount = adj;
    }
  }

  return newBoard;
}

function floodReveal(
  board: Cell[][],
  rows: number,
  cols: number,
  startRow: number,
  startCol: number
): Cell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
  const stack: [number, number][] = [[startRow, startCol]];

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    const cell = newBoard[r][c];
    if (cell.revealed || cell.flagged || cell.hasBomb) continue;

    cell.revealed = true;

    if (cell.adjacentCount === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) stack.push([r + dr, c + dc]);
        }
      }
    }
  }

  return newBoard;
}

function countFlags(board: Cell[][]): number {
  return board.flat().filter((c) => c.flagged).length;
}

function checkWin(board: Cell[][], rows: number, cols: number, mines: number): boolean {
  let revealed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].revealed) revealed++;
    }
  }
  return revealed === rows * cols - mines;
}

function fmt(n: number): string {
  const clamped = Math.max(-99, Math.min(999, n));
  if (clamped < 0) return "-" + Math.abs(clamped).toString().padStart(2, "0");
  return clamped.toString().padStart(3, "0");
}

interface BombFinderProps {
  onDifficultyChange?: (difficulty: Difficulty) => void;
}

export default function BombFinder({ onDifficultyChange }: BombFinderProps = {}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const cfg = DIFFICULTIES[difficulty];

  const [board, setBoard] = useState<Cell[][]>(() => createEmptyBoard(9, 9));
  const [status, setStatus] = useState<GameStatus>("idle");
  const [minesLeft, setMinesLeft] = useState(DIFFICULTIES.beginner.mines);
  const [time, setTime] = useState(0);
  const [deathCell, setDeathCell] = useState<{ row: number; col: number } | null>(null);
  const [facePressed, setFacePressed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setTime((t) => Math.min(t + 1, 999));
    }, 1000);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const resetGame = useCallback(
    (newDiff?: Difficulty) => {
      stopTimer();
      const d = newDiff ?? difficulty;
      const newCfg = DIFFICULTIES[d];
      if (newDiff !== undefined && newDiff !== difficulty) {
        setDifficulty(d);
        onDifficultyChange?.(d);
      }
      setBoard(createEmptyBoard(newCfg.rows, newCfg.cols));
      setStatus("idle");
      setMinesLeft(newCfg.mines);
      setTime(0);
      setDeathCell(null);
    },
    [difficulty, stopTimer, onDifficultyChange]
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (status === "won" || status === "lost") return;
      const cell = board[row][col];
      if (cell.revealed || cell.flagged) return;

      let currentBoard = board;
      const isFirstClick = status === "idle";

      if (isFirstClick) {
        currentBoard = placeBombs(board, cfg.rows, cfg.cols, cfg.mines, row, col);
        startTimer();
      }

      if (currentBoard[row][col].hasBomb) {
        const lostBoard = currentBoard.map((r) =>
          r.map((c) => {
            if (c.hasBomb && !c.flagged) return { ...c, revealed: true };
            if (!c.hasBomb && c.flagged) return { ...c, wrongFlag: true };
            return { ...c };
          })
        );
        setBoard(lostBoard);
        setDeathCell({ row, col });
        setStatus("lost");
        stopTimer();
        return;
      }

      const newBoard = floodReveal(currentBoard, cfg.rows, cfg.cols, row, col);

      if (checkWin(newBoard, cfg.rows, cfg.cols, cfg.mines)) {
        const wonBoard = newBoard.map((r) =>
          r.map((c) => ({ ...c, flagged: c.hasBomb ? true : c.flagged }))
        );
        setBoard(wonBoard);
        setStatus("won");
        setMinesLeft(0);
        stopTimer();
      } else {
        setBoard(newBoard);
        if (isFirstClick) setStatus("playing");
      }
    },
    [board, status, cfg, startTimer, stopTimer]
  );

  const toggleFlag = useCallback(
    (row: number, col: number) => {
      if (status === "won" || status === "lost") return;
      if (board[row][col].revealed) return;

      const newBoard = board.map((r) => r.map((c) => ({ ...c })));
      newBoard[row][col].flagged = !newBoard[row][col].flagged;
      setBoard(newBoard);
      setMinesLeft(cfg.mines - countFlags(newBoard));
    },
    [board, status, cfg.mines]
  );

  const handleCellRightClick = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      toggleFlag(row, col);
    },
    [toggleFlag]
  );

  // Ref to always call latest toggleFlag from inside the setTimeout
  const toggleFlagRef = useRef(toggleFlag);
  useEffect(() => { toggleFlagRef.current = toggleFlag; }, [toggleFlag]);

  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const pointerStartPos = useRef({ x: 0, y: 0 });

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  // Pointer Events API long press — works uniformly on iOS Safari, Android,
  // and desktop, unlike Touch Events which have iOS-specific quirks.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, row: number, col: number) => {
      if (e.pointerType === "mouse") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerStartPos.current = { x: e.clientX, y: e.clientY };
      longPressedRef.current = false;
      cancelLongPress();
      longPressRef.current = setTimeout(() => {
        longPressedRef.current = true;
        longPressRef.current = null;
        toggleFlagRef.current(row, col);
      }, 500);
    },
    [cancelLongPress]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const dx = e.clientX - pointerStartPos.current.x;
      const dy = e.clientY - pointerStartPos.current.y;
      if (dx * dx + dy * dy > 25) cancelLongPress(); // cancel if moved > 5px
    },
    [cancelLongPress]
  );

  const faceEmoji =
    status === "won" ? "😎" : status === "lost" ? "😵" : facePressed ? "😮" : "🙂";

  return (
    <div className="bomb-finder">
      <div className="bomb-finder__toolbar">
        {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
          <button
            key={d}
            className={`bomb-finder__diff-btn${difficulty === d ? " bomb-finder__diff-btn--active" : ""}`}
            onClick={() => resetGame(d)}
          >
            {DIFFICULTIES[d].label}
          </button>
        ))}
      </div>

      <div className="bomb-finder__panel">
        <div className="bomb-finder__status-bar">
          <div className="bomb-finder__display">{fmt(minesLeft)}</div>

          <button
            className={`bomb-finder__face${facePressed ? " bomb-finder__face--pressed" : ""}`}
            onMouseDown={() => setFacePressed(true)}
            onMouseUp={() => {
              setFacePressed(false);
              resetGame();
            }}
            onMouseLeave={() => setFacePressed(false)}
          >
            {faceEmoji}
          </button>

          <div className="bomb-finder__display">{fmt(time)}</div>
        </div>

        <div
          className="bomb-finder__board"
          style={{ gridTemplateColumns: `repeat(${cfg.cols}, 24px)` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isDeath = deathCell?.row === r && deathCell?.col === c;
              let content: React.ReactNode = null;
              let extraClass = "";

              if (cell.revealed) {
                extraClass += " bomb-finder__cell--revealed";
                if (isDeath) {
                  extraClass += " bomb-finder__cell--death";
                  content = "💣";
                } else if (cell.hasBomb) {
                  content = "💣";
                } else if (cell.adjacentCount > 0) {
                  content = (
                    <span
                      className="bomb-finder__cell-num"
                      style={{ color: NUMBER_COLORS[cell.adjacentCount] }}
                    >
                      {cell.adjacentCount}
                    </span>
                  );
                }
              } else {
                if (cell.wrongFlag) {
                  content = "❌";
                } else if (cell.flagged) {
                  content = "🚩";
                }
              }

              return (
                <button
                  key={`${r}-${c}`}
                  className={`bomb-finder__cell${extraClass}`}
                  onClick={() => {
                    if (longPressedRef.current) { longPressedRef.current = false; return; }
                    handleCellClick(r, c);
                  }}
                  onContextMenu={(e) => handleCellRightClick(e, r, c)}
                  onPointerDown={(e) => handlePointerDown(e, r, c)}
                  onPointerUp={() => cancelLongPress()}
                  onPointerCancel={() => cancelLongPress()}
                  onPointerMove={handlePointerMove}
                >
                  {content}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
