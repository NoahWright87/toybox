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
type Speed = "snappy" | "moderate" | "cinematic";

const SLIDE_MS: Record<Speed, number> = { snappy: 200, moderate: 350, cinematic: 500 };
const RISE_MS  = 100;
const LAND_MS  = 80;
const CELL     = 44;
const PIECE_D  = 34;
const P_OFF    = (CELL - PIECE_D) / 2;   // 5px
const BOARD_PX = CELL * 8;               // 352px
const PILE_Y   = BOARD_PX + 8;           // 360px — below board grid
const PILE_GAP = 11;                     // pile overlap spacing

function cellXY(row: number, col: number) {
  return { x: col * CELL + P_OFF, y: row * CELL + P_OFF };
}

function pileXY(captor: Color, idx: number) {
  const bx = captor === "red" ? P_OFF : BOARD_PX / 2 + P_OFF;
  return { x: bx + idx * PILE_GAP, y: PILE_Y };
}

function decomposeHops(move: Move): Array<{
  from: [number, number]; to: [number, number]; capture: [number, number] | null;
}> {
  if (move.captures.length === 0) {
    return [{ from: move.from, to: move.to, capture: null }];
  }
  const result: Array<{ from: [number, number]; to: [number, number]; capture: [number, number] | null }> = [];
  let cur: [number, number] = move.from;
  for (const cap of move.captures) {
    const next: [number, number] = [2 * cap[0] - cur[0], 2 * cap[1] - cur[1]];
    result.push({ from: cur, to: next, capture: cap });
    cur = next;
  }
  return result;
}

interface PieceVisual {
  id: string;
  color: Color;
  isKing: boolean;
  x: number;
  y: number;
  lifted: boolean;
  captured: boolean;
  slideDuration: number;
}

function buildPieceVisuals(board: Board): {
  visuals: Record<string, PieceVisual>;
  posMap: Map<string, string>;
} {
  const visuals: Record<string, PieceVisual> = {};
  const posMap = new Map<string, string>();
  let ri = 0, bi = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const id = piece.color === "red" ? `r${ri++}` : `b${bi++}`;
      const { x, y } = cellXY(row, col);
      visuals[id] = { id, color: piece.color, isKing: false, x, y, lifted: false, captured: false, slideDuration: 0 };
      posMap.set(`${row},${col}`, id);
    }
  }
  return { visuals, posMap };
}

interface PlayerConfig { isAi: boolean; difficulty: Difficulty; }
interface Config { red: PlayerConfig; black: PlayerConfig; }
interface Scores { wins: number; losses: number; draws: number; }

function loadScores(): Scores {
  try {
    const c = fsStore.getFile(CK_SCORES_ID)?.content;
    if (c) return JSON.parse(c) as Scores;
  } catch { /* ignore */ }
  return { wins: 0, losses: 0, draws: 0 };
}
function saveScores(s: Scores) {
  try { fsStore.writeFile(CK_SCORES_ID, JSON.stringify(s)); } catch { /* ignore */ }
}

interface CheckersProps { onQuit?: () => void; }

