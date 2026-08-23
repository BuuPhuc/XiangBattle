// Tượng (Elephant): exactly 2 squares diagonally, cannot cross the river, and
// blocked if the midpoint ("elephant eye") is occupied.
import { findPieceAt } from '../utils/boardUtils.js'

export function isElephantMove(piece, toCol, toRow, pieces) {
  const dCol = toCol - piece.col
  const dRow = toRow - piece.row

  if (Math.abs(dCol) !== 2 || Math.abs(dRow) !== 2) return false

  const staysOnOwnSide = piece.side === 'red' ? toRow >= 5 : toRow <= 4
  if (!staysOnOwnSide) return false

  const eyeCol = piece.col + dCol / 2
  const eyeRow = piece.row + dRow / 2
  return !findPieceAt(pieces, eyeCol, eyeRow)
}

export default isElephantMove
