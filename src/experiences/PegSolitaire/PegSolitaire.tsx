import { useState, useCallback, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./PegSolitaire.css";

const ROWS = 5;
const HOLE_DIAM = 40;
const SPACING = 52;
const ROW_HEIGHT = 45;

// 6 adjacency directions for a triangular grid
const DIRECTIONS: [number, number][] = [
  [0, 1], [0, -1],
  [-1, -1], [-1, 0],
  [1, 0], [1, 1],
];

type Board = boolean[][];
type Pos = { row: number; col: number };
type Phase = "setup" | "playing" | "gameover";

function posKey(row: number, col: number) {
  return `${row},${col}`;
}

function isValid(row: number, col: number) {
  return row >= 0 && row < ROWS && col >= 0 && col <= row;
}

function makeFullBoard(): Board {
  return Array.from({ length: ROWS }, (_, r) => Array<boolean>(r + 1).fill(true));
}

function countPegs(board: Board): number {
  return board.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

function getValidJumps(board: Board, row: number, col: number): Pos[] {
  if (!board[row]?.[col]) return [];
  return DIRECTIONS.flatMap(([dr, dc]) => {
    const mr = row + dr;
    const mc = col + dc;
    const lr = row + 2 * dr;
    const lc = col + 2 * dc;
    if (isValid(mr, mc) && board[mr][mc] && isValid(lr, lc) && !board[lr][lc]) {
      return [{ row: lr, col: lc }];
    }
    return [];
  });
}

function hasAnyMoves(board: Board): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      if (board[r][c] && getValidJumps(board, r, c).length > 0) return true;
    }
  }
  return false;
}

function rating(pegs: number): string {
  if (pegs === 1) return "GENIUS!";
  if (pegs === 2) return "PURTY SMART";
  if (pegs === 3) return "JUST PLAIN DUMB";
  return "EG-NO-RA-MOOSE";
}

interface Props {
  onQuit?: () => void;
}

export default function PegSolitaire({ onQuit }: Props) {
  const [board, setBoard] = useState<Board>(makeFullBoard);
  const [phase, setPhase] = useState<Phase>("setup");
  const [selected, setSelected] = useState<Pos | null>(null);

  const pegCount = useMemo(() => countPegs(board), [board]);

  const validLandings = useMemo<Set<string>>(() => {
    if (!selected || phase !== "playing") return new Set<string>();
    return new Set<string>(
      getValidJumps(board, selected.row, selected.col).map((p) => posKey(p.row, p.col))
    );
  }, [board, selected, phase]);

  const handleHoleClick = useCallback(
    (row: number, col: number) => {
      if (phase === "setup") {
        const newBoard = board.map((r) => [...r]);
        newBoard[row][col] = false;
        setBoard(newBoard);
        setPhase("playing");
        return;
      }
      if (phase !== "playing") return;

      const hasPeg = board[row][col];
      const key = posKey(row, col);

      if (selected && validLandings.has(key)) {
        const newBoard = board.map((r) => [...r]);
        // middle peg is halfway between selected and landing
        const dr = (row - selected.row) / 2;
        const dc = (col - selected.col) / 2;
        newBoard[selected.row][selected.col] = false;
        newBoard[selected.row + dr][selected.col + dc] = false;
        newBoard[row][col] = true;
        setBoard(newBoard);
        setSelected(null);
        if (!hasAnyMoves(newBoard)) setPhase("gameover");
      } else if (hasPeg) {
        setSelected({ row, col });
      } else {
        setSelected(null);
      }
    },
    [board, phase, selected, validLandings]
  );

  const newGame = useCallback(() => {
    setBoard(makeFullBoard());
    setPhase("setup");
    setSelected(null);
  }, []);

  const menus = useMemo<MenuBarMenu[]>(() => {
    const items: MenuBarMenu["items"] = [{ label: "New Game", onClick: newGame }];
    if (onQuit) {
      items.push({ separator: true });
      items.push({ label: "Exit", onClick: onQuit });
    }
    return [{ label: "Game", items }];
  }, [newGame, onQuit]);
  useWindowMenus(menus);

  // Board layout
  const boardW = (ROWS - 1) * SPACING + HOLE_DIAM + 32;
  const boardH = (ROWS - 1) * ROW_HEIGHT + HOLE_DIAM + 32;
  const centerX = boardW / 2;

  return (
    <div className="peg-solitaire">
      <div className="peg-status">
        {phase === "setup" && <span>Click any peg to remove it and begin</span>}
        {phase === "playing" && (
          <span>
            {pegCount} peg{pegCount !== 1 ? "s" : ""} remaining
          </span>
        )}
        {phase === "gameover" && (
          <span className="peg-rating">
            {rating(pegCount)} &mdash; {pegCount} peg{pegCount !== 1 ? "s" : ""} left
          </span>
        )}
      </div>

      <div className="peg-board" style={{ width: boardW, height: boardH }}>
        {board.map((row, r) =>
          row.map((hasPeg, c) => {
            const x = centerX - (r * SPACING) / 2 + c * SPACING - HOLE_DIAM / 2;
            const y = 16 + r * ROW_HEIGHT;
            const key = posKey(r, c);
            const isSelected = selected?.row === r && selected?.col === c;
            const isLanding = validLandings.has(key);

            let cls = "peg-hole";
            if (hasPeg) cls += " peg-hole--peg";
            if (isSelected) cls += " peg-hole--selected";
            if (isLanding) cls += " peg-hole--landing";

            return (
              <div
                key={key}
                className={cls}
                style={{ left: x, top: y, width: HOLE_DIAM, height: HOLE_DIAM }}
                onClick={() => handleHoleClick(r, c)}
                role="button"
                aria-label={
                  hasPeg
                    ? `Peg at row ${r + 1}, position ${c + 1}`
                    : `Empty hole at row ${r + 1}, position ${c + 1}`
                }
              />
            );
          })
        )}
      </div>

      <div className="peg-controls">
        <button className="peg-btn" onClick={newGame}>
          New Game
        </button>
      </div>
    </div>
  );
}
