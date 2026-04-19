import { useState, useEffect, useCallback, type CSSProperties } from "react";
import "./NumberMuncher.css";

type BoardSize = 5 | 6 | 7;

interface MathMode {
  id: string;
  label: string;
  test: (n: number) => boolean;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
  return true;
}

const MATH_MODES: MathMode[] = [
  { id: "multiples-3", label: "Multiples of 3", test: (n) => n % 3 === 0 },
  { id: "even", label: "Even Numbers", test: (n) => n % 2 === 0 },
  { id: "odd", label: "Odd Numbers", test: (n) => n % 2 !== 0 },
  { id: "prime", label: "Prime Numbers", test: isPrime },
  { id: "factors-12", label: "Factors of 12", test: (n) => 12 % n === 0 },
  { id: "multiples-5", label: "Multiples of 5", test: (n) => n % 5 === 0 },
];

function makeGrid(rule: MathMode, size: BoardSize): number[][] {
  const grid: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 1 + Math.floor(Math.random() * 99))
  );

  const guaranteed = Math.max(4, Math.floor((size * size) / 5));
  const positions = Array.from({ length: size * size }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  let placed = 0;
  for (const idx of positions) {
    if (placed >= guaranteed) break;
    const row = Math.floor(idx / size);
    const col = idx % size;
    if (!rule.test(grid[row][col])) {
      let value = 1 + Math.floor(Math.random() * 99);
      while (!rule.test(value)) value = 1 + Math.floor(Math.random() * 99);
      grid[row][col] = value;
    }
    placed++;
  }

  return grid;
}

