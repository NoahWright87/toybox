import { useState, useEffect, useCallback, useRef } from "react";
import "./TicTacToe.css";

type Player = "X" | "O";
type Cell = Player | null;
type BoardSize = 3 | 5 | 7;
type GameMode = "human" | "ai";
type AIDifficulty = "easy" | "normal" | "hard";
type GameVariant = "classic" | "dropIn";

interface GameConfig {
  size: BoardSize;
  mode: GameMode;
  difficulty: AIDifficulty;
  variant: GameVariant;
}

function getWinLength(size: BoardSize): number {
  return size === 3 ? 3 : size === 5 ? 4 : 5;
}

function createBoard(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(null));
}

function checkWinner(
  board: Cell[][],
  size: number,
  winLength: number
): { winner: Player; cells: [number, number][] } | null {
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      for (const [dr, dc] of directions) {
        const cells: [number, number][] = [[r, c]];
        for (let k = 1; k < winLength; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (
            nr < 0 ||
            nr >= size ||
            nc < 0 ||
            nc >= size ||
            board[nr][nc] !== cell
          )
            break;
          cells.push([nr, nc]);
        }
        if (cells.length === winLength)
          return { winner: cell as Player, cells };
      }
    }
  }
  return null;
}

function isBoardFull(board: Cell[][]): boolean {
  return board.every((row) => row.every((c) => c !== null));
}

// Returns the row a piece would land in for a given column (-1 if full)
function getDropRow(board: Cell[][], size: number, col: number): number {
  for (let r = size - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return -1;
}

// Returns valid moves for the current variant
function getAvailableMoves(
  board: Cell[][],
  size: number,
  variant: GameVariant
): [number, number][] {
  if (variant === "classic") {
    const cells: [number, number][] = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (!board[r][c]) cells.push([r, c]);
    return cells;
  }
  const moves: [number, number][] = [];
  for (let c = 0; c < size; c++) {
    const row = getDropRow(board, size, c);
    if (row !== -1) moves.push([row, c]);
  }
  return moves;
}

// --- AI helpers ---

function findWinningMove(
  board: Cell[][],
  size: number,
  winLength: number,
  player: Player,
  moves: [number, number][]
): [number, number] | null {
  for (const [r, c] of moves) {
    const test = board.map((row) => [...row]);
    test[r][c] = player;
    if (checkWinner(test, size, winLength)) return [r, c];
  }
  return null;
}

function scorePosition(
  board: Cell[][],
  size: number,
  winLength: number,
  r: number,
  c: number,
  player: Player
): number {
  const opponent: Player = player === "X" ? "O" : "X";
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  let score = 0;

  // Center proximity bonus
  const mid = Math.floor(size / 2);
  score += Math.max(0, size - Math.abs(r - mid) - Math.abs(c - mid));

  for (const [dr, dc] of directions) {
    for (let offset = -(winLength - 1); offset <= 0; offset++) {
      let myCount = 0;
      let oppCount = 0;
      let inBounds = true;

      for (let k = 0; k < winLength; k++) {
        const nr = r + (offset + k) * dr;
        const nc = c + (offset + k) * dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
          inBounds = false;
          break;
        }
        if (board[nr][nc] === player) myCount++;
        else if (board[nr][nc] === opponent) oppCount++;
      }

      if (!inBounds) continue;
      if (myCount > 0 && oppCount === 0) score += Math.pow(4, myCount);
      else if (oppCount > 0 && myCount === 0) score += Math.pow(3, oppCount);
    }
  }

  return score;
}

function getCenterPreference(
  board: Cell[][],
  size: number,
  variant: GameVariant,
  moves: [number, number][]
): [number, number] | null {
  const mid = Math.floor(size / 2);
  if (variant === "classic") {
    if (board[mid][mid] === null) return [mid, mid];
  } else {
    const centerDrop = moves.find(([, c]) => c === mid);
    if (centerDrop) return centerDrop;
  }
  return null;
}

function getEasyMove(
  board: Cell[][],
  size: number,
  variant: GameVariant
): [number, number] {
  const moves = getAvailableMoves(board, size, variant);
  return moves[Math.floor(Math.random() * moves.length)];
}

