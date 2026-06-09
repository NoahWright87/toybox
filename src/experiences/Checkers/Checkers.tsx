import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import {
  createBoard, getLegalMoves, applyMove, getGameStatus, getAiMove,
} from "./checkers";
import type { Board, Color, Move } from "./checkers";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { CK_SCORES_ID } from "../NsDoors97/filesystem/types";
import "./Checkers.css";

type Difficulty = "easy" | "hard";

interface PlayerConfig {
  isAi: boolean;
  difficulty: Difficulty;
}

interface Config {
  red: PlayerConfig;
  black: PlayerConfig;
}

interface Scores {
  wins: number;
  losses: number;
  draws: number;
}

function loadScores(): Scores {
  try {
    const content = fsStore.getFile(CK_SCORES_ID)?.content;
    if (content) return JSON.parse(content) as Scores;
  } catch { /* ignore */ }
  return { wins: 0, losses: 0, draws: 0 };
}

function saveScores(scores: Scores): void {
  try { fsStore.writeFile(CK_SCORES_ID, JSON.stringify(scores)); } catch { /* ignore */ }
}

interface CheckersProps {
  onQuit?: () => void;
}

export default function Checkers({ onQuit }: CheckersProps = {}) {
  const [phase, setPhase] = useState<"dialog" | "playing" | "game-over">("dialog");
  const [config, setConfig] = useState<Config>({
    red:   { isAi: false, difficulty: "easy" },
    black: { isAi: true,  difficulty: "easy" },
  });
  // Dialog draft state (committed only when Start is clicked)
  const [draft, setDraft] = useState<Config>(config);

  const [board, setBoard]                     = useState<Board>(createBoard);
  const [currentColor, setCurrentColor]       = useState<Color>("red");
  const [selected, setSelected]               = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves]           = useState<Move[]>([]);
  const [validTargets, setValidTargets]       = useState<[number, number][]>([]);
  const [aiThinking, setAiThinking]           = useState(false);
  const [gameStatus, setGameStatus]           = useState<string>("");
  const [scores, setScores]                   = useState<Scores>(loadScores);

  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Start a new game ──────────────────────────────────────────────────────
  const startGame = useCallback((cfg: Config) => {
    if (aiTimerRef.current) { clearTimeout(aiTimerRef.current); aiTimerRef.current = null; }
    setConfig(cfg);
    setBoard(createBoard());
    setCurrentColor("red");
    setSelected(null);
    setLegalMoves([]);
    setValidTargets([]);
    setAiThinking(false);
    setGameStatus("");
    setPhase("playing");
  }, []);

  const openDialog = useCallback(() => {
    if (aiTimerRef.current) { clearTimeout(aiTimerRef.current); aiTimerRef.current = null; }
    setAiThinking(false);
    setPhase("dialog");
    setDraft(config);
  }, [config]);

  // ── Game-over handling ────────────────────────────────────────────────────
  const handleGameOver = useCallback((status: string, cfg: Config) => {
    setPhase("game-over");
    setGameStatus(status);
    setScores((prev) => {
      let next: Scores;
      if (status === "draw") {
        next = { ...prev, draws: prev.draws + 1 };
      } else {
        const winner: Color = status === "red-wins" ? "red" : "black";
        const loser: Color  = winner === "red" ? "black" : "red";
        const humanWon  = !cfg[winner].isAi;
        const humanLost = !cfg[loser].isAi && cfg[winner].isAi;
        if (humanWon)       next = { ...prev, wins:   prev.wins   + 1 };
        else if (humanLost) next = { ...prev, losses: prev.losses + 1 };
        else                next = { ...prev, draws:  prev.draws  + 1 };
      }
      saveScores(next);
      return next;
    });
  }, []);

  // ── Execute a move ────────────────────────────────────────────────────────
  const executeMove = useCallback((move: Move, currentBoard: Board, currentCfg: Config, color: Color) => {
    const nextBoard = applyMove(currentBoard, move);
    const nextColor: Color = color === "red" ? "black" : "red";
    const status = getGameStatus(nextBoard, nextColor);
    setBoard(nextBoard);
    setSelected(null);
    setLegalMoves([]);
    setValidTargets([]);
    if (status !== "playing") {
      handleGameOver(status, currentCfg);
    } else {
      setCurrentColor(nextColor);
    }
  }, [handleGameOver]);

  // ── AI turn ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (!config[currentColor].isAi) return;

    setAiThinking(true);
    const delay = 400 + Math.random() * 300;
    aiTimerRef.current = setTimeout(() => {
      setBoard((b) => {
        const move = getAiMove(b, currentColor, config[currentColor].difficulty);
        if (move) {
          executeMove(move, b, config, currentColor);
        } else {
          const nextColor: Color = currentColor === "red" ? "black" : "red";
          handleGameOver(currentColor === "red" ? "black-wins" : "red-wins", config);
          setCurrentColor(nextColor);
        }
        setAiThinking(false);
        return b;
      });
    }, delay);
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentColor, config]);

  // ── Human click handling ──────────────────────────────────────────────────
  const allCurrentMoves = useMemo(
    () => (phase === "playing" ? getLegalMoves(board, currentColor) : []),
    [phase, board, currentColor]
  );

  const handleCellClick = useCallback((row: number, col: number) => {
    if (phase !== "playing") return;
    if (config[currentColor].isAi) return;
    if (aiThinking) return;

    const isTarget = validTargets.some(([r, c]: [number, number]) => r === row && c === col);
    if (isTarget && selected) {
      const move = legalMoves.find(
        (m) => m.from[0] === selected[0] && m.from[1] === selected[1]
               && m.to[0] === row && m.to[1] === col
      );
      if (move) {
        executeMove(move, board, config, currentColor);
      }
      return;
    }

    const piece = board[row][col];
    if (!piece || piece.color !== currentColor) {
      setSelected(null);
      setLegalMoves([]);
      setValidTargets([]);
      return;
    }

    const movesForPiece = allCurrentMoves.filter(
      (m) => m.from[0] === row && m.from[1] === col
    );
    if (movesForPiece.length === 0) {
      setSelected(null);
      setLegalMoves([]);
      setValidTargets([]);
      return;
    }

    setSelected([row, col]);
    setLegalMoves(movesForPiece);
    setValidTargets(movesForPiece.map((m) => m.to));
  }, [phase, config, currentColor, aiThinking, validTargets, selected, legalMoves, board, allCurrentMoves, executeMove]);

  // ── Menus ─────────────────────────────────────────────────────────────────
  const menus = useMemo<MenuBarMenu[]>(() => {
    const items = [
      { label: "New Game...", onClick: openDialog },
      ...(onQuit ? [{ separator: true as const }, { label: "Quit", onClick: onQuit }] : []),
    ];
    return [{ label: "Game", items }];
  }, [openDialog, onQuit]);

  useWindowMenus(menus);

  // ── Cells with movable pieces ─────────────────────────────────────────────
  const movableCells = useMemo(() => {
    if (phase !== "playing" || config[currentColor].isAi) return new Set<string>();
    return new Set(allCurrentMoves.map((m) => `${m.from[0]},${m.from[1]}`));
  }, [phase, config, currentColor, allCurrentMoves]);

  // ── Render ────────────────────────────────────────────────────────────────
  const statusLabel =
    phase === "playing"
      ? aiThinking
        ? `${currentColor === "red" ? "Red" : "Black"} is thinking...`
        : `${currentColor === "red" ? "Red" : "Black"}'s turn`
      : "";

  return (
    <div className="checkers">
      <div className="checkers__status">
        <span className={currentColor === "red" ? "checkers__turn-red" : "checkers__turn-black"}>
          {statusLabel}
        </span>
        <span className="checkers__scores">
          W:{scores.wins} L:{scores.losses} D:{scores.draws}
        </span>
      </div>

      <div className="checkers__board-container">
        {/* New-game dialog */}
        {phase === "dialog" && (
          <div className="checkers__dialog-backdrop">
            <div className="checkers__dialog">
              <div className="checkers__dialog-title">New Game</div>
              <div className="checkers__dialog-players">
                {(["red", "black"] as Color[]).map((side) => (
                  <div className="checkers__dialog-player" key={side}>
                    <div className={`checkers__dialog-player-label checkers__dialog-player-label--${side}`}>
                      {side === "red" ? "🔴 Red" : "⚫ Black"}
                    </div>
                    <div className="checkers__dialog-row">
                      <label className="checkers__dialog-radio">
                        <input
                          type="radio"
                          name={`${side}-type`}
                          checked={!draft[side].isAi}
                          onChange={() =>
                            setDraft((d) => ({ ...d, [side]: { ...d[side], isAi: false } }))
                          }
                        />
                        Human
                      </label>
                      <label className="checkers__dialog-radio">
                        <input
                          type="radio"
                          name={`${side}-type`}
                          checked={draft[side].isAi}
                          onChange={() =>
                            setDraft((d) => ({ ...d, [side]: { ...d[side], isAi: true } }))
                          }
                        />
                        Computer
                      </label>
                    </div>
                    {draft[side].isAi && (
                      <div className="checkers__dialog-diff">
                        <div className="checkers__dialog-diff-label">Difficulty:</div>
                        {(["easy", "hard"] as Difficulty[]).map((diff) => (
                          <label className="checkers__dialog-radio" key={diff}>
                            <input
                              type="radio"
                              name={`${side}-diff`}
                              checked={draft[side].difficulty === diff}
                              onChange={() =>
                                setDraft((d) => ({
                                  ...d,
                                  [side]: { ...d[side], difficulty: diff },
                                }))
                              }
                            />
                            {diff === "easy" ? "Easy" : "Hard"}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="checkers__dialog-btn" onClick={() => startGame(draft)}>
                Start Game
              </button>
            </div>
          </div>
        )}

        {/* Game-over overlay */}
        {phase === "game-over" && (
          <div className="checkers__overlay">
            <div className="checkers__result-box">
              <div className="checkers__result-title">
                {gameStatus === "red-wins"
                  ? "🔴 Red Wins!"
                  : gameStatus === "black-wins"
                  ? "⚫ Black Wins!"
                  : "Draw!"}
              </div>
              <div className="checkers__result-sub">
                W:{scores.wins}  L:{scores.losses}  D:{scores.draws}
              </div>
              <button
                className="checkers__result-btn"
                onClick={() => {
                  setDraft(config);
                  setPhase("dialog");
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        <div className="checkers__board-wrap">
          <div className="checkers__board">
            {board.map((rowArr, row) =>
              rowArr.map((piece, col) => {
                const isLight   = (row + col) % 2 === 0;
                const isSel     = selected?.[0] === row && selected?.[1] === col;
                const isTarget  = validTargets.some(([r, c]: [number, number]) => r === row && c === col);
                const canMove   = movableCells.has(`${row},${col}`);

                let cellClass = "checkers__cell";
                if (isSel)         cellClass += " checkers__cell--selected";
                else if (isTarget) cellClass += " checkers__cell--valid";
                else if (isLight)  cellClass += " checkers__cell--light";
                else               cellClass += " checkers__cell--dark";

                return (
                  <div
                    key={`${row}-${col}`}
                    className={cellClass}
                    onClick={() => handleCellClick(row, col)}
                  >
                    {piece && (
                      <div
                        className={[
                          "checkers__piece",
                          `checkers__piece--${piece.color}`,
                          isSel     ? "checkers__piece--selected-piece" : "",
                          canMove   ? "checkers__piece--can-move" : "",
                        ].join(" ").trim()}
                      >
                        {piece.isKing && <span className="checkers__king">★</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="checkers__thinking">
        {aiThinking && "Thinking..."}
      </div>
    </div>
  );
}
