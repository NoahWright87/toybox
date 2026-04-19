import { useState, useEffect, useCallback, type CSSProperties } from "react";
import "./NumberMuncher.css";

const COLS = 7;
const ROWS = 5;

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
  return true;
}

interface Rule {
  label: string;
  test: (n: number) => boolean;
}

const RULES: Rule[] = [
  { label: "multiples of 3", test: (n) => n % 3 === 0 },
  { label: "even numbers", test: (n) => n % 2 === 0 },
  { label: "prime numbers", test: isPrime },
  { label: "multiples of 5", test: (n) => n % 5 === 0 },
  { label: "multiples of 4", test: (n) => n % 4 === 0 },
  { label: "odd numbers", test: (n) => n % 2 !== 0 },
];

function makeGrid(rule: Rule): number[][] {
  const grid: number[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 1 + Math.floor(Math.random() * 99))
  );
  // Guarantee at least 4 matching values by placing them at random positions
  const positions = Array.from({ length: ROWS * COLS }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  let placed = 0;
  for (const idx of positions) {
    if (placed >= 4) break;
    const r = Math.floor(idx / COLS);
    const c = idx % COLS;
    if (!rule.test(grid[r][c])) {
      let v = 1 + Math.floor(Math.random() * 99);
      while (!rule.test(v)) v = 1 + Math.floor(Math.random() * 99);
      grid[r][c] = v;
    }
    placed++;
  }
  return grid;
}

function makeEaten(): boolean[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(false));
}

export default function NumberMuncher() {
  const [ruleIdx, setRuleIdx] = useState(0);
  const rule = RULES[ruleIdx % RULES.length];
  const [grid, setGrid] = useState(() => makeGrid(RULES[0]));
  const [eaten, setEaten] = useState(makeEaten);
  const [pos, setPos] = useState({ row: 0, col: 0 });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [isMunching, setIsMunching] = useState(false);

  const moveBy = useCallback(
    (rowDelta: number, colDelta: number) => {
      if (gameOver) return;
      setPos((prev) => ({
        row: Math.max(0, Math.min(ROWS - 1, prev.row + rowDelta)),
        col: Math.max(0, Math.min(COLS - 1, prev.col + colDelta)),
      }));
    },
    [gameOver]
  );

  // Detect level completion and advance
  useEffect(() => {
    if (gameOver) return;
    const flatGrid = grid.flat();
    const flatEaten = eaten.flat();
    const remaining = flatGrid.filter((v, i) => rule.test(v) && !flatEaten[i]).length;
    if (remaining === 0) {
      const t = setTimeout(() => {
        const nextIdx = (ruleIdx + 1) % RULES.length;
        const nextRule = RULES[nextIdx];
        setRuleIdx(nextIdx);
        setGrid(makeGrid(nextRule));
        setEaten(makeEaten());
        setPos({ row: 0, col: 0 });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [eaten, grid, rule, gameOver, ruleIdx]);

  const eat = useCallback(() => {
    if (gameOver || eaten[pos.row][pos.col]) return;
    setIsMunching(true);
    setTimeout(() => setIsMunching(false), 180);
    const val = grid[pos.row][pos.col];
    if (rule.test(val)) {
      setEaten((prev) => {
        const next = prev.map((r) => [...r]);
        next[pos.row][pos.col] = true;
        return next;
      });
      setScore((s) => s + 10);
      setFlash("correct");
      setTimeout(() => setFlash(null), 300);
    } else {
      setLives((l) => {
        const next = l - 1;
        if (next <= 0) setGameOver(true);
        return next;
      });
      setFlash("wrong");
      setTimeout(() => setFlash(null), 400);
    }
  }, [gameOver, eaten, pos, grid, rule]);

  const handleCellTap = useCallback(
    (row: number, col: number) => {
      if (gameOver) return;
      if (row === pos.row && col === pos.col) {
        eat();
        return;
      }
      setPos({ row, col });
    },
    [eat, gameOver, pos.col, pos.row]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (gameOver) return;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveBy(-1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveBy(1, 0);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveBy(0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveBy(0, 1);
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          eat();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eat, gameOver, moveBy]);

  function restart() {
    const startRule = RULES[0];
    setRuleIdx(0);
    setGrid(makeGrid(startRule));
    setEaten(makeEaten());
    setPos({ row: 0, col: 0 });
    setScore(0);
    setLives(3);
    setFlash(null);
    setGameOver(false);
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
      <div className="number-muncher__hud">
        <span>
          Eat: <strong>{rule.label}</strong>
        </span>
        <span>Score: {score}</span>
        <span>{"❤️".repeat(Math.max(0, lives))}</span>
      </div>

      <div
        className="number-muncher__grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
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
        {grid.map((row, r) =>
          row.map((val, c) => (
            <div
              key={`${r}-${c}`}
              className={[
                "number-muncher__cell",
                eaten[r][c] ? "number-muncher__cell--eaten" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleCellTap(r, c)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                handleCellTap(r, c);
              }}
              aria-label={`Number ${val} at row ${r + 1}, column ${c + 1}`}
            >
              {!eaten[r][c] && val}
            </div>
          ))
        )}
      </div>

      {gameOver && (
        <div className="number-muncher__overlay">
          <div className="number-muncher__gameover">
            <div className="number-muncher__gameover-title">Game Over</div>
            <div className="number-muncher__gameover-score">
              Final Score: {score}
            </div>
            <button className="number-muncher__restart" onClick={restart}>
              Play Again
            </button>
          </div>
        </div>
      )}

      <div className="number-muncher__hint">
        Arrow keys to move · Space or Enter to eat · Tap a square to move/eat
      </div>
      <div className="number-muncher__touch-controls" aria-label="Touch controls">
        <button
          type="button"
          className="number-muncher__touch-btn"
          onClick={() => moveBy(-1, 0)}
        >
          ↑
        </button>
        <div className="number-muncher__touch-middle-row">
          <button
            type="button"
            className="number-muncher__touch-btn"
            onClick={() => moveBy(0, -1)}
          >
            ←
          </button>
          <button
            type="button"
            className="number-muncher__touch-btn number-muncher__touch-btn--eat"
            onClick={eat}
          >
            Eat
          </button>
          <button
            type="button"
            className="number-muncher__touch-btn"
            onClick={() => moveBy(0, 1)}
          >
            →
          </button>
        </div>
        <button
          type="button"
          className="number-muncher__touch-btn"
          onClick={() => moveBy(1, 0)}
        >
          ↓
        </button>
      </div>
    </div>
  );
}
