// Detects whether a general is under attack ("Chiếu"). Reuses the same
// per-piece movement rules as normal moves (via isLegalMove) to answer "can
// this piece capture on the general's square" — that IS the definition of
// attacking it, for every piece type (rook, cannon, horse, pawn, general...).
// The only attack that isn't a normal movement pattern is the "flying
// general" face-off, handled separately here.
import { countBlockersBetween } from './boardUtils.js'
import { isLegalMove } from '../gameLogic.js'

export function findGeneral(pieces, side) {
  return pieces.find((piece) => piece.type === 'general' && piece.side === side) ?? null
}

// True if `bySide` has any piece that could legally move onto (col, row) —
// i.e. anything sitting on that square would be under attack.
export function isSquareAttacked(pieces, col, row, bySide) {
  return pieces.filter((piece) => piece.side === bySide).some((piece) => isLegalMove(piece, col, row, pieces))
}

// The two generals may never face each other on an open file (no piece
// between them on that column) — if they do, each is effectively "attacking"
// the other directly.
export function generalsFacingEachOther(pieces) {
  const red = findGeneral(pieces, 'red')
  const black = findGeneral(pieces, 'black')
  if (!red || !black || red.col !== black.col) return false

  return countBlockersBetween(pieces, red.col, red.row, black.col, black.row) === 0
}

export function isInCheck(pieces, side) {
  const general = findGeneral(pieces, side)
  if (!general) return false

  const otherSide = side === 'red' ? 'black' : 'red'
  if (isSquareAttacked(pieces, general.col, general.row, otherSide)) return true

  return generalsFacingEachOther(pieces)
}
