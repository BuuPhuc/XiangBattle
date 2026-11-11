import { findPieceAt, isInBounds } from './utils/boardUtils.js'
import { isGeneralMove } from './rules/generalRules.js'
import { isAdvisorMove } from './rules/advisorRules.js'
import { isElephantMove } from './rules/elephantRules.js'
import { isHorseMove } from './rules/horseRules.js'
import { isRookMove } from './rules/rookRules.js'
import { isCannonMove } from './rules/cannonRules.js'
import { isPawnMove } from './rules/pawnRules.js'

export const RED = 'red'
export const BLACK = 'black'

// All the values `status` (from useGame) can take. Kept as one object so
// callers compare against a name instead of a raw string literal.
export const GAME_STATUS = {
  PLAYING: 'playing',
  CHECKMATE: 'checkmate',
  // The side to move has no legal move but isn't in check. Unlike chess,
  // this is a loss in Xiangqi, not a draw.
  STALEMATE: 'stalemate',
  // Repetition verdicts (utils/repetitionUtils.js) — decided by the same
  // shared rule on the server (online) and in useGame (local / vs bot).
  PERPETUAL_CHECK: 'perpetual-check', // the side giving perpetual check loses
  PERPETUAL_CHASE: 'perpetual-chase', // the side perpetually chasing loses
  REPETITION_DRAW: 'repetition-draw', // repetition with no one at fault
  TIMEOUT_MOVE: 'timeout-move',
  TIMEOUT_GAME: 'timeout-game',
  // Reported by the server, not derived locally: the opponent didn't
  // reconnect within the grace period after disconnecting mid-match. Value
  // must match server/rooms/room.js's GAME_STATUS.OPPONENT_LEFT exactly.
  OPPONENT_LEFT: 'opponent-left',
  // Also server-reported: either side conceded via MatchActions' Đầu hàng
  // button. Value must match server/rooms/room.js's GAME_STATUS.RESIGN.
  RESIGN: 'resign',
  // Also server-reported: one side offered a draw and the other accepted.
  // The one status with no winning side — value must match
  // server/rooms/room.js's GAME_STATUS.DRAW exactly.
  DRAW: 'draw',
}

export { findPieceAt }

const MOVE_RULES_BY_TYPE = {
  general: isGeneralMove,
  advisor: isAdvisorMove,
  elephant: isElephantMove,
  horse: isHorseMove,
  rook: isRookMove,
  cannon: isCannonMove,
  pawn: isPawnMove,
}

export function isOwnPiece(piece, turn) {
  return piece.side === turn
}

// Checks whether `piece` may move to (col, row) given the current board.
// Does not consider check / checkmate — only per-piece movement rules,
// blocking, and same-side capture.
export function isLegalMove(piece, toCol, toRow, pieces) {
  if (!isInBounds(toCol, toRow)) return false
  if (piece.col === toCol && piece.row === toRow) return false

  const target = findPieceAt(pieces, toCol, toRow)
  if (target && target.side === piece.side) return false

  const rule = MOVE_RULES_BY_TYPE[piece.type]
  return rule ? rule(piece, toCol, toRow, pieces) : false
}

// Moves the piece with `pieceId` to (col, row), capturing whatever occupies that
// square. Assumes the move has already been validated with isLegalMove.
export function movePiece(pieces, pieceId, col, row) {
  return pieces
    .filter((piece) => !(piece.col === col && piece.row === row && piece.id !== pieceId))
    .map((piece) => (piece.id === pieceId ? { ...piece, col, row } : piece))
}

export function otherTurn(turn) {
  return turn === RED ? BLACK : RED
}
