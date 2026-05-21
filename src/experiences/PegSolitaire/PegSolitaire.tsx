import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./PegSolitaire.css";

// ── Board image: key out near-white background ────────────────────────────────
function useKeyedImage(src: string): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lo = Math.min(d[i], d[i + 1], d[i + 2]);
        const hi = Math.max(d[i], d[i + 1], d[i + 2]);
        if (lo > 218 && hi - lo < 28) d[i + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);
      setUrl(canvas.toDataURL("image/png"));
    };
    img.src = src;
  }, [src]);
  return url;
}

// ── Hole positions (pixel-measured from the 1254×1254 board at 542px display) ─
const HOLES: readonly (readonly [number, number])[][] = [
  [[271, 139]],
  [[228, 198], [315, 199]],
  [[191, 259], [274, 258], [359, 258]],
  [[152, 319], [237, 319], [321, 319], [406, 319]],
  [[113, 378], [199, 378], [284, 378], [368, 379], [453, 379]],
] as const;

const BOARD_W = 542;
const BOARD_H = 542;
const CLICK   = 56;   // hit-area diameter per hole

// ── SVG peg constants ─────────────────────────────────────────────────────────
// viewBox "-22 -46 44 50": width=44, height=50
// y = 0  → board surface (ground); this point aligns with the hole centre.
// Position peg element: left = hole.x − 22,  top = hole.y − 46
const PEG_W        = 44;
const PEG_GROUND_Y = 46;   // pixels from SVG element top to ground (y=0 in viewBox)

const PEG_PALETTES = [
  ["#c8973a", "#f0c870", "#8a5f1c", "#b07828", "#6e3e10"] as const, // wood
  ["#cc3322", "#f05544", "#882211", "#a62919", "#6e1508"] as const, // red
  ["#2255bb", "#4480ee", "#0d2f80", "#1a3c99", "#0a1f55"] as const, // blue
  ["#28882a", "#4aaa4c", "#145514", "#1e6620", "#0d3d0e"] as const, // green
  ["#cc7a00", "#f0aa00", "#884400", "#aa5c00", "#663200"] as const, // amber
] as const;

function PegSVG({ colorIdx }: { colorIdx: number }) {
  const [cap, capLight, capDark, stem, stemDark] = PEG_PALETTES[colorIdx % 5];
  return (
    <svg viewBox="-22 -46 44 50" width={PEG_W} height={PEG_GROUND_Y + 4}
         xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      {/* Stem (y=0 → y=-27) */}
      <path d="M -5,0 L -6,-27 L 6,-27 L 5,0 Z" fill={stem} />
      <path d="M -5,0 L -6,-27 L -2.5,-27 L -2,0 Z" fill={stemDark} opacity="0.6" />
      <path d="M 3,-27 L 4,-27 L 5,0 L 4,0 Z" fill="white" opacity="0.15" />

      {/* Cap underside */}
      <ellipse cx="0" cy="-27" rx="21" ry="9" fill={capDark} />
      {/* Cap top */}
      <ellipse cx="0" cy="-31" rx="21" ry="10" fill={cap} />
      {/* Highlight */}
      <ellipse cx="-5" cy="-35" rx="9" ry="4" fill={capLight} opacity="0.50" />
      {/* Specular dot */}
      <ellipse cx="-7" cy="-37" rx="4" ry="2" fill="white" opacity="0.22" />
    </svg>
  );
}

// ── Game types ────────────────────────────────────────────────────────────────
const ROWS = 5;
const DIRS: [number, number][] = [[0,1],[0,-1],[-1,-1],[-1,0],[1,0],[1,1]];

type Board    = boolean[][];
type Pos      = { row: number; col: number };
type Phase    = "setup" | "playing" | "gameover";
type ColorMap = (number | null)[][];

interface JumpAnim { from: Pos; over: Pos; to: Pos }

