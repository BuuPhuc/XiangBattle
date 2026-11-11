// Legal move generation for the bot, built ON the existing rules — never a
// second rule set. Legality is decided entirely by moveUtils.js's
// isFullyLegalMove (shape, blocking, cannon screens, palace, river, flying
// general, not leaving your own general in check) — the exact function the
// player's moves and the server referee go through.
//
// The only thing this adds is speed: getAllLegalMoves tries all 90 squares
// for every piece, which is fine for one click but too slow for a search
// that generates moves thousands of times per turn. Here each piece only
// tries the squares its movement shape could possibly reach (a strict
// superset of its legal moves), then the existing rule filters them. The
// result is identical to getAllLegalMoves (verified by perft and a
// cross-check over thousands of random positions), just faster.
//
// Pure: never mutates `pieces`; callers get plain moves and apply them with
// gameLogic.js's (immutable) movePiece.
import { isInBounds } from '../../game/utils/boardUtils.js'
import { isFullyLegalMove } from '../../game/utils/moveUtils.js'
import { isLegalMove } from '../../game/gameLogic.js'

const ORTHOGONAL = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const DIAGONAL_1 = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
const DIAGONAL_2 = DIAGONAL_1.map(([c, r]) => [c * 2, r * 2])
const HORSE = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]

function candidateSquares(piece) {
  const { col, row } = piece
  const out = []
  const push = (c, r) => {
    if (isInBounds(c, r)) out.push([c, r])
  }

  switch (piece.type) {
    case 'rook':
    case 'cannon':
      for (let c = 0; c < 9; c++) if (c !== col) out.push([c, row])
      for (let r = 0; r < 10; r++) if (r !== row) out.push([col, r])
      return out
    case 'horse':
      HORSE.forEach(([dc, dr]) => push(col + dc, row + dr))
      return out
    case 'elephant':
      DIAGONAL_2.forEach(([dc, dr]) => push(col + dc, row + dr))
      return out
    case 'advisor':
      DIAGONAL_1.forEach(([dc, dr]) => push(col + dc, row + dr))
      return out
    case 'general':
    case 'pawn':
      ORTHOGONAL.forEach(([dc, dr]) => push(col + dc, row + dr))
      return out
    default:
      return out
  }
}

// Moves that obey each piece's movement rule (gameLogic.js's isLegalMove:
// shape, blocking, cannon screen, palace, river, no own-piece capture) but
// may still leave the mover's own general in check. isFullyLegalMove is
// exactly "isLegalMove AND not in check afterwards"; the search applies the
// second half itself, only to moves it actually explores (alpha-beta prunes
// many before that), which is where most of the speed comes from. Shape:
// { pieceId, col, row, piece, captured } — `captured` is the piece on the
// target square or null. With `capturesOnly`, just captures (quiescence).
export function generatePseudoLegalMoves(pieces, side, { capturesOnly = false } = {}) {
  const occupant = new Map()
  for (const piece of pieces) occupant.set(piece.col * 10 + piece.row, piece)

  const moves = []
  for (const piece of pieces) {
    if (piece.side !== side) continue
    for (const [col, row] of candidateSquares(piece)) {
      const target = occupant.get(col * 10 + row) ?? null
      if (target && target.side === side) continue
      if (capturesOnly && !target) continue
      if (isLegalMove(piece, col, row, pieces)) {
        moves.push({ pieceId: piece.id, col, row, piece, captured: target })
      }
    }
  }
  return moves
}

// Every fully legal move for `side` — identical set to moveUtils.js's
// getAllLegalMoves.
export function generateLegalMoves(pieces, side, options) {
  return generatePseudoLegalMoves(pieces, side, options).filter((m) => isFullyLegalMove(m.piece, m.col, m.row, pieces))
}
