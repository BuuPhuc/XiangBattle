// Static evaluation: how good a position looks for `side`, in centipawn-ish
// units (a pawn ≈ 100). Material plus a small bonus/penalty for where each
// piece stands (piece-square tables). Deliberately simple and cheap — it
// runs at every leaf of the search — and easy to improve later without
// touching anything else.
const PIECE_VALUE = {
  general: 0, // never actually captured: losing it is checkmate, scored by the search
  rook: 900,
  cannon: 450,
  horse: 400,
  elephant: 200,
  advisor: 200,
  pawn: 100,
}

// Tables are written from RED's point of view: row 0 is black's back rank,
// row 9 is red's. A black piece reads them mirrored (row → 9 - row). Every
// table is left/right symmetric, so columns never need mirroring.
const PAWN = [
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [20, 30, 50, 65, 70, 65, 50, 30, 20],
  [20, 30, 45, 55, 55, 55, 45, 30, 20],
  [20, 27, 30, 40, 42, 40, 30, 27, 20],
  [10, 18, 22, 35, 40, 35, 22, 18, 10], // just crossed the river
  [3, 0, 4, 0, 7, 0, 4, 0, 3],
  [-2, 0, -2, 0, 6, 0, -2, 0, -2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
]

const HORSE = [
  [4, 8, 16, 12, 4, 12, 16, 8, 4],
  [4, 10, 28, 16, 8, 16, 28, 10, 4],
  [12, 14, 16, 20, 18, 20, 16, 14, 12],
  [8, 24, 18, 24, 20, 24, 18, 24, 8],
  [6, 16, 14, 18, 16, 18, 14, 16, 6],
  [4, 12, 16, 14, 12, 14, 16, 12, 4],
  [2, 6, 8, 6, 10, 6, 8, 6, 2],
  [4, 2, 8, 8, 4, 8, 8, 2, 4],
  [0, 2, 4, 4, -2, 4, 4, 2, 0],
  [0, -4, 0, 0, 0, 0, 0, -4, 0],
]

const ROOK = [
  [14, 14, 12, 18, 16, 18, 12, 14, 14],
  [16, 20, 18, 24, 26, 24, 18, 20, 16],
  [12, 12, 12, 18, 18, 18, 12, 12, 12],
  [12, 18, 16, 22, 22, 22, 16, 18, 12],
  [12, 14, 12, 18, 18, 18, 12, 14, 12],
  [12, 16, 14, 20, 20, 20, 14, 16, 12],
  [6, 10, 8, 14, 14, 14, 8, 10, 6],
  [4, 8, 6, 14, 12, 14, 6, 8, 4],
  [8, 4, 8, 16, 8, 16, 8, 4, 8],
  [-2, 10, 6, 14, 12, 14, 6, 10, -2],
]

const CANNON = [
  [6, 4, 0, -10, -12, -10, 0, 4, 6],
  [2, 2, 0, -4, -14, -4, 0, 2, 2],
  [2, 2, 0, -10, -8, -10, 0, 2, 2],
  [0, 0, -2, 4, 10, 4, -2, 0, 0],
  [0, 0, 0, 2, 8, 2, 0, 0, 0],
  [-2, 0, 4, 2, 6, 2, 4, 0, -2],
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [4, 0, 8, 6, 10, 6, 8, 0, 4],
  [0, 2, 4, 6, 6, 6, 4, 2, 0],
  [0, 0, 2, 6, 6, 6, 2, 0, 0],
]

// Palace pieces: prefer the natural defensive squares; the general prefers
// to stay on its back rank, centred.
const ZERO_ROW = [0, 0, 0, 0, 0, 0, 0, 0, 0]
const ADVISOR = [...Array(7).fill(ZERO_ROW), [0, 0, 0, 0, 3, 0, 0, 0, 0], ZERO_ROW, ZERO_ROW]
const ELEPHANT = [
  ...Array(5).fill(ZERO_ROW),
  [0, 0, -2, 0, 0, 0, -2, 0, 0],
  ZERO_ROW,
  [-2, 0, 0, 0, 3, 0, 0, 0, -2],
  ZERO_ROW,
  ZERO_ROW,
]
const GENERAL = [
  ...Array(7).fill(ZERO_ROW),
  [0, 0, 0, -9, -9, -9, 0, 0, 0],
  [0, 0, 0, -8, -8, -8, 0, 0, 0],
  [0, 0, 0, 1, 5, 1, 0, 0, 0],
]

const TABLE = {
  pawn: PAWN,
  horse: HORSE,
  rook: ROOK,
  cannon: CANNON,
  advisor: ADVISOR,
  elephant: ELEPHANT,
  general: GENERAL,
}

export function pieceValue(type) {
  return PIECE_VALUE[type] ?? 0
}

// One piece's worth (material + placement), always positive.
export function pieceScore(piece) {
  const row = piece.side === 'red' ? piece.row : 9 - piece.row
  return PIECE_VALUE[piece.type] + TABLE[piece.type][row][piece.col]
}

// Positive = good for `side`.
export function evaluate(pieces, side) {
  let score = 0
  for (const piece of pieces) {
    score += piece.side === side ? pieceScore(piece) : -pieceScore(piece)
  }
  return score
}
