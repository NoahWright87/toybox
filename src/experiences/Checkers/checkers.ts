export type Color = "red" | "black";

export interface Piece {
  color: Color;
  isKing: boolean;
}

export type Board = (Piece | null)[][];

export interface Move {
  from: [number, number];
  to: [number, number];
  captures: [number, number][];
}

export type GameStatus = "playing" | "red-wins" | "black-wins" | "draw";

export function createBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 3) board[row][col] = { color: "black", isKing: false };
        else if (row > 4) board[row][col] = { color: "red", isKing: false };
      }
    }
  }
  return board;
}

export function applyMove(board: Board, move: Move): Board {
  const next: Board = board.map((r) => [...r]);
  const piece = next[move.from[0]][move.from[1]]!;
  next[move.from[0]][move.from[1]] = null;
  for (const [cr, cc] of move.captures) next[cr][cc] = null;
  const promoted =
    (piece.color === "red" && move.to[0] === 0) ||
    (piece.color === "black" && move.to[0] === 7);
  next[move.to[0]][move.to[1]] = { color: piece.color, isKing: piece.isKing || promoted };
  return next;
}

function getJumpsFrom(board: Board, row: number, col: number, piece: Piece): Move[] {
  const dirs: [number, number][] = [];
  if (piece.color === "red" || piece.isKing) dirs.push([-1, -1], [-1, 1]);
  if (piece.color === "black" || piece.isKing) dirs.push([1, -1], [1, 1]);

  const moves: Move[] = [];
  for (const [dr, dc] of dirs) {
    const mr = row + dr;
    const mc = col + dc;
    const tr = row + 2 * dr;
    const tc = col + 2 * dc;
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
    const mid = board[mr][mc];
    if (!mid || mid.color === piece.color) continue;
    if (board[tr][tc] !== null) continue;
    moves.push({ from: [row, col], to: [tr, tc], captures: [[mr, mc]] });
  }
  return moves;
}

function getSimpleMovesFrom(board: Board, row: number, col: number, piece: Piece): Move[] {
  const dirs: [number, number][] = [];
  if (piece.color === "red" || piece.isKing) dirs.push([-1, -1], [-1, 1]);
  if (piece.color === "black" || piece.isKing) dirs.push([1, -1], [1, 1]);

  const moves: Move[] = [];
  for (const [dr, dc] of dirs) {
    const tr = row + dr;
    const tc = col + dc;
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
    if (board[tr][tc] !== null) continue;
    moves.push({ from: [row, col], to: [tr, tc], captures: [] });
  }
  return moves;
}

// Collect all complete multi-jump chains from (pieceRow, pieceCol) in board.
// board must have the piece at (pieceRow, pieceCol).
// originalFrom tracks the starting square before any jumps for the final Move record.
function collectJumpChains(
  board: Board,
  pieceRow: number,
  pieceCol: number,
  originalFrom: [number, number],
  capturesSoFar: [number, number][],
  piece: Piece,
): Move[] {
  const moreJumps = getJumpsFrom(board, pieceRow, pieceCol, piece);
  if (moreJumps.length === 0) {
    return [{ from: originalFrom, to: [pieceRow, pieceCol], captures: capturesSoFar }];
  }

  const result: Move[] = [];
  for (const j of moreJumps) {
    // j.from === [pieceRow, pieceCol], which is present in board — safe to apply
    const afterBoard = applyMove(board, j);
    const promoted =
      (piece.color === "red" && j.to[0] === 0) ||
      (piece.color === "black" && j.to[0] === 7);
    const nextPiece: Piece = { color: piece.color, isKing: piece.isKing || promoted };
    if (promoted) {
      result.push({ from: originalFrom, to: j.to, captures: [...capturesSoFar, ...j.captures] });
    } else {
      result.push(...collectJumpChains(
        afterBoard,
        j.to[0], j.to[1],
        originalFrom,
        [...capturesSoFar, ...j.captures],
        nextPiece,
      ));
    }
  }
  return result;
}

export function getLegalMoves(board: Board, color: Color): Move[] {
  const jumps: Move[] = [];
  const simples: Move[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;

      const pieceJumps = getJumpsFrom(board, row, col, piece);
      for (const j of pieceJumps) {
        const afterBoard = applyMove(board, j);
        const promoted =
          (piece.color === "red" && j.to[0] === 0) ||
          (piece.color === "black" && j.to[0] === 7);
        const nextPiece: Piece = { color: piece.color, isKing: piece.isKing || promoted };
        if (promoted) {
          jumps.push(j);
        } else {
          jumps.push(...collectJumpChains(
            afterBoard,
            j.to[0], j.to[1],
            [row, col],
            j.captures,
            nextPiece,
          ));
        }
      }

      simples.push(...getSimpleMovesFrom(board, row, col, piece));
    }
  }
  return jumps.length > 0 ? jumps : simples;
}

export function getGameStatus(board: Board, currentColor: Color): GameStatus {
  const currentMoves = getLegalMoves(board, currentColor);
  if (currentMoves.length > 0) return "playing";

  const opponent: Color = currentColor === "red" ? "black" : "red";
  const opponentMoves = getLegalMoves(board, opponent);
  if (opponentMoves.length === 0) return "draw";
  return currentColor === "red" ? "black-wins" : "red-wins";
}

// ── AI ────────────────────────────────────────────────────────────────────────

function evaluate(board: Board): number {
  let score = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const pieceScore =
        10 +
        (piece.isKing ? 5 : 0) +
        (piece.color === "red" ? (7 - row) : row);
      if (piece.color === "red") score += pieceScore;
      else score -= pieceScore;
    }
  }
  return score;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  const color: Color = maximizing ? "red" : "black";
  const status = getGameStatus(board, color);
  if (status !== "playing") {
    if (status === "red-wins") return 1000 + depth;
    if (status === "black-wins") return -1000 - depth;
    return 0;
  }
  if (depth === 0) return evaluate(board);

  const moves = getLegalMoves(board, color);
  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const val = minimax(applyMove(board, move), depth - 1, alpha, beta, false);
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const val = minimax(applyMove(board, move), depth - 1, alpha, beta, true);
      if (val < best) best = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function getAiMove(board: Board, color: Color, difficulty: "easy" | "hard"): Move | null {
  const moves = getLegalMoves(board, color);
  if (moves.length === 0) return null;

  const depth = difficulty === "easy" ? 2 : 4;
  const maximizing = color === "red";

  const scored = moves.map((move) => ({
    move,
    score: minimax(applyMove(board, move), depth - 1, -Infinity, Infinity, !maximizing),
  }));

  scored.sort((a, b) => maximizing ? b.score - a.score : a.score - b.score);

  if (difficulty === "easy") {
    const topK = Math.min(3, scored.length);
    return scored[Math.floor(Math.random() * topK)].move;
  }
  return scored[0].move;
}
