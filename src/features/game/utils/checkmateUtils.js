import { isInCheck } from './checkUtils.js'
import { hasAnyLegalMove } from './moveUtils.js'

// Chiếu bí: the side is in check AND has no legal move that gets it out of check.
export function isCheckmate(pieces, side) {
  return isInCheck(pieces, side) && !hasAnyLegalMove(pieces, side)
}

// Hết nước đi: the side is NOT in check but has no legal move at all. In
// Xiangqi (unlike chess) this is a loss for that side, not a draw.
export function isStalemate(pieces, side) {
  return !isInCheck(pieces, side) && !hasAnyLegalMove(pieces, side)
}