function getNormalMove(
  board: Cell[][],
  size: number,
  winLength: number,
  variant: GameVariant
): [number, number] {
  const ai: Player = "O";
  const human: Player = "X";
  const moves = getAvailableMoves(board, size, variant);
  if (moves.length === 0) return [0, 0];

  const win = findWinningMove(board, size, winLength, ai, moves);
  if (win) return win;
  const block = findWinningMove(board, size, winLength, human, moves);
  if (block) return block;

  const center = getCenterPreference(board, size, variant, moves);
  if (center) return center;

  const scored = moves.map(([r, c]) => ({
    pos: [r, c] as [number, number],
    score: scorePosition(board, size, winLength, r, c, ai),
  }));
  scored.sort((a, b) => b.score - a.score);

  if (Math.random() < 0.2 && scored.length > 1) {
    const topK = Math.min(3, scored.length);
    return scored[Math.floor(Math.random() * topK)].pos;
  }
  return scored[0].pos;
}

function getHardMove(
  board: Cell[][],
  size: number,
  winLength: number,
  variant: GameVariant
): [number, number] {
  const ai: Player = "O";
  const human: Player = "X";
  const moves = getAvailableMoves(board, size, variant);
  if (moves.length === 0) return [0, 0];

  const win = findWinningMove(board, size, winLength, ai, moves);
  if (win) return win;
  const block = findWinningMove(board, size, winLength, human, moves);
  if (block) return block;

  const center = getCenterPreference(board, size, variant, moves);
  if (center) return center;

  const scored = moves.map(([r, c]) => ({
    pos: [r, c] as [number, number],
    score: scorePosition(board, size, winLength, r, c, ai),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].pos;
}

// --- Setup Screen ---

function SetupScreen({ onStart }: { onStart: (cfg: GameConfig) => void }) {
  const [variant, setVariant] = useState<GameVariant>("classic");
  const [size, setSize] = useState<BoardSize>(3);
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("normal");

  const winHint =
    size === 3
      ? "Get 3 in a row to win"
      : size === 5
      ? "Get 4 in a row to win"
      : "Get 5 in a row to win";

  return (
    <div className="ttt-setup">
      <h1 className="ttt-setup__title">Tic-Tac-Toe</h1>

      <div className="ttt-setup__section">
        <div className="ttt-setup__label">Style</div>
        <div className="ttt-setup__options">
          <button
            className={`ttt-setup__option${variant === "classic" ? " ttt-setup__option--active" : ""}`}
            onClick={() => setVariant("classic")}
          >
            Classic
          </button>
          <button
            className={`ttt-setup__option${variant === "dropIn" ? " ttt-setup__option--active" : ""}`}
            onClick={() => setVariant("dropIn")}
          >
            Drop In
          </button>
        </div>
        <div className="ttt-setup__hint">
          {variant === "classic"
            ? "Click any empty square"
            : "Pieces fall to the bottom of the column"}
        </div>
      </div>

      <div className="ttt-setup__section">
        <div className="ttt-setup__label">Board Size</div>
        <div className="ttt-setup__options">
          {([3, 5, 7] as BoardSize[]).map((s) => (
            <button
              key={s}
              className={`ttt-setup__option${size === s ? " ttt-setup__option--active" : ""}`}
              onClick={() => setSize(s)}
            >
              {s}×{s}
            </button>
          ))}
        </div>
        <div className="ttt-setup__hint">{winHint}</div>
      </div>

      <div className="ttt-setup__section">
        <div className="ttt-setup__label">Opponent</div>
        <div className="ttt-setup__options">
          <button
            className={`ttt-setup__option${mode === "ai" ? " ttt-setup__option--active" : ""}`}
            onClick={() => setMode("ai")}
          >
            vs Computer
          </button>
          <button
            className={`ttt-setup__option${mode === "human" ? " ttt-setup__option--active" : ""}`}
            onClick={() => setMode("human")}
          >
            vs Human
          </button>
        </div>
      </div>

      {mode === "ai" && (
        <div className="ttt-setup__section">
          <div className="ttt-setup__label">Difficulty</div>
          <div className="ttt-setup__options">
            <button
              className={`ttt-setup__option${difficulty === "easy" ? " ttt-setup__option--active" : ""}`}
              onClick={() => setDifficulty("easy")}
            >
              Easy
            </button>
            <button
              className={`ttt-setup__option${difficulty === "normal" ? " ttt-setup__option--active" : ""}`}
              onClick={() => setDifficulty("normal")}
            >
              Normal
            </button>
            <button
              className={`ttt-setup__option${difficulty === "hard" ? " ttt-setup__option--active" : ""}`}
              onClick={() => setDifficulty("hard")}
            >
              Hard
            </button>
          </div>
          <div className="ttt-setup__hint">
            {difficulty === "easy"
              ? "Picks random squares"
              : difficulty === "normal"
              ? "Tries to win and block you"
              : "Always picks the best move it can see"}
          </div>
        </div>
      )}

      <button
        className="ttt-setup__start"
        onClick={() =>
          onStart({
            variant,
            size,
            mode,
            difficulty: mode === "ai" ? difficulty : "easy",
          })
        }
      >
        Start Game
      </button>
    </div>
  );
}

// --- Main Game ---

export default function TicTacToe() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [board, setBoard] = useState<Cell[][]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>("X");
  const [winResult, setWinResult] = useState<{
    winner: Player;
    cells: [number, number][];
  } | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [debugWeights, setDebugWeights] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStatusTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 500);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      setDebugWeights((v) => !v);
    }
  }, []);

  const startGame = useCallback((cfg: GameConfig) => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    setConfig(cfg);
    setBoard(createBoard(cfg.size));
    setCurrentPlayer("X");
    setWinResult(null);
    setIsDraw(false);
    setAiThinking(false);
    setHoverCol(null);
  }, []);

  const makeMove = useCallback(
    (r: number, c: number) => {
      if (!config || winResult || isDraw || aiThinking) return;

      let targetR = r;
      if (config.variant === "dropIn") {
        const dropR = getDropRow(board, config.size, c);
        if (dropR === -1) return;
        targetR = dropR;
      } else {
        if (board[r][c]) return;
      }

      const newBoard = board.map((row) => [...row]);
      newBoard[targetR][c] = currentPlayer;
      const winLength = getWinLength(config.size);
      const result = checkWinner(newBoard, config.size, winLength);
      setBoard(newBoard);
      if (result) {
        setWinResult(result);
      } else if (isBoardFull(newBoard)) {
        setIsDraw(true);
      } else {
        setCurrentPlayer(currentPlayer === "X" ? "O" : "X");
      }
    },
    [config, board, currentPlayer, winResult, isDraw, aiThinking]
  );

  // AI turn
  useEffect(() => {
    if (
      !config ||
      config.mode !== "ai" ||
      currentPlayer !== "O" ||
      winResult ||
      isDraw
    )
      return;

    setAiThinking(true);
    const winLength = getWinLength(config.size);

    aiTimerRef.current = setTimeout(() => {
      aiTimerRef.current = null;
      setAiThinking(false);

      const [r, c] =
        config.difficulty === "easy"
          ? getEasyMove(board, config.size, config.variant)
          : config.difficulty === "hard"
          ? getHardMove(board, config.size, winLength, config.variant)
          : getNormalMove(board, config.size, winLength, config.variant);

      const newBoard = board.map((row) => [...row]);
      newBoard[r][c] = "O";
      const result = checkWinner(newBoard, config.size, winLength);
      setBoard(newBoard);

      if (result) {
        setWinResult(result);
      } else if (isBoardFull(newBoard)) {
        setIsDraw(true);
      } else {
        setCurrentPlayer("X");
      }
    }, 350);

    return () => {
      if (aiTimerRef.current) {
        clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
      setAiThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, currentPlayer, winResult, isDraw, board]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === ".") {
        e.preventDefault();
        setDebugWeights((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!config) {
    return <SetupScreen onStart={startGame} />;
  }

  const winCells = new Set(
    winResult?.cells.map(([r, c]) => `${r}-${c}`) ?? []
  );
  const gameOver = !!(winResult || isDraw);
  const isAITurn =
    config.mode === "ai" && currentPlayer === "O" && !gameOver;
  const isDropIn = config.variant === "dropIn";

  // For drop-in: compute which row would receive a piece per column
  const dropTargetRow: number[] = [];
  if (isDropIn) {
    for (let c = 0; c < config.size; c++) {
      dropTargetRow[c] = getDropRow(board, config.size, c);
    }
  }

  const cellSize =
    config.size === 3
      ? "clamp(72px, 28vw, 110px)"
      : config.size === 5
      ? "clamp(56px, 17vw, 86px)"
      : "clamp(42px, 12vw, 64px)";
  const cellFont =
    config.size === 3
      ? "clamp(1.6rem, 8vw, 2.6rem)"
      : config.size === 5
      ? "clamp(1.2rem, 5vw, 2rem)"
      : "clamp(0.9rem, 3.5vw, 1.5rem)";

  let statusText: string;
  if (winResult) {
    if (config.mode === "ai" && winResult.winner === "O") statusText = "Computer wins!";
    else if (config.mode === "ai") statusText = "You win!";
    else statusText = `Player ${winResult.winner} wins!`;
  } else if (isDraw) {
    statusText = "It's a draw!";
  } else if (isAITurn) {
    statusText = "Computer is thinking\u2026";
  } else if (config.mode === "human") {
    statusText = `Player ${currentPlayer}'s turn`;
  } else {
    statusText = "Your turn (X)";
  }

  const statusMod = winResult
    ? winResult.winner === "X"
      ? " ttt__status--x-win"
      : " ttt__status--o-win"
    : isDraw
    ? " ttt__status--draw"
    : "";

  // Precompute debug weight map
  // Classic: score every empty cell. Drop-in: score only the landing cell per column.
  const winLength = getWinLength(config.size);
  const weightMap: Map<string, number> = new Map();
  if (debugWeights && !gameOver) {
    const moves = getAvailableMoves(board, config.size, config.variant);
    for (const [r, c] of moves) {
      weightMap.set(
        `${r}-${c}`,
        scorePosition(board, config.size, winLength, r, c, currentPlayer)
      );
    }
  }

  return (
    <div className="ttt">
      <div
        className={`ttt__status${statusMod}`}
        onClick={handleStatusTap}
        style={{ cursor: "default" }}
      >
        {statusText}
      </div>

      <div
        className={`ttt__board${isDropIn ? " ttt__board--drop-in" : ""}`}
        style={
          {
            gridTemplateColumns: `repeat(${config.size}, 1fr)`,
            "--cell-size": cellSize,
            "--cell-font": cellFont,
          } as React.CSSProperties
        }
        onMouseLeave={() => setHoverCol(null)}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            const key = `${r}-${c}`;
            const isWin = winCells.has(key);
            const isLandingCell = isDropIn && dropTargetRow[c] === r;
            const isColHovered = isDropIn && hoverCol === c;
            const colAvailable = isDropIn && dropTargetRow[c] !== -1;

            const canClick = !gameOver && !isAITurn && (
              isDropIn ? colAvailable : !cell
            );

            const isDropTarget =
              isDropIn && isLandingCell && isColHovered && canClick;

            return (
              <button
                key={key}
                className={[
                  "ttt__cell",
                  cell === "X" ? "ttt__cell--x" : cell === "O" ? "ttt__cell--o" : "",
                  isWin ? "ttt__cell--win" : "",
                  canClick ? "ttt__cell--clickable" : "",
                  isDropIn && isColHovered && !cell && !isLandingCell
                    ? "ttt__cell--col-hover"
                    : "",
                  isDropTarget
                    ? `ttt__cell--drop-target ttt__cell--drop-target-${currentPlayer.toLowerCase()}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => makeMove(r, c)}
                onMouseEnter={() => isDropIn && setHoverCol(c)}
                disabled={!canClick}
                aria-label={cell ?? `row ${r + 1} column ${c + 1}`}
              >
                {cell}
                {debugWeights && weightMap.has(key) && (
                  <span
                    className={`ttt__weight ttt__weight--${currentPlayer.toLowerCase()}`}
                  >
                    {weightMap.get(key)}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {gameOver && (
        <div className="ttt__actions">
          <button className="ttt__btn" onClick={() => startGame(config)}>
            Play Again
          </button>
          <button
            className="ttt__btn ttt__btn--secondary"
            onClick={() => setConfig(null)}
          >
            Change Settings
          </button>
        </div>
      )}

      {!gameOver && (
        <div className="ttt__legend">
          {config.mode === "ai" ? (
            <>
              <span className="ttt__legend-x">You (X)</span>
              <span> vs </span>
              <span className="ttt__legend-o">
                Computer (O) &ndash; {config.difficulty}
              </span>
            </>
          ) : (
            <>
              <span className="ttt__legend-x">Player 1 (X)</span>
              <span> vs </span>
              <span className="ttt__legend-o">Player 2 (O)</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
