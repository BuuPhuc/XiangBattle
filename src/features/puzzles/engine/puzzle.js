// A puzzle's data → the board's piece shape (stable ids + display chars),
// the same shape the game, the rules and the solver use.
import { PIECE_CHARS } from '../../academy/constants.js'

export function buildPuzzlePieces(puzzle) {
  return puzzle.pieces.map((piece, index) => ({
    ...piece,
    id: `${piece.side}-${piece.type}-${index}`,
    char: PIECE_CHARS[piece.side][piece.type],
  }))
}

export const SIDE_LABEL = { red: 'Đỏ', black: 'Đen' }
