// Converts a move record into traditional Xiangqi notation (e.g. "P2-5",
// "M2.3", "X1/1"): piece letter + starting file (counted 1-9 from that
// side's own edge) + direction + target.
//   "." = tiến (advance, toward the opponent)
//   "/" = thoái (retreat, back toward own side)
//   "-" = bình (sideways, same rank) — target is the destination file
// For a straight vertical move (rook, cannon, pawn, general) the target
// after "." / "/" is the distance moved. For a diagonal/L-shaped move
// (horse, elephant, advisor) it's the destination file, since the file
// always changes and a plain distance wouldn't identify the square.
const PIECE_LETTERS = {
  general: 'Tg',
  advisor: 'S',
  elephant: 'T',
  horse: 'M',
  rook: 'X',
  cannon: 'P',
  pawn: 'B',
}

export function fileForSide(side, col) {
  return side === 'black' ? col + 1 : 9 - col
}

function isForward(side, fromRow, toRow) {
  return side === 'red' ? toRow < fromRow : toRow > fromRow
}

export function formatMoveNotation({ piece, from, to }) {
  const letter = PIECE_LETTERS[piece.type] ?? '?'
  const startFile = fileForSide(piece.side, from.col)

  const sameCol = from.col === to.col
  const sameRow = from.row === to.row

  if (sameRow && !sameCol) {
    const endFile = fileForSide(piece.side, to.col)
    return `${letter}${startFile}-${endFile}`
  }

  const symbol = isForward(piece.side, from.row, to.row) ? '.' : '/'

  if (sameCol) {
    const distance = Math.abs(to.row - from.row)
    return `${letter}${startFile}${symbol}${distance}`
  }

  const endFile = fileForSide(piece.side, to.col)
  return `${letter}${startFile}${symbol}${endFile}`
}

export default formatMoveNotation
