// Xe (Rook/Chariot): any distance horizontally or vertically, cannot jump over
// other pieces.
import { countBlockersBetween } from '../utils/boardUtils.js'

export function isRookMove(piece, toCol, toRow, pieces) {
  const sameCol = piece.col === toCol
  const sameRow = piece.row === toRow
  if (!sameCol && !sameRow) return false

  return countBlockersBetween(pieces, piece.col, piece.row, toCol, toRow) === 0
}

export default isRookMove
