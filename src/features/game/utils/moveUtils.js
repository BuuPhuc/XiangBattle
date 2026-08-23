// Full move legality: a per-piece shape/blocking rule (isLegalMove) is not
// enough on its own — a move that leaves your own general in check (or that
// exposes it via the flying-general rule) must also be rejected. This file
// is where "shape-legal" becomes "actually legal to play".
import { BOARD_COLS, BOARD_ROWS } from './boardUtils.js'
import { isLegalMove, movePiece } from '../gameLogic.js'
import { isInCheck } from './checkUtils.js'

export function isFullyLegalMove(piece, toCol, toRow, pieces) {
  if (!isLegalMove(piece, toCol, toRow, pieces)) return false

  const afterMove = movePiece(pieces, piece.id, toCol, toRow)
  return !isInCheck(afterMove, piece.side)
}

export function getLegalMovesForPiece(piece, pieces) {
  const moves = []
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (isFullyLegalMove(piece, col, row, pieces)) moves.push({ col, row })
    }
  }
  return moves
}

export function getAllLegalMoves(pieces, side) {
  return pieces
    .filter((piece) => piece.side === side)
    .flatMap((piece) => getLegalMovesForPiece(piece, pieces).map((move) => ({ pieceId: piece.id, ...move })))
}

export function hasAnyLegalMove(pieces, side) {
  return pieces.filter((piece) => piece.side === side).some((piece) => getLegalMovesForPiece(piece, pieces).length > 0)
}
