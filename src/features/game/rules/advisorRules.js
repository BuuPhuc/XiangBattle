// Sĩ (Advisor): confined to the palace, one diagonal step per move.
import { isInPalace } from './generalRules.js'

export function isAdvisorMove(piece, toCol, toRow) {
  if (!isInPalace(piece.side, toCol, toRow)) return false

  const dCol = Math.abs(toCol - piece.col)
  const dRow = Math.abs(toRow - piece.row)

  return dCol === 1 && dRow === 1
}

export default isAdvisorMove
