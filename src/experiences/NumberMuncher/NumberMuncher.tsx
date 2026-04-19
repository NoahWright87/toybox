import { useState, useEffect, useCallback, type CSSProperties } from "react";
import "./NumberMuncher.css";

type BoardSize = 5 | 6 | 7;
type MathTypeId = "multiples" | "primes" | "even-odd" | "factors";

interface MathTypeOption {
  id: MathTypeId;
  label: string;
}

interface ActiveRule {
  label: string;
  test: (n: number) => boolean;
}

const MATH_TYPES: MathTypeOption[] = [
  { id: "multiples", label: "Multiples" },
  { id: "primes", label: "Primes" },
  { id: "even-odd", label: "Even/odd" },
  { id: "factors", label: "Factors" },
];

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
  return true;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildRule(mathType: MathTypeId, level: number): ActiveRule {
  if (mathType === "primes") return { label: "Prime Numbers", test: isPrime };

  if (mathType === "multiples") {
    const target = randomInt(2, 9);
    return { label: `Multiples of ${target}`, test: (n) => n % target === 0 };
  }

  if (mathType === "factors") {
    const target = randomInt(10, 999);
    return { label: `Factors of ${target}`, test: (n) => target % n === 0 };
  }

  const evenLevel = level % 2 === 1;
  return {
    label: evenLevel ? "Even Numbers" : "Odd Numbers",
    test: (n) => (evenLevel ? n % 2 === 0 : n % 2 !== 0),
  };
}

function makeGrid(rule: ActiveRule, size: BoardSize): number[][] {
  const grid: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => randomInt(1, 99))
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
      let value = randomInt(1, 99);
      while (!rule.test(value)) value = randomInt(1, 99);
      grid[row][col] = value;
    }
    placed++;
  }

  return grid;
}

function makeEaten(size: BoardSize): boolean[][] {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

function countRemaining(grid: number[][], eaten: boolean[][], rule: ActiveRule): number {
  let remaining = 0;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (!eaten[row][col] && rule.test(grid[row][col])) remaining++;
    }
  }
  return remaining;
}

export default function NumberMuncher() {
  const [mathType, setMathType] = useState<MathTypeId>("multiples");
  const [boardSize, setBoardSize] = useState<BoardSize>(7);
  const [showHelp, setShowHelp] = useState(false);
  const [started, setStarted] = useState(false);

  const [level, setLevel] = useState(1);
  const [rule, setRule] = useState<ActiveRule>(() => buildRule("multiples", 1));

  const [grid, setGrid] = useState<number[][]>(() => makeGrid(rule, boardSize));
  const [eaten, setEaten] = useState<boolean[][]>(() => makeEaten(boardSize));
  const [pos, setPos] = useState({ row: 0, col: 0 });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [isMunching, setIsMunching] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);

  const resetForLevel = useCallback(
    (nextLevel: number, keepScore: boolean) => {
      const nextRule = buildRule(mathType, nextLevel);
      setRule(nextRule);
      setGrid(makeGrid(nextRule, boardSize));
      setEaten(makeEaten(boardSize));
      setPos({ row: 0, col: 0 });
      setFlash(null);
      setGameOver(false);
      setIsMunching(false);
      setLevelComplete(false);
      setLevel(nextLevel);
      if (!keepScore) {
        setScore(0);
        setLives(3);
      }
    },
    [boardSize, mathType]
  );

  const startRun = useCallback(() => {
    resetForLevel(1, false);
    setStarted(true);
  }, [resetForLevel]);

  const backToLauncher = useCallback(() => {
    setStarted(false);
    setShowHelp(false);
    setLevelComplete(false);
    setGameOver(false);
  }, []);

  const moveBy = useCallback(
    (rowDelta: number, colDelta: number) => {
      if (!started || gameOver || levelComplete) return;
      setPos((prev) => ({
        row: Math.max(0, Math.min(boardSize - 1, prev.row + rowDelta)),
        col: Math.max(0, Math.min(boardSize - 1, prev.col + colDelta)),
      }));
    },
    [boardSize, gameOver, levelComplete, started]
  );

  const eat = useCallback(() => {
    if (!started || gameOver || levelComplete || eaten[pos.row][pos.col]) return;
    setIsMunching(true);
    setTimeout(() => setIsMunching(false), 170);

    const value = grid[pos.row][pos.col];
    if (rule.test(value)) {
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
  }, [eaten, gameOver, grid, levelComplete, pos, rule, started]);

  const handleCellTap = useCallback(
    (row: number, col: number) => {
      if (!started || gameOver || levelComplete) return;
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

      if (rowDelta !== 0) moveBy(Math.sign(rowDelta), 0);
      else if (colDelta !== 0) moveBy(0, Math.sign(colDelta));
    },
    [eat, gameOver, levelComplete, moveBy, pos.col, pos.row, started]
  );

  useEffect(() => {
    if (!started || gameOver || levelComplete) return;
    if (countRemaining(grid, eaten, rule) > 0) return;
    setLevelComplete(true);
  }, [eaten, gameOver, grid, levelComplete, rule, started]);

  const goToNextLevel = useCallback(() => {
    resetForLevel(level + 1, true);
  }, [level, resetForLevel]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!started) return;

      if (event.key === "Escape") {
        event.preventDefault();
        backToLauncher();
        return;
      }

      if (gameOver) return;

      if (levelComplete && event.key === "Enter") {
        event.preventDefault();
        goToNextLevel();
        return;
      }

      if (levelComplete) return;

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
  }, [backToLauncher, eat, gameOver, goToNextLevel, levelComplete, moveBy, started]);

  const remainingMatches = countRemaining(grid, eaten, rule);
  const leftHint = remainingMatches <= 3 && remainingMatches > 0 ? `Only ${remainingMatches} left!` : "";

  if (!started) {
    return (
      <div className="number-muncher-launcher">
        <h2 className="number-muncher-launcher__title">Nom Nom Numerals</h2>

        <div className="number-muncher-launcher__section">
          <label className="number-muncher-launcher__label" htmlFor="nm-type">
            Math Type
          </label>
          <select
            id="nm-type"
            className="number-muncher-launcher__select"
            value={mathType}
            onChange={(event) => setMathType(event.target.value as MathTypeId)}
          >
            {MATH_TYPES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
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
            Tap your current square (or press Space/Enter) to eat. Press Esc to return here.
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
      <button className="number-muncher__exit" onClick={backToLauncher} aria-label="Exit to launcher">
        🚪
      </button>

      <div className="number-muncher__goal">{rule.label}</div>

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

      {levelComplete && (
        <div className="number-muncher__overlay number-muncher__overlay--complete">
          <div className="number-muncher__dialog">
            <div className="number-muncher__dialog-title">Level Complete</div>
            <div className="number-muncher__dialog-score">Score: {score}</div>
            <button className="number-muncher__restart" onClick={goToNextLevel} autoFocus>
              Next Level
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="number-muncher__overlay number-muncher__overlay--gameover">
          <div className="number-muncher__dialog">
            <div className="number-muncher__dialog-title">Game Over</div>
            <div className="number-muncher__dialog-score">Final Score: {score}</div>
            <div className="number-muncher__gameover-actions">
              <button className="number-muncher__restart" onClick={startRun}>
                Play Again
              </button>
              <button className="number-muncher__restart" onClick={backToLauncher}>
                Launcher
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="number-muncher__bottom-bar">
        <div className="number-muncher__score">Score: {score}</div>
        <div className="number-muncher__left-hint">{leftHint}</div>
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