// ── Helpers ───────────────────────────────────────────────────────────────────
function posKey(r: number, c: number) { return `${r},${c}`; }
function isValid(r: number, c: number) { return r >= 0 && r < ROWS && c >= 0 && c <= r; }
function holeCenter(row: number, col: number) {
  const [x, y] = HOLES[row][col];
  return { x, y };
}
function makeFullBoard(): Board {
  return Array.from({ length: ROWS }, (_, r) => Array<boolean>(r + 1).fill(true));
}
function makeColorMap(): ColorMap {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: r + 1 }, () => Math.floor(Math.random() * 5))
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

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { onQuit?: () => void }

export default function PegSolitaire({ onQuit }: Props) {
  const boardSrc = useKeyedImage("/peg-solitaire/board.png");

  const [board,   setBoard]   = useState<Board>(makeFullBoard);
  const [colors,  setColors]  = useState<ColorMap>(makeColorMap);
  const [phase,   setPhase]   = useState<Phase>("setup");
  const [selected,setSelected]= useState<Pos | null>(null);
  const [jump,    setJump]    = useState<JumpAnim | null>(null);

  const boardRef  = useRef(board);
  const colorsRef = useRef(colors);
  useEffect(() => { boardRef.current  = board;  }, [board]);
  useEffect(() => { colorsRef.current = colors; }, [colors]);

  // The flying peg's spot container is transitioned via left/top CSS transition.
  const flySpotRef = useRef<HTMLDivElement>(null);
  const pegCount   = useMemo(() => countPegs(board), [board]);

  const landings = useMemo<Set<string>>(() => {
    if (!selected || phase !== "playing" || jump) return new Set<string>();
    return new Set<string>(
      getJumps(board, selected.row, selected.col).map(p => posKey(p.row, p.col))
    );
  }, [board, selected, phase, jump]);

  // ── Jump animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jump) return;
    const dest = holeCenter(jump.to.row, jump.to.col);

    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (flySpotRef.current) {
          flySpotRef.current.style.left = `${dest.x - CLICK / 2}px`;
          flySpotRef.current.style.top  = `${dest.y - CLICK / 2}px`;
        }
      });
    });

    const timer = window.setTimeout(() => {
      const { from, over, to } = jump;
      const nb = boardRef.current.map(r => [...r]);
      nb[from.row][from.col] = false;
      nb[over.row][over.col] = false;
      nb[to.row][to.col]     = true;

      const nc = colorsRef.current.map(r => [...r]);
      nc[to.row][to.col]     = nc[from.row][from.col];
      nc[from.row][from.col] = null;
      nc[over.row][over.col] = null;

      setBoard(nb);
      setColors(nc);
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

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((row: number, col: number) => {
    if (jump) return;

    if (phase === "setup") {
      const nb = board.map(r => [...r]);
      nb[row][col] = false;
      const nc = colors.map(r => [...r]);
      nc[row][col] = null;
      setBoard(nb); setColors(nc); setPhase("playing");
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
  }, [board, colors, phase, selected, landings, jump]);

  const newGame = useCallback(() => {
    setBoard(makeFullBoard()); setColors(makeColorMap());
    setPhase("setup"); setSelected(null); setJump(null);
  }, []);

  // ── Menus ──────────────────────────────────────────────────────────────────
  const menus = useMemo<MenuBarMenu[]>(() => {
    const items: MenuBarMenu["items"] = [{ label: "New Game", onClick: newGame }];
    if (onQuit) { items.push({ separator: true }); items.push({ label: "Exit", onClick: onQuit }); }
    return [{ label: "Game", items }];
  }, [newGame, onQuit]);
  useWindowMenus(menus);

  // ── Helpers for render ─────────────────────────────────────────────────────
  const fromKey  = jump ? posKey(jump.from.row, jump.from.col) : "";
  const overKey  = jump ? posKey(jump.over.row, jump.over.col) : "";
  const flyColor = jump ? colors[jump.from.row][jump.from.col] : null;

  // Peg element position: left = hole.x − PEG_W/2, top = hole.y − PEG_GROUND_Y
  function pegPos(x: number, y: number) {
    return { left: x - PEG_W / 2, top: y - PEG_GROUND_Y };
  }

  return (
    <div className="pegsol">
      <div className="pegsol__status">
        {phase === "setup"   && <span>Click any peg to remove it &amp; begin</span>}
        {phase === "playing" && !jump && (
          <span>{pegCount} peg{pegCount !== 1 ? "s" : ""} remaining</span>
        )}
        {phase === "gameover" && (
          <span className="pegsol__rating">{rating(pegCount)} &mdash; {pegCount} left</span>
        )}
      </div>

      <div className="pegsol__board" style={{ width: BOARD_W, height: BOARD_H }}>

        {/* ── z=0: board image ─────────────────────────────────────────────── */}
        {boardSrc && (
          <img src={boardSrc} className="pegsol__board-img" alt="" aria-hidden draggable={false} />
        )}

        {/* ── z=2: cast shadows (fixed at board surface, independent of peg lift) */}
        {board.map((row, r) =>
          row.map((hasPeg, c) => {
            if (!hasPeg || posKey(r, c) === fromKey) return null;
            const { x, y } = holeCenter(r, c);
            const isSel = !jump && selected?.row === r && selected?.col === c;
            return (
              <div
                key={`sh-${r}-${c}`}
                className={`pegsol__shadow${isSel ? " pegsol__shadow--sel" : ""}`}
                style={{ left: x, top: y }}
                aria-hidden
              />
            );
          })
        )}

        {/* ── z=5: static pegs (positioned directly on board, not inside spots) */}
        {board.map((row, r) =>
          row.map((hasPeg, c) => {
            const key = posKey(r, c);
            if (!hasPeg || key === fromKey) return null;
            const { x, y } = holeCenter(r, c);
            const isOver = key === overKey;
            const isSel  = !jump && selected?.row === r && selected?.col === c;
            const colorIdx = colors[r][c];
            if (colorIdx === null) return null;

            return (
              <div
                key={`peg-${key}`}
                className={[
                  "pegsol__peg",
                  isSel          ? "pegsol__peg--sel"  : "",
                  isOver && jump ? "pegsol__peg--gone" : "",
                ].filter(Boolean).join(" ")}
                style={pegPos(x, y)}
              >
                <PegSVG colorIdx={colorIdx} />
              </div>
            );
          })
        )}

        {/* ── z=8: hole-rim overlays (on top of peg stems, below flying peg) ─ */}
        {HOLES.map((rowHoles, r) =>
          rowHoles.map(([x, y], c) => (
            <div
              key={`rim-${r}-${c}`}
              className="pegsol__hole-rim"
              style={{ left: x, top: y }}
              aria-hidden
            />
          ))
        )}

        {/* ── z=6: hit areas + glows (must be above pegs for pointer events) ─ */}
        {board.map((row, r) =>
          row.map((_hasPeg, c) => {
            const { x, y } = holeCenter(r, c);
            const key    = posKey(r, c);
            const isLand = landings.has(key);
            const hasPeg = board[r][c];
            return (
              <div
                key={`spot-${key}`}
                className="pegsol__spot"
                style={{
                  left:   x - CLICK / 2,
                  top:    y - CLICK / 2,
                  width:  CLICK,
                  height: CLICK,
                  cursor: (!jump && (hasPeg || isLand)) ? "pointer" : "default",
                }}
                onClick={() => handleClick(r, c)}
              >
                {isLand && <div className="pegsol__glow" />}
              </div>
            );
          })
        )}

        {/* ── z=20: flying peg (above hole-rim overlays) ───────────────────── */}
        {jump && flyColor !== null && (() => {
          const fp = holeCenter(jump.from.row, jump.from.col);
          return (
            <div
              ref={flySpotRef}
              className="pegsol__fly-anchor"
              style={{ left: fp.x - CLICK / 2, top: fp.y - CLICK / 2 }}
            >
              <div className="pegsol__peg pegsol__peg--fly" style={pegPos(CLICK / 2, CLICK / 2)}>
                <PegSVG colorIdx={flyColor} />
              </div>
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