function makeEaten(size: BoardSize): boolean[][] {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

function getMathModeById(id: string): MathMode {
  return MATH_MODES.find((mode) => mode.id === id) ?? MATH_MODES[0];
}

export default function NumberMuncher() {
  const [mathModeId, setMathModeId] = useState<string>(MATH_MODES[0].id);
  const [boardSize, setBoardSize] = useState<BoardSize>(7);
  const [showHelp, setShowHelp] = useState(false);
  const [started, setStarted] = useState(false);

  const activeMode = getMathModeById(mathModeId);

  const [grid, setGrid] = useState<number[][]>(() => makeGrid(activeMode, boardSize));
  const [eaten, setEaten] = useState<boolean[][]>(() => makeEaten(boardSize));
  const [pos, setPos] = useState({ row: 0, col: 0 });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [isMunching, setIsMunching] = useState(false);

  const resetBoard = useCallback((mode: MathMode, size: BoardSize) => {
    setGrid(makeGrid(mode, size));
    setEaten(makeEaten(size));
    setPos({ row: 0, col: 0 });
  }, []);

  const startRun = useCallback(() => {
    const mode = getMathModeById(mathModeId);
    resetBoard(mode, boardSize);
    setScore(0);
    setLives(3);
    setFlash(null);
    setGameOver(false);
    setIsMunching(false);
    setStarted(true);
  }, [boardSize, mathModeId, resetBoard]);

  const moveBy = useCallback(
    (rowDelta: number, colDelta: number) => {
      if (!started || gameOver) return;
      setPos((prev) => ({
        row: Math.max(0, Math.min(boardSize - 1, prev.row + rowDelta)),
        col: Math.max(0, Math.min(boardSize - 1, prev.col + colDelta)),
      }));
    },
    [boardSize, gameOver, started]
  );

  const eat = useCallback(() => {
    if (!started || gameOver || eaten[pos.row][pos.col]) return;
    setIsMunching(true);
    setTimeout(() => setIsMunching(false), 170);

    const value = grid[pos.row][pos.col];
    if (activeMode.test(value)) {
      setEaten((prev) => {
        const next = prev.map((row) => [...row]);
        next[pos.row][pos.col] = true;
        return next;
      });
      setScore((current) => current + 10);
      setFlash("correct");
      setTimeout(() => setFlash(null), 280);
      return;
    }

    setLives((current) => {
      const next = current - 1;
      if (next <= 0) setGameOver(true);
      return next;
    });
    setFlash("wrong");
    setTimeout(() => setFlash(null), 350);
  }, [activeMode, eaten, gameOver, grid, pos, started]);

  const handleCellTap = useCallback(
    (row: number, col: number) => {
      if (!started || gameOver) return;
      if (row === pos.row && col === pos.col) {
        eat();
        return;
      }

      const rowDelta = row - pos.row;
      const colDelta = col - pos.col;
      if (rowDelta !== 0 && colDelta !== 0) {
        if (Math.abs(rowDelta) >= Math.abs(colDelta)) {
          moveBy(Math.sign(rowDelta), 0);
        } else {
          moveBy(0, Math.sign(colDelta));
        }
        return;
      }

      if (rowDelta !== 0) {
        moveBy(Math.sign(rowDelta), 0);
      } else if (colDelta !== 0) {
        moveBy(0, Math.sign(colDelta));
      }
    },
    [eat, gameOver, moveBy, pos.col, pos.row, started]
  );

  useEffect(() => {
    if (!started || gameOver) return;
    const flatGrid = grid.flat();
    const flatEaten = eaten.flat();
    const remaining = flatGrid.filter((value, i) => activeMode.test(value) && !flatEaten[i]).length;
    if (remaining > 0) return;

    const timeout = setTimeout(() => {
      resetBoard(activeMode, boardSize);
    }, 500);
    return () => clearTimeout(timeout);
  }, [activeMode, boardSize, eaten, gameOver, grid, resetBoard, started]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!started || gameOver) return;
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveBy(-1, 0);
          break;
        case "ArrowDown":
          event.preventDefault();
          moveBy(1, 0);
          break;
        case "ArrowLeft":
          event.preventDefault();
          moveBy(0, -1);
          break;
        case "ArrowRight":
          event.preventDefault();
          moveBy(0, 1);
          break;
        case " ":
        case "Enter":
          event.preventDefault();
          eat();
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eat, gameOver, moveBy, started]);

  const remainingMatches = grid
    .flat()
    .filter((value, i) => activeMode.test(value) && !eaten.flat()[i]).length;

  if (!started) {
    return (
      <div className="number-muncher-launcher">
        <h2 className="number-muncher-launcher__title">Nom Nom Numerals</h2>

        <div className="number-muncher-launcher__section">
          <label className="number-muncher-launcher__label" htmlFor="nm-mode">
            Math Type
          </label>
          <select
            id="nm-mode"
            className="number-muncher-launcher__select"
            value={mathModeId}
            onChange={(event) => setMathModeId(event.target.value)}
          >
            {MATH_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        <div className="number-muncher-launcher__section">
          <div className="number-muncher-launcher__label">Board Size</div>
          <div className="number-muncher-launcher__sizes">
            {[5, 6, 7].map((size) => (
              <button
                type="button"
                key={size}
                className={[
                  "number-muncher-launcher__size-btn",
                  boardSize === size ? "number-muncher-launcher__size-btn--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setBoardSize(size as BoardSize)}
              >
                {size}×{size}
              </button>
            ))}
          </div>
        </div>

        <label className="number-muncher-launcher__monster-row">
          <input type="checkbox" disabled aria-disabled="true" />
          Monsters (coming soon)
        </label>

        <div className="number-muncher-launcher__actions">
          <button
            type="button"
            className="number-muncher-launcher__help-btn"
            onClick={() => setShowHelp((value) => !value)}
          >
            Help
          </button>
          <button type="button" className="number-muncher-launcher__start-btn" onClick={startRun}>
            Start
          </button>
        </div>

        {showHelp && (
          <div className="number-muncher-launcher__help">
            Move with arrow keys or touch controls. Tap a square once to move one step toward it.
            Tap your current square (or press Space/Enter) to eat.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        "number-muncher",
        flash ? `number-muncher--${flash}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="number-muncher__goal">{activeMode.label}</div>

      <div
        className="number-muncher__grid"
        style={{
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          "--nm-size": boardSize,
        } as CSSProperties}
      >
        <div
          className={[
            "number-muncher__muncher",
            isMunching ? "number-muncher__muncher--munching" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            {
              "--muncher-row": pos.row,
              "--muncher-col": pos.col,
            } as CSSProperties
          }
          aria-hidden="true"
        />

        {grid.map((row, rowIdx) =>
          row.map((value, colIdx) => (
            <div
              key={`${rowIdx}-${colIdx}`}
              className={[
                "number-muncher__cell",
                eaten[rowIdx][colIdx] ? "number-muncher__cell--eaten" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleCellTap(rowIdx, colIdx)}
              aria-label={`Number ${value} at row ${rowIdx + 1}, column ${colIdx + 1}`}
            >
              {!eaten[rowIdx][colIdx] && value}
            </div>
          ))
        )}
      </div>

      {remainingMatches === 3 && <div className="number-muncher__left-hint">3 left!</div>}

      {gameOver && (
        <div className="number-muncher__overlay">
          <div className="number-muncher__gameover">
            <div className="number-muncher__gameover-title">Game Over</div>
            <div className="number-muncher__gameover-score">Final Score: {score}</div>
            <div className="number-muncher__gameover-actions">
              <button className="number-muncher__restart" onClick={startRun}>
                Play Again
              </button>
              <button className="number-muncher__restart" onClick={() => setStarted(false)}>
                Launcher
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="number-muncher__bottom-bar">
        <div className="number-muncher__score">Score: {score}</div>
        <div className="number-muncher__lives">{"❤️".repeat(Math.max(0, lives))}</div>
      </div>

      <div className="number-muncher__touch-controls" aria-label="Touch controls">
        <button type="button" className="number-muncher__touch-btn" onClick={() => moveBy(-1, 0)}>
          ↑
        </button>
        <div className="number-muncher__touch-middle-row">
          <button type="button" className="number-muncher__touch-btn" onClick={() => moveBy(0, -1)}>
            ←
          </button>
          <button
            type="button"
            className="number-muncher__touch-btn number-muncher__touch-btn--eat"
            onClick={eat}
          >
            Eat
          </button>
          <button type="button" className="number-muncher__touch-btn" onClick={() => moveBy(0, 1)}>
            →
          </button>
        </div>
        <button type="button" className="number-muncher__touch-btn" onClick={() => moveBy(1, 0)}>
          ↓
        </button>
      </div>
    </div>
  );
}