export default function Checkers({ onQuit }: CheckersProps = {}) {
  const [phase, setPhase]     = useState<"dialog" | "playing" | "game-over">("dialog");
  const [config, setConfig]   = useState<Config>({ red: { isAi: false, difficulty: "easy" }, black: { isAi: true, difficulty: "easy" } });
  const [draft, setDraft]     = useState<Config>(config);
  const [speed, setSpeed]     = useState<Speed>("moderate");

  const [board, setBoard]               = useState<Board>(createBoard);
  const [currentColor, setCurrentColor] = useState<Color>("red");
  const [selected, setSelected]         = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves]     = useState<Move[]>([]);
  const [validTargets, setValidTargets] = useState<[number, number][]>([]);
  const [aiThinking, setAiThinking]     = useState(false);
  const [animating, setAnimating]       = useState(false);
  const [gameStatus, setGameStatus]     = useState("");
  const [scores, setScores]             = useState<Scores>(loadScores);
  const [pieceVisuals, setPieceVisuals] = useState<Record<string, PieceVisual>>({});

  const aiTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const boardRef      = useRef<Board>(board);
  const posMapRef     = useRef(new Map<string, string>());
  const capByRedRef   = useRef(0);
  const capByBlackRef = useRef(0);
  const speedRef      = useRef<Speed>(speed);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // ── Game-over ─────────────────────────────────────────────────────────────────
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

  // ── Execute move (updates game state, no animation) ───────────────────────────
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

  // ── Animate then execute ──────────────────────────────────────────────────────
  const animateAndExecuteMove = useCallback((move: Move, currentBoard: Board, currentCfg: Config, color: Color) => {
    const hops = decomposeHops(move);
    const slideMs = SLIDE_MS[speedRef.current];
    const hopMs = RISE_MS + slideMs + LAND_MS;

    animTimersRef.current.forEach(clearTimeout);
    const timers: ReturnType<typeof setTimeout>[] = [];
    animTimersRef.current = timers;

    setAnimating(true);
    setSelected(null);
    setLegalMoves([]);
    setValidTargets([]);

    let t = 0;
    hops.forEach((hop, i) => {
      const { from, to, capture } = hop;
      const hopStart = t;
      const isLastHop = i === hops.length - 1;

      // Rise
      timers.push(setTimeout(() => {
        const movedId = posMapRef.current.get(`${from[0]},${from[1]}`);
        if (!movedId) return;
        setPieceVisuals(prev => ({
          ...prev,
          [movedId]: { ...prev[movedId], lifted: true, slideDuration: 0 },
        }));
      }, hopStart));

      // Slide to destination; simultaneously slide captured piece to pile
      timers.push(setTimeout(() => {
        const movedId = posMapRef.current.get(`${from[0]},${from[1]}`);
        if (!movedId) return;
        const { x, y } = cellXY(to[0], to[1]);
        posMapRef.current.delete(`${from[0]},${from[1]}`);
        posMapRef.current.set(`${to[0]},${to[1]}`, movedId);

        setPieceVisuals(prev => ({
          ...prev,
          [movedId]: { ...prev[movedId], x, y, slideDuration: slideMs },
        }));

        if (capture) {
          const capId = posMapRef.current.get(`${capture[0]},${capture[1]}`);
          if (capId) {
            posMapRef.current.delete(`${capture[0]},${capture[1]}`);
            const idx = color === "red" ? capByRedRef.current++ : capByBlackRef.current++;
            const { x: px, y: py } = pileXY(color, idx);
            setPieceVisuals(prev => ({
              ...prev,
              [capId]: { ...prev[capId], x: px, y: py, slideDuration: slideMs, captured: true },
            }));
          }
        }
      }, hopStart + RISE_MS));

      // Land; crown king if this is the final hop reaching back rank
      timers.push(setTimeout(() => {
        const movedId = posMapRef.current.get(`${to[0]},${to[1]}`);
        if (!movedId) return;
        const promoted =
          isLastHop &&
          ((color === "red" && to[0] === 0) || (color === "black" && to[0] === 7));
        setPieceVisuals(prev => ({
          ...prev,
          [movedId]: {
            ...prev[movedId],
            lifted: false,
            slideDuration: 0,
            isKing: prev[movedId].isKing || promoted,
          },
        }));
      }, hopStart + RISE_MS + slideMs));

      t += hopMs;
    });

    // After all hops complete: apply move to game state
    timers.push(setTimeout(() => {
      animTimersRef.current = [];
      setAnimating(false);
      executeMove(move, currentBoard, currentCfg, color);
    }, t));
  }, [executeMove]);

  // ── Start game ────────────────────────────────────────────────────────────────
  const startGame = useCallback((cfg: Config) => {
    if (aiTimerRef.current) { clearTimeout(aiTimerRef.current); aiTimerRef.current = null; }
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];

    const newBoard = createBoard();
    const { visuals, posMap } = buildPieceVisuals(newBoard);

    setConfig(cfg);
    setBoard(newBoard);
    setCurrentColor("red");
    setSelected(null);
    setLegalMoves([]);
    setValidTargets([]);
    setAiThinking(false);
    setAnimating(false);
    setGameStatus("");
    setPieceVisuals(visuals);
    posMapRef.current = posMap;
    capByRedRef.current = 0;
    capByBlackRef.current = 0;
    setPhase("playing");
  }, []);

  const openDialog = useCallback(() => {
    if (aiTimerRef.current) { clearTimeout(aiTimerRef.current); aiTimerRef.current = null; }
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];
    setAnimating(false);
    setAiThinking(false);
    setPhase("dialog");
    setDraft(config);
  }, [config]);

  // ── AI turn ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (!config[currentColor].isAi) return;
    if (animating) return;

    setAiThinking(true);
    const delay = 400 + Math.random() * 300;
    aiTimerRef.current = setTimeout(() => {
      try {
        const b = boardRef.current;
        const mv = getAiMove(b, currentColor, config[currentColor].difficulty);
        setAiThinking(false);
        if (mv) {
          animateAndExecuteMove(mv, b, config, currentColor);
        } else {
          handleGameOver(currentColor === "red" ? "black-wins" : "red-wins", config);
        }
      } catch {
        setAiThinking(false);
      }
    }, delay);
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentColor, config, animating]);

  // ── Human clicks ──────────────────────────────────────────────────────────────
  const allCurrentMoves = useMemo(
    () => (phase === "playing" ? getLegalMoves(board, currentColor) : []),
    [phase, board, currentColor]
  );

  const handleCellClick = useCallback((row: number, col: number) => {
    if (phase !== "playing") return;
    if (config[currentColor].isAi) return;
    if (aiThinking || animating) return;

    const isTarget = validTargets.some(([r, c]: [number, number]) => r === row && c === col);
    if (isTarget && selected) {
      const move = legalMoves.find(
        (m) => m.from[0] === selected[0] && m.from[1] === selected[1]
               && m.to[0] === row && m.to[1] === col
      );
      if (move) animateAndExecuteMove(move, board, config, currentColor);
      return;
    }

    const piece = board[row][col];
    if (!piece || piece.color !== currentColor) {
      setSelected(null); setLegalMoves([]); setValidTargets([]);
      return;
    }

    const pieceMoves = allCurrentMoves.filter(m => m.from[0] === row && m.from[1] === col);
    if (pieceMoves.length === 0) {
      setSelected(null); setLegalMoves([]); setValidTargets([]);
      return;
    }
    setSelected([row, col]);
    setLegalMoves(pieceMoves);
    setValidTargets(pieceMoves.map(m => m.to));
  }, [phase, config, currentColor, aiThinking, animating, validTargets, selected, legalMoves, board, allCurrentMoves, animateAndExecuteMove]);

  // ── Menus ─────────────────────────────────────────────────────────────────────
  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "Game",
      items: [
        { label: "New Game...", onClick: openDialog },
        { separator: true },
        { label: "Snappy",    checked: speed === "snappy",    radioGroup: "speed", onClick: () => setSpeed("snappy") },
        { label: "Moderate",  checked: speed === "moderate",  radioGroup: "speed", onClick: () => setSpeed("moderate") },
        { label: "Cinematic", checked: speed === "cinematic", radioGroup: "speed", onClick: () => setSpeed("cinematic") },
        ...(onQuit ? [{ separator: true as const }, { label: "Quit", onClick: onQuit }] : []),
      ],
    },
  ], [openDialog, onQuit, speed]);

  useWindowMenus(menus);

  // ── Movable cells ─────────────────────────────────────────────────────────────
  const movableCells = useMemo(() => {
    if (phase !== "playing" || config[currentColor].isAi || animating) return new Set<string>();
    return new Set<string>(allCurrentMoves.map(m => `${m.from[0]},${m.from[1]}`));
  }, [phase, config, currentColor, allCurrentMoves, animating]);

  // Derive per-render: which piece IDs are movable / selected (reads posMapRef synchronously)
  const movableIds = new Set<string>();
  movableCells.forEach(k => {
    const id = posMapRef.current.get(k);
    if (id) movableIds.add(id);
  });
  const selectedId = selected ? (posMapRef.current.get(`${selected[0]},${selected[1]}`) ?? null) : null;

  // ── Status label ──────────────────────────────────────────────────────────────
  const statusLabel =
    phase === "playing"
      ? aiThinking
        ? `${currentColor === "red" ? "Red" : "Black"} is thinking...`
        : `${currentColor === "red" ? "Red" : "Black"}'s turn`
      : "";

  // ── Render ────────────────────────────────────────────────────────────────────
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
                          onChange={() => setDraft(d => ({ ...d, [side]: { ...d[side], isAi: false } }))}
                        />
                        Human
                      </label>
                      <label className="checkers__dialog-radio">
                        <input
                          type="radio"
                          name={`${side}-type`}
                          checked={draft[side].isAi}
                          onChange={() => setDraft(d => ({ ...d, [side]: { ...d[side], isAi: true } }))}
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
                              onChange={() => setDraft(d => ({ ...d, [side]: { ...d[side], difficulty: diff } }))}
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
                {gameStatus === "red-wins" ? "🔴 Red Wins!" : gameStatus === "black-wins" ? "⚫ Black Wins!" : "Draw!"}
              </div>
              <div className="checkers__result-sub">
                W:{scores.wins}  L:{scores.losses}  D:{scores.draws}
              </div>
              <button
                className="checkers__result-btn"
                onClick={() => { setDraft(config); setPhase("dialog"); }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        <div className="checkers__stage">
          {/* Board: cell grid for click handling, no piece rendering */}
          <div className="checkers__board-wrap">
            <div className="checkers__board">
              {board.map((rowArr, row) =>
                rowArr.map((_, col) => {
                  const isLight  = (row + col) % 2 === 0;
                  const isSel    = selected?.[0] === row && selected?.[1] === col;
                  const isTarget = validTargets.some(([r, c]: [number, number]) => r === row && c === col);

                  let cls = "checkers__cell";
                  if (isSel)         cls += " checkers__cell--selected";
                  else if (isTarget) cls += " checkers__cell--valid";
                  else if (isLight)  cls += " checkers__cell--light";
                  else               cls += " checkers__cell--dark";

                  return (
                    <div key={`${row}-${col}`} className={cls} onClick={() => handleCellClick(row, col)} />
                  );
                })
              )}
            </div>
          </div>

          {/* Pile area below board */}
          <div className="checkers__pile-area">
            <div className="checkers__pile-label">Red&apos;s captures</div>
            <div className="checkers__pile-label">Black&apos;s captures</div>
          </div>

          {/* Absolutely-positioned piece layer — sits above cells, pointer-events: none */}
          <div className="checkers__piece-layer">
            {(Object.values(pieceVisuals) as PieceVisual[]).map(pv => {
              const transition = pv.slideDuration > 0
                ? `left ${pv.slideDuration}ms ease-in-out, top ${pv.slideDuration}ms ease-in-out, transform ${RISE_MS}ms ease-out`
                : `transform ${RISE_MS}ms ease-out`;
              return (
                <div
                  key={pv.id}
                  className={[
                    "checkers__piece",
                    `checkers__piece--${pv.color}`,
                    pv.lifted          ? "checkers__piece--lifted"        : "",
                    selectedId === pv.id ? "checkers__piece--selected-piece" : "",
                    movableIds.has(pv.id) ? "checkers__piece--can-move"    : "",
                  ].filter(Boolean).join(" ")}
                  style={{ left: pv.x, top: pv.y, transition }}
                >
                  {pv.isKing && <span className="checkers__king">★</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="checkers__thinking">
        {aiThinking && "Thinking..."}
      </div>
    </div>
  );
}
