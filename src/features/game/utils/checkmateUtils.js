import { isInCheck } from './checkUtils.js'
import { hasAnyLegalMove } from './moveUtils.js'

// Chiếu bí: the side is in check AND has no legal move that gets it out of check.
export function isCheckmate(pieces, side) {
  return isInCheck(pieces, side) && !hasAnyLegalMove(pieces, side)
}
