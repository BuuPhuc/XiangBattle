import { RED, otherTurn, findPieceAt, movePiece } from '../../game/gameLogic.js'
import { INITIAL_PIECES } from '../../game/initialPosition.js'

function parsePosition(position) {
  const [col, row] = position.split(',').map(Number)
  return { col, row }
}

// Rebuilds the same rich moveHistory shape useGame produces during live play
// (piece/from/to/captured objects plus a full `piecesAfter` board snapshot
// per move) from the flat rows gameHistoryService.js persists on the
// server — the server only stores fromPosition/toPosition/piece/
// capturedPiece/notation per move, never a full board, so every
// intermediate position here is rebuilt by replaying moves forward from the
// standard starting position, the same way useGame's own selectSquare
// builds each move as it's played live. Once built, the result is a normal
// moveHistory array — historyUtils.js's getPiecesAtIndex/getTurnAtIndex and
// MoveHistoryPanel work on it completely unchanged.
export function reconstructMoveHistory(moves) {
  let pieces = INITIAL_PIECES
  let turn = RED
  const moveHistory = []

  for (const move of moves) {
    const from = parsePosition(move.fromPosition)
    const to = parsePosition(move.toPosition)
    const piece = findPieceAt(pieces, from.col, from.row)
    if (!piece) break // corrupt/unreadable record — stop rather than crash the viewer

    const captured = findPieceAt(pieces, to.col, to.row)
    const piecesAfter = movePiece(pieces, piece.id, to.col, to.row)

    moveHistory.push({
      ply: move.moveNumber,
      turn,
      piece: { id: piece.id, type: piece.type, side: piece.side, char: piece.char },
      from,
      to,
      captured: captured ? { id: captured.id, type: captured.type, side: captured.side, char: captured.char } : null,
      piecesAfter,
      notation: move.notation,
    })

    pieces = piecesAfter
    turn = otherTurn(turn)
  }

  return moveHistory
}

export default reconstructMoveHistory
