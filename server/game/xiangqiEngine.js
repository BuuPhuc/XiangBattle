// Server-side referee for online matches. The server is the authority on
// chess legality: a client only ever proposes "move the piece on `from` to
// `to`", and everything else (is it legal, what the board looks like after,
// what got captured, the notation, whether the game just ended) is derived
// here — never taken from the client.
//
// The rules themselves are NOT duplicated: they're the exact same pure
// modules the frontend plays with (src/features/game/), loaded through
// Node's require(esm). One rule engine means the server can never disagree
// with what a legitimate client already showed its player.
const { movePiece, otherTurn } = require('../../src/features/game/gameLogic.js')
const { isFullyLegalMove, hasAnyLegalMove } = require('../../src/features/game/utils/moveUtils.js')
const { isInCheck } = require('../../src/features/game/utils/checkUtils.js')
const { formatMoveNotation } = require('../../src/features/game/utils/notationUtils.js')
const { isInBounds, findPieceAt } = require('../../src/features/game/utils/boardUtils.js')
const { INITIAL_PIECES } = require('../../src/features/game/initialPosition.js')
const { judgeRepetition } = require('../../src/features/game/utils/repetitionUtils.js')

// Values match src/features/game/gameLogic.js's GAME_STATUS.
const OUTCOME = {
  CHECKMATE: 'checkmate',
  // Xiangqi has no stalemate draw: a side with no legal move loses.
  STALEMATE: 'stalemate',
}

function initialBoard() {
  return INITIAL_PIECES.map((piece) => ({ ...piece }))
}

function parseSquare(square) {
  if (!square || typeof square !== 'object') return null
  const { col, row } = square
  if (!Number.isInteger(col) || !Number.isInteger(row) || !isInBounds(col, row)) return null
  return { col, row }
}

function publicPiece(piece) {
  return { id: piece.id, type: piece.type, side: piece.side, char: piece.char }
}

// Validates `side` moving from `rawFrom` to `rawTo` on `pieces`.
// Returns { ok: false, code, message } or { ok: true, move, outcome }, where
// `move` is a complete move entry (same shape the frontend's useGame builds)
// minus ply/timestamp, and `outcome` is null or the game-ending status
// caused by this move (the mover is always the winner).
function validateMove(pieces, side, rawFrom, rawTo) {
  const from = parseSquare(rawFrom)
  const to = parseSquare(rawTo)
  if (!from || !to) {
    return { ok: false, code: 'INVALID_MOVE_PAYLOAD', message: 'Dữ liệu nước đi không hợp lệ.' }
  }

  const piece = findPieceAt(pieces, from.col, from.row)
  if (!piece || piece.side !== side) {
    return { ok: false, code: 'ILLEGAL_MOVE', message: 'Nước đi không hợp lệ.' }
  }

  if (!isFullyLegalMove(piece, to.col, to.row, pieces)) {
    return { ok: false, code: 'ILLEGAL_MOVE', message: 'Nước đi không hợp lệ.' }
  }

  const captured = findPieceAt(pieces, to.col, to.row)
  const piecesAfter = movePiece(pieces, piece.id, to.col, to.row)
  const move = {
    turn: side,
    piece: publicPiece(piece),
    from,
    to,
    captured: captured ? publicPiece(captured) : null,
    piecesAfter,
  }
  move.notation = formatMoveNotation(move)

  const opponent = otherTurn(side)
  let outcome = null
  if (!hasAnyLegalMove(piecesAfter, opponent)) {
    outcome = isInCheck(piecesAfter, opponent) ? OUTCOME.CHECKMATE : OUTCOME.STALEMATE
  }

  return { ok: true, move, outcome }
}

// Repetition (perpetual check / perpetual chase / draw by repetition), with
// the same shared rule the browser uses for local and bot games. `positions`
// is [{ pieces, side }] from the start of the match to now. null, or
// { status, loser, winner } once the current position occurs a 3rd time.
module.exports = { initialBoard, validateMove, judgeRepetition, OUTCOME }
