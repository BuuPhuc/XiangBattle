// Mã (Horse): moves in an L-shape (2+1), blocked if the orthogonal "leg" square
// right next to it (in the direction of the 2-step leg) is occupied.
import { findPieceAt } from '../utils/boardUtils.js'

export function isHorseMove(piece, toCol, toRow, pieces) {
  const dCol = toCol - piece.col
  const dRow = toRow - piece.row
  const absCol = Math.abs(dCol)
  const absRow = Math.abs(dRow)

  const isLShape = (absCol === 2 && absRow === 1) || (absCol === 1 && absRow === 2)
  if (!isLShape) return false

  const legCol = absCol === 2 ? piece.col + dCol / 2 : piece.col
  const legRow = absRow === 2 ? piece.row + dRow / 2 : piece.row

  return !findPieceAt(pieces, legCol, legRow)
}

export default isHorseMove
