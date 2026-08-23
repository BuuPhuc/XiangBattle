// Shared, dependency-free board helpers used by both gameLogic.js and every
// file under rules/. Kept separate from gameLogic.js to avoid a circular
// import (gameLogic dispatches into rules/*, and rules/* need these helpers).

export const BOARD_COLS = 9
export const BOARD_ROWS = 10

export function isInBounds(col, row) {
  return col >= 0 && col < BOARD_COLS && row >= 0 && row < BOARD_ROWS
}

export function findPieceAt(pieces, col, row) {
  return pieces.find((piece) => piece.col === col && piece.row === row) ?? null
}

// Counts pieces strictly between two points on the same row or column.
// Callers must already know (fromCol, fromRow) and (toCol, toRow) share a
// row or a column — points off that line are treated as having no blockers.
export function countBlockersBetween(pieces, fromCol, fromRow, toCol, toRow) {
  let count = 0

  if (fromCol === toCol && fromRow !== toRow) {
    const step = toRow > fromRow ? 1 : -1
    for (let row = fromRow + step; row !== toRow; row += step) {
      if (findPieceAt(pieces, fromCol, row)) count++
    }
  } else if (fromRow === toRow && fromCol !== toCol) {
    const step = toCol > fromCol ? 1 : -1
    for (let col = fromCol + step; col !== toCol; col += step) {
      if (findPieceAt(pieces, col, fromRow)) count++
    }
  }

  return count
}
