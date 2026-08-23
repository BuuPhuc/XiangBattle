// Tốt (Pawn/Soldier): one step forward before crossing the river; forward or
// sideways one step after crossing. Never sideways-before-crossing, never
// backward, never more than one step.

function hasCrossedRiver(side, row) {
  return side === 'red' ? row <= 4 : row >= 5
}

export function isPawnMove(piece, toCol, toRow) {
  const dCol = toCol - piece.col
  const dRow = toRow - piece.row
  const forwardRow = piece.side === 'red' ? -1 : 1

  // Forward one step is always allowed.
  if (dCol === 0 && dRow === forwardRow) return true

  // Sideways one step is only allowed after crossing the river.
  if (hasCrossedRiver(piece.side, piece.row) && dRow === 0 && Math.abs(dCol) === 1) return true

  return false
}

export default isPawnMove
