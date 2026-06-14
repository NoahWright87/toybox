// Generates classic interlocking jigsaw piece outlines as SVG path data.
//
// Pieces are laid out on a `rows` x `cols` grid of `cellW` x `cellH` cells.
// Each interior edge gets a randomly-signed "tab" — the piece on one side
// bulges outward into a tab, and the piece on the other side curves inward
// to form the matching socket. The sign is shared between the two pieces so
// their edges interlock exactly.
//
// Every piece's path is drawn in a local box of size
// `(cellW + 2*bumpAmp) x (cellH + 2*bumpAmp)`, with the piece's own cell
// occupying the center `cellW x cellH` region. This keeps every piece the
// same SVG size regardless of which edges have tabs vs. sockets, which
// simplifies positioning.

export interface PieceShape {
  row: number;
  col: number;
  pathD: string;
}

export interface PieceLayout {
  rows: number;
  cols: number;
  cellW: number;
  cellH: number;
  bumpAmp: number;
  pieceBoxW: number;
  pieceBoxH: number;
  pieces: PieceShape[];
}

interface Pt {
  x: number;
  y: number;
}

// Deterministic PRNG so a puzzle's piece shapes can be regenerated from a
// stored seed after a reload.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draws an edge from p0 to p1. `sign` is +1 for a tab bulging outward
// (away from this piece's interior), -1 for a socket curving inward, or 0
// for a straight border edge.
function edgeSegment(p0: Pt, p1: Pt, sign: number, amp: number): string {
  if (sign === 0) return `L ${p1.x} ${p1.y}`;

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;

  // Outward perpendicular for a clockwise traversal (rotate direction -90deg).
  const px = uy * sign * amp;
  const py = -ux * sign * amp;

  const a = { x: p0.x + ux * len * 0.35, y: p0.y + uy * len * 0.35 };
  const b = { x: p0.x + ux * len * 0.65, y: p0.y + uy * len * 0.65 };
  const mid = { x: p0.x + ux * len * 0.5, y: p0.y + uy * len * 0.5 };
  const peak = { x: mid.x + px, y: mid.y + py };

  const c1 = { x: a.x + px * 0.6, y: a.y + py * 0.6 };
  const c2 = { x: peak.x - ux * len * 0.1, y: peak.y - uy * len * 0.1 };
  const c3 = { x: peak.x + ux * len * 0.1, y: peak.y + uy * len * 0.1 };
  const c4 = { x: b.x + px * 0.6, y: b.y + py * 0.6 };

  return [
    `L ${a.x} ${a.y}`,
    `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${peak.x} ${peak.y}`,
    `C ${c3.x} ${c3.y} ${c4.x} ${c4.y} ${b.x} ${b.y}`,
    `L ${p1.x} ${p1.y}`,
  ].join(" ");
}

export function generatePieceLayout(
  rows: number,
  cols: number,
  cellW: number,
  cellH: number,
  seed: number
): PieceLayout {
  const rand = mulberry32(seed);
  const bumpAmp = Math.round(Math.min(cellW, cellH) * 0.22);

  // horizontalEdges[r][c]: shared edge between piece (r,c) [above] and
  // piece (r+1,c) [below], for r in 0..rows-2.
  const horizontalEdges: number[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontalEdges.push(Array.from({ length: cols }, () => (rand() < 0.5 ? 1 : -1)));
  }

  // verticalEdges[r][c]: shared edge between piece (r,c) [left] and
  // piece (r,c+1) [right], for c in 0..cols-2.
  const verticalEdges: number[][] = [];
  for (let r = 0; r < rows; r++) {
    verticalEdges.push(Array.from({ length: cols - 1 }, () => (rand() < 0.5 ? 1 : -1)));
  }

  const pieces: PieceShape[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top    = r === 0        ? 0 : -horizontalEdges[r - 1][c];
      const bottom = r === rows - 1 ? 0 :  horizontalEdges[r][c];
      const left   = c === 0        ? 0 : -verticalEdges[r][c - 1];
      const right  = c === cols - 1 ? 0 :  verticalEdges[r][c];

      const x0 = bumpAmp;
      const y0 = bumpAmp;
      const x1 = bumpAmp + cellW;
      const y1 = bumpAmp + cellH;

      const d = [
        `M ${x0} ${y0}`,
        edgeSegment({ x: x0, y: y0 }, { x: x1, y: y0 }, top, bumpAmp),
        edgeSegment({ x: x1, y: y0 }, { x: x1, y: y1 }, right, bumpAmp),
        edgeSegment({ x: x1, y: y1 }, { x: x0, y: y1 }, bottom, bumpAmp),
        edgeSegment({ x: x0, y: y1 }, { x: x0, y: y0 }, left, bumpAmp),
        "Z",
      ].join(" ");

      pieces.push({ row: r, col: c, pathD: d });
    }
  }

  return {
    rows,
    cols,
    cellW,
    cellH,
    bumpAmp,
    pieceBoxW: cellW + bumpAmp * 2,
    pieceBoxH: cellH + bumpAmp * 2,
    pieces,
  };
}
