// Tướng (General): confined to the 3x3 palace, one orthogonal step per move.
// The "flying general" (two generals facing each other on an open file) rule
// belongs to check detection, handled separately — not here.

const PALACE_COLS = [3, 4, 5]
const PALACE_ROWS = { black: [0, 1, 2], red: [7, 8, 9] }

export function isInPalace(side, col, row) {
  return PALACE_COLS.includes(col) && PALACE_ROWS[side].includes(row)
}

export function isGeneralMove(piece, toCol, toRow) {
  if (!isInPalace(piece.side, toCol, toRow)) return false

  const dCol = Math.abs(toCol - piece.col)
  const dRow = Math.abs(toRow - piece.row)

  // Exactly one step, orthogonally (never diagonal).
  return dCol + dRow === 1
}

export default isGeneralMove
