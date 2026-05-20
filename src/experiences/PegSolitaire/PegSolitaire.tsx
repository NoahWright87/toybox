import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./PegSolitaire.css";

// ── Layout ─────────────────────────────────────────────────────────────────────
// Board image is 1536×1024 (3:2). We display at 1/4 scale = 384×256.
// Hole positions are calibrated to the pixel-art board image.
const BOARD_W  = 384;
const BOARD_H  = 256;
const PAD_TOP  = 44;   // y of top-hole centre in display coords
const SPACING  = 57;   // horizontal gap between hole centres
const ROW_H    = 50;   // vertical gap between rows
const PEG_W    = 48;   // displayed peg width  (CSS sprite)
const PEG_H    = 52;   // displayed peg height (sprite is taller than wide)
const CLICK    = 44;   // hit-area diameter per hole

// Sprite sheet: 1254×1254, 5 cols × 5 rows → ~250×250 px per frame
const SHEET_COLS = 5;
const SHEET_ROWS = 5;
// Scale the 1254px sheet down to PEG_W*SHEET_COLS wide when displaying
const SHEET_DISPLAY_W = PEG_W * SHEET_COLS;   // 240
const SHEET_DISPLAY_H = PEG_H * SHEET_ROWS;   // 260

// ── Types ──────────────────────────────────────────────────────────────────────
const ROWS = 5;
const DIRS: [number, number][] = [[0,1],[0,-1],[-1,-1],[-1,0],[1,0],[1,1]];

type Board    = boolean[][];
type Pos      = { row: number; col: number };
type Phase    = "setup" | "playing" | "gameover";
type FramePeg = [number, number];          // [spriteCol, spriteRow]
type FrameMap = (FramePeg | null)[][];

interface JumpAnim { from: Pos; over: Pos; to: Pos }

// ── Helpers ────────────────────────────────────────────────────────────────────
function posKey(r: number, c: number) { return `${r},${c}`; }
function isValid(r: number, c: number) { return r >= 0 && r < ROWS && c >= 0 && c <= r; }

function holeCenter(row: number, col: number): { x: number; y: number } {
  return {
    x: BOARD_W / 2 - row * (SPACING / 2) + col * SPACING,
    y: PAD_TOP + row * ROW_H,
  };
}

function makeFullBoard(): Board {
  return Array.from({ length: ROWS }, (_, r) => Array<boolean>(r + 1).fill(true));
}

function makeFrameMap(): FrameMap {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: r + 1 }, () => [
      Math.floor(Math.random() * SHEET_COLS),
      Math.floor(Math.random() * SHEET_ROWS),
    ] as FramePeg)
  );
}

function countPegs(board: Board) {
  return board.reduce((s, row) => s + row.filter(Boolean).length, 0);
}

function getJumps(board: Board, row: number, col: number): Pos[] {
  if (!board[row]?.[col]) return [];
  return DIRS.flatMap(([dr, dc]) => {
    const mr = row+dr, mc = col+dc, lr = row+2*dr, lc = col+2*dc;
    return isValid(mr,mc) && board[mr][mc] && isValid(lr,lc) && !board[lr][lc]
      ? [{ row: lr, col: lc }] : [];
  });
}

function hasAnyMoves(board: Board) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= r; c++)
      if (board[r][c] && getJumps(board, r, c).length > 0) return true;
  return false;
}

function rating(n: number) {
  if (n === 1) return "GENIUS!";
  if (n === 2) return "PURTY SMART";
  if (n === 3) return "JUST PLAIN DUMB";
  return "EG-NO-RA-MOOSE";
}

// ── Component ──────────────────────────────────────────────────────────────────
interface Props { onQuit?: () => void }

