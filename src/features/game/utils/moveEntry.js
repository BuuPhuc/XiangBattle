// Builds one moveHistory entry — the single shape every move takes, whoever
// played it (a click in useGame, or the bot via useAiOpponent): moving
// piece, from/to, captured piece, the board after, and its notation.
// Pure: `pieces` is never modified (movePiece returns a new array).
// Assumes the move was already validated with isFullyLegalMove.
import { findPieceAt, movePiece } from '../gameLogic.js'
import { formatMoveNotation } from './notationUtils.js'

const brief = (piece) => ({ id: piece.id, type: piece.type, side: piece.side, char: piece.char })

export function createMoveEntry(pieces, piece, col, row, ply) {
  const captured = findPieceAt(pieces, col, row)
  const move = {
    ply,
    turn: piece.side,
    piece: brief(piece),
    from: { col: piece.col, row: piece.row },
    to: { col, row },
    captured: captured ? brief(captured) : null,
    piecesAfter: movePiece(pieces, piece.id, col, row),
  }
  move.notation = formatMoveNotation(move)
  return move
}
