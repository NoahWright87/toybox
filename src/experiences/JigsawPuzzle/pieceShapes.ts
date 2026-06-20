// Generates classic interlocking jigsaw piece outlines as SVG path data.

export interface PieceShape {
  row: number;
  col: number;
  pathD: string;
  // Index into edgeProfiles for each edge (only meaningful when cutStyle < 2)
  topProfile: number;
  bottomProfile: number;
  leftProfile: number;
  rightProfile: number;
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

// ── Edge profile functions ────────────────────────────────────────────────────
// Each returns an SVG path fragment from p0 to p1.
// sign: +1 = tab (outward), -1 = socket (inward), 0 = straight border.
// amp: base bump amplitude.

// Profile 0 — standard round tab (original shape)
function profileRound(p0: Pt, p1: Pt, sign: number, amp: number): string {
  if (sign === 0) return `L ${p1.x} ${p1.y}`;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const px = uy * sign * amp, py = -ux * sign * amp;
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

// Profile 1 — narrow tab (skinny neck, wider head)
function profileNarrow(p0: Pt, p1: Pt, sign: number, amp: number): string {
  if (sign === 0) return `L ${p1.x} ${p1.y}`;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const px = uy * sign * amp * 1.1, py = -ux * sign * amp * 1.1;
  const np = 0.08; // neck offset from center (tighter than 0.15)
  const a = { x: p0.x + ux * len * (0.5 - np), y: p0.y + uy * len * (0.5 - np) };
  const b = { x: p0.x + ux * len * (0.5 + np), y: p0.y + uy * len * (0.5 + np) };
  const peak = { x: p0.x + ux * len * 0.5 + px, y: p0.y + uy * len * 0.5 + py };
  const c1 = { x: a.x + px * 0.5, y: a.y + py * 0.5 };
  const c2 = { x: peak.x - ux * len * 0.06, y: peak.y - uy * len * 0.06 };
  const c3 = { x: peak.x + ux * len * 0.06, y: peak.y + uy * len * 0.06 };
  const c4 = { x: b.x + px * 0.5, y: b.y + py * 0.5 };
  return [
    `L ${a.x} ${a.y}`,
    `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${peak.x} ${peak.y}`,
    `C ${c3.x} ${c3.y} ${c4.x} ${c4.y} ${b.x} ${b.y}`,
    `L ${p1.x} ${p1.y}`,
  ].join(" ");
}

// Profile 2 — wide flat tab (mushroom head)
function profileWide(p0: Pt, p1: Pt, sign: number, amp: number): string {
  if (sign === 0) return `L ${p1.x} ${p1.y}`;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const px = uy * sign * amp * 0.9, py = -ux * sign * amp * 0.9;
  const a = { x: p0.x + ux * len * 0.2, y: p0.y + uy * len * 0.2 };
  const b = { x: p0.x + ux * len * 0.8, y: p0.y + uy * len * 0.8 };
  const topL = { x: p0.x + ux * len * 0.22 + px, y: p0.y + uy * len * 0.22 + py };
  const topR = { x: p0.x + ux * len * 0.78 + px, y: p0.y + uy * len * 0.78 + py };
  return [
    `L ${a.x} ${a.y}`,
    `C ${a.x + px * 0.8} ${a.y + py * 0.8} ${topL.x - ux * len * 0.02} ${topL.y - uy * len * 0.02} ${topL.x} ${topL.y}`,
    `L ${topR.x} ${topR.y}`,
    `C ${topR.x + ux * len * 0.02} ${topR.y + uy * len * 0.02} ${b.x + px * 0.8} ${b.y + py * 0.8} ${b.x} ${b.y}`,
    `L ${p1.x} ${p1.y}`,
  ].join(" ");
}

// Profile 3 — double bump (two small humps side by side)
function profileDoubleBump(p0: Pt, p1: Pt, sign: number, amp: number): string {
  if (sign === 0) return `L ${p1.x} ${p1.y}`;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const ha = amp * 0.65;
  const px = uy * sign * ha, py = -ux * sign * ha;
  const q = (t: number) => ({ x: p0.x + ux * len * t, y: p0.y + uy * len * t });
  const bump = (qA: Pt, peak: Pt, qB: Pt) => {
    const cx = px * 0.9, cy = py * 0.9;
    return [
      `L ${qA.x} ${qA.y}`,
      `C ${qA.x + cx} ${qA.y + cy} ${peak.x - ux * 0.05 * len} ${peak.y - uy * 0.05 * len} ${peak.x} ${peak.y}`,
      `C ${peak.x + ux * 0.05 * len} ${peak.y + uy * 0.05 * len} ${qB.x + cx} ${qB.y + cy} ${qB.x} ${qB.y}`,
    ].join(" ");
  };
  const p1q = q(0.18), p1peak = { x: q(0.28).x + px, y: q(0.28).y + py }, p1r = q(0.44);
  const p2q = q(0.56), p2peak = { x: q(0.72).x + px, y: q(0.72).y + py }, p2r = q(0.82);
  return [
    bump(p1q, p1peak, p1r),
    `L ${p2q.x} ${p2q.y}`,
    bump(p2q, p2peak, p2r),
    `L ${p1.x} ${p1.y}`,
  ].join(" ");
}

// Profile 4 — flat wedge / trapezoid (triangular flat-top tab)
function profileWedge(p0: Pt, p1: Pt, sign: number, amp: number): string {
  if (sign === 0) return `L ${p1.x} ${p1.y}`;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const px = uy * sign * amp * 0.85, py = -ux * sign * amp * 0.85;
  const a = { x: p0.x + ux * len * 0.3, y: p0.y + uy * len * 0.3 };
  const b = { x: p0.x + ux * len * 0.7, y: p0.y + uy * len * 0.7 };
  const topA = { x: a.x + px, y: a.y + py };
  const topB = { x: b.x + px, y: b.y + py };
  return [
    `L ${a.x} ${a.y}`,
    `L ${topA.x} ${topA.y}`,
    `L ${topB.x} ${topB.y}`,
    `L ${b.x} ${b.y}`,
    `L ${p1.x} ${p1.y}`,
  ].join(" ");
}

type EdgeProfileFn = (p0: Pt, p1: Pt, sign: number, amp: number) => string;
const EDGE_PROFILES: EdgeProfileFn[] = [
  profileRound,
  profileNarrow,
  profileWide,
  profileDoubleBump,
  profileWedge,
];
const NUM_PROFILES = EDGE_PROFILES.length;

// ── Layout generator ──────────────────────────────────────────────────────────

export function generatePieceLayout(
  rows: number,
  cols: number,
  cellW: number,
  cellH: number,
  seed: number,
  cutStyle: 0 | 1 | 2 = 2
): PieceLayout {
  const rand = mulberry32(seed);
  const bumpAmp = Math.round(Math.min(cellW, cellH) * 0.22);

  // Assign tab/socket signs for each interior edge
  const horizontalEdges: number[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontalEdges.push(Array.from({ length: cols }, () => (rand() < 0.5 ? 1 : -1)));
  }
  const verticalEdges: number[][] = [];
  for (let r = 0; r < rows; r++) {
    verticalEdges.push(Array.from({ length: cols - 1 }, () => (rand() < 0.5 ? 1 : -1)));
  }

  // For cutStyle 0: assign a random profile index per interior edge slot
  // For cutStyle 1: vary amplitude but use profileRound for all
  // For cutStyle 2: uniform profileRound, uniform amplitude
  const hProfiles: number[][] = [];
  const vProfiles: number[][] = [];
  if (cutStyle === 0) {
    for (let r = 0; r < rows - 1; r++) {
      hProfiles.push(Array.from({ length: cols }, () => Math.floor(rand() * NUM_PROFILES)));
    }
    for (let r = 0; r < rows; r++) {
      vProfiles.push(Array.from({ length: cols - 1 }, () => Math.floor(rand() * NUM_PROFILES)));
    }
  }

  // For cutStyle 1: per-edge amplitude multipliers (0.65 – 1.35)
  const hAmps: number[][] = [];
  const vAmps: number[][] = [];
  if (cutStyle === 1) {
    for (let r = 0; r < rows - 1; r++) {
      hAmps.push(Array.from({ length: cols }, () => 0.65 + rand() * 0.7));
    }
    for (let r = 0; r < rows; r++) {
      vAmps.push(Array.from({ length: cols - 1 }, () => 0.65 + rand() * 0.7));
    }
  }

  const pieces: PieceShape[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const topSign    = r === 0        ? 0 : -horizontalEdges[r - 1][c];
      const bottomSign = r === rows - 1 ? 0 :  horizontalEdges[r][c];
      const leftSign   = c === 0        ? 0 : -verticalEdges[r][c - 1];
      const rightSign  = c === cols - 1 ? 0 :  verticalEdges[r][c];

      const topProfile    = r === 0        ? 0 : (cutStyle === 0 ? hProfiles[r - 1][c] : 0);
      const bottomProfile = r === rows - 1 ? 0 : (cutStyle === 0 ? hProfiles[r][c]     : 0);
      const leftProfile   = c === 0        ? 0 : (cutStyle === 0 ? vProfiles[r][c - 1] : 0);
      const rightProfile  = c === cols - 1 ? 0 : (cutStyle === 0 ? vProfiles[r][c]     : 0);

      const topAmp    = cutStyle === 1 && r > 0        ? bumpAmp * hAmps[r - 1][c] : bumpAmp;
      const bottomAmp = cutStyle === 1 && r < rows - 1 ? bumpAmp * hAmps[r][c]     : bumpAmp;
      const leftAmp   = cutStyle === 1 && c > 0        ? bumpAmp * vAmps[r][c - 1] : bumpAmp;
      const rightAmp  = cutStyle === 1 && c < cols - 1 ? bumpAmp * vAmps[r][c]     : bumpAmp;

      const pfTop    = EDGE_PROFILES[topProfile];
      const pfBottom = EDGE_PROFILES[bottomProfile];
      const pfLeft   = EDGE_PROFILES[leftProfile];
      const pfRight  = EDGE_PROFILES[rightProfile];

      const x0 = bumpAmp, y0 = bumpAmp;
      const x1 = bumpAmp + cellW, y1 = bumpAmp + cellH;

      const d = [
        `M ${x0} ${y0}`,
        pfTop(   { x: x0, y: y0 }, { x: x1, y: y0 }, topSign,    topAmp),
        pfRight( { x: x1, y: y0 }, { x: x1, y: y1 }, rightSign,  rightAmp),
        pfBottom({ x: x1, y: y1 }, { x: x0, y: y1 }, bottomSign, bottomAmp),
        pfLeft(  { x: x0, y: y1 }, { x: x0, y: y0 }, leftSign,   leftAmp),
        "Z",
      ].join(" ");

      pieces.push({ row: r, col: c, pathD: d, topProfile, bottomProfile, leftProfile, rightProfile });
    }
  }

  return {
    rows, cols, cellW, cellH, bumpAmp,
    pieceBoxW: cellW + bumpAmp * 2,
    pieceBoxH: cellH + bumpAmp * 2,
    pieces,
  };
}