export default function PegSolitaire({ onQuit }: Props) {
  const [board,    setBoard]    = useState<Board>(makeFullBoard);
  const [frames,   setFrames]   = useState<FrameMap>(makeFrameMap);
  const [phase,    setPhase]    = useState<Phase>("setup");
  const [selected, setSelected] = useState<Pos | null>(null);
  const [jump,     setJump]     = useState<JumpAnim | null>(null);

  const boardRef  = useRef(board);
  const framesRef = useRef(frames);
  useEffect(() => { boardRef.current  = board;  }, [board]);
  useEffect(() => { framesRef.current = frames; }, [frames]);

  // Ref for the flying-peg container – position is animated via direct DOM
  const flyRef = useRef<HTMLDivElement>(null);

  const pegCount = useMemo(() => countPegs(board), [board]);

  const landings = useMemo<Set<string>>(() => {
    if (!selected || phase !== "playing" || jump) return new Set<string>();
    return new Set<string>(
      getJumps(board, selected.row, selected.col).map(p => posKey(p.row, p.col))
    );
  }, [board, selected, phase, jump]);

  // ── Jump animation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jump) return;
    const dest = holeCenter(jump.to.row, jump.to.col);

    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (flyRef.current) {
          flyRef.current.style.left = `${dest.x - CLICK / 2}px`;
          flyRef.current.style.top  = `${dest.y - CLICK / 2}px`;
        }
      });
    });

    const timer = window.setTimeout(() => {
      const { from, over, to } = jump;

      const nb = boardRef.current.map(r => [...r]);
      nb[from.row][from.col] = false;
      nb[over.row][over.col] = false;
      nb[to.row][to.col]     = true;

      // Move the frame from the jumping peg to its new position
      const nf = framesRef.current.map(r => r.map(v => v ? [...v] as FramePeg : null));
      nf[to.row][to.col]     = nf[from.row][from.col];
      nf[from.row][from.col] = null;
      nf[over.row][over.col] = null;

      setBoard(nb);
      setFrames(nf);
      setJump(null);
      setSelected(null);
      if (!hasAnyMoves(nb)) setPhase("gameover");
    }, 460);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [jump]);

  // ── Clicks ───────────────────────────────────────────────────────────────────
  const handleClick = useCallback((row: number, col: number) => {
    if (jump) return;

    if (phase === "setup") {
      const nb = board.map(r => [...r]);
      nb[row][col] = false;
      const nf = frames.map(r => r.map(v => v ? [...v] as FramePeg : null));
      nf[row][col] = null;
      setBoard(nb);
      setFrames(nf);
      setPhase("playing");
      return;
    }

    if (phase !== "playing") return;

    const key = posKey(row, col);
    if (selected && landings.has(key)) {
      const over: Pos = {
        row: selected.row + (row - selected.row) / 2,
        col: selected.col + (col - selected.col) / 2,
      };
      setJump({ from: selected, over, to: { row, col } });
    } else if (board[row][col]) {
      setSelected(selected?.row === row && selected?.col === col ? null : { row, col });
    } else {
      setSelected(null);
    }
  }, [board, frames, phase, selected, landings, jump]);

  const newGame = useCallback(() => {
    setBoard(makeFullBoard());
    setFrames(makeFrameMap());
    setPhase("setup");
    setSelected(null);
    setJump(null);
  }, []);

  // ── Menus ────────────────────────────────────────────────────────────────────
  const menus = useMemo<MenuBarMenu[]>(() => {
    const items: MenuBarMenu["items"] = [{ label: "New Game", onClick: newGame }];
    if (onQuit) { items.push({ separator: true }); items.push({ label: "Exit", onClick: onQuit }); }
    return [{ label: "Game", items }];
  }, [newGame, onQuit]);
  useWindowMenus(menus);

  // ── Sprite helper ─────────────────────────────────────────────────────────────
  function pegStyle(frame: FramePeg): React.CSSProperties {
    const [sc, sr] = frame;
    return {
      width:  PEG_W,
      height: PEG_H,
      backgroundImage:    "url('/peg-solitaire/pegs.png')",
      backgroundSize:     `${SHEET_DISPLAY_W}px ${SHEET_DISPLAY_H}px`,
      backgroundPosition: `-${sc * PEG_W}px -${sr * PEG_H}px`,
      backgroundRepeat:   "no-repeat",
    };
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const fromKey = jump ? posKey(jump.from.row, jump.from.col) : "";
  const overKey = jump ? posKey(jump.over.row, jump.over.col) : "";
  const flyFrame = jump ? frames[jump.from.row][jump.from.col] : null;

  return (
    <div className="pegsol">
      <div className="pegsol__status">
        {phase === "setup"    && <span>Click any peg to remove it &amp; begin</span>}
        {phase === "playing"  && !jump && (
          <span>{pegCount} peg{pegCount !== 1 ? "s" : ""} remaining</span>
        )}
        {phase === "gameover" && (
          <span className="pegsol__rating">{rating(pegCount)} &mdash; {pegCount} left</span>
        )}
      </div>

      <div className="pegsol__board" style={{ width: BOARD_W, height: BOARD_H }}>
        {/* Board image */}
        <img
          src="/peg-solitaire/board.png"
          className="pegsol__board-img"
          alt=""
          aria-hidden
          draggable={false}
        />

        {/* Holes + pegs */}
        {board.map((row, r) =>
          row.map((hasPeg, c) => {
            const { x, y } = holeCenter(r, c);
            const key    = posKey(r, c);
            const isFrom = key === fromKey;
            const isOver = key === overKey;
            const isSel  = !jump && selected?.row === r && selected?.col === c;
            const isLand = landings.has(key);
            const frame  = frames[r][c];

            return (
              <div
                key={key}
                className="pegsol__spot"
                style={{ left: x - CLICK/2, top: y - CLICK/2, width: CLICK, height: CLICK,
                         cursor: (!jump && (hasPeg || isLand)) ? "pointer" : "default" }}
                onClick={() => handleClick(r, c)}
              >
                {/* Landing glow */}
                {isLand && <div className="pegsol__glow" />}

                {/* Peg sprite */}
                {hasPeg && !isFrom && frame && (
                  <div
                    className={[
                      "pegsol__peg",
                      isSel             ? "pegsol__peg--sel"  : "",
                      isOver && jump    ? "pegsol__peg--gone" : "",
                    ].filter(Boolean).join(" ")}
                    style={pegStyle(frame)}
                  />
                )}
              </div>
            );
          })
        )}

        {/* Flying peg */}
        {jump && flyFrame && (() => {
          const fp = holeCenter(jump.from.row, jump.from.col);
          return (
            <div
              ref={flyRef}
              className="pegsol__spot pegsol__spot--fly"
              style={{ left: fp.x - CLICK/2, top: fp.y - CLICK/2,
                       width: CLICK, height: CLICK }}
            >
              <div className="pegsol__peg pegsol__peg--fly" style={pegStyle(flyFrame)} />
            </div>
          );
        })()}
      </div>

      <div className="pegsol__controls">
        <button className="pegsol__btn" onClick={newGame}>New Game</button>
      </div>
    </div>
  );
}
