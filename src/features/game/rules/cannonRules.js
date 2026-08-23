// Pháo (Cannon): moves like a Rook when the destination is empty. To capture,
// exactly one piece (the "screen") must sit between the cannon and the target.
import { countBlockersBetween, findPieceAt } from '../utils/boardUtils.js'

export function isCannonMove(piece, toCol, toRow, pieces) {
  const sameCol = piece.col === toCol
  const sameRow = piece.row === toRow
  if (!sameCol && !sameRow) return false

  const blockers = countBlockersBetween(pieces, piece.col, piece.row, toCol, toRow)
  const target = findPieceAt(pieces, toCol, toRow)

  return target ? blockers === 1 : blockers === 0
}

export default isCannonMove
