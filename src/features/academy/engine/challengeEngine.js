// The Academy's challenge engine: turns one challenge's data into a board
// position and judges a move against it. Pure functions only — no React, no
// browser APIs — because the server imports this same file to re-check a
// solution before saving progress (see server/services/academyService.js).
//
// Movement rules are NOT re-implemented here. "Can this piece go there" is
// always answered by the game's own isFullyLegalMove (per-piece rules,
// blocking, check and the flying-general rule); the engine only adds the
// lesson's goal on top: of all the legal moves, which one the challenge is
// asking for.
import { movePiece } from '../../game/gameLogic.js'
import { isInBounds, findPieceAt } from '../../game/utils/boardUtils.js'
import { isFullyLegalMove, getLegalMovesForPiece } from '../../game/utils/moveUtils.js'
import { DEFAULT_MESSAGES, PIECE_CHARS, PLAYER_SIDE } from '../constants.js'

export const MOVE_RESULT = {
  CORRECT: 'correct',
  // A legal move, just not the one the challenge asks for.
  WRONG: 'wrong',
  // Not a move this piece can make at all.
  ILLEGAL: 'illegal',
}

function sameSquare(square, col, row) {
  return square[0] === col && square[1] === row
}

// The challenge's starting position in the shape the board and the rules
// expect: every piece gets a stable id and its display character.
export function buildPieces(challenge) {
  return challenge.pieces.map((piece, index) => ({
    ...piece,
    id: `${piece.side}-${piece.type}-${index}`,
    char: PIECE_CHARS[piece.side][piece.type],
  }))
}

export function getPlayerSide(challenge) {
  return challenge.playerSide ?? PLAYER_SIDE
}

// The move a hint points at for this step: the first accepted move that
// starts from where one of the player's pieces actually stands (an earlier
// step may have been solved by a different accepted route).
export function getHintMove(challenge, stepIndex, pieces) {
  const step = challenge.steps[stepIndex]
  if (!step) return null
  const playerSide = getPlayerSide(challenge)
  return (
    step.accept.find((candidate) => findPieceAt(pieces, candidate.from[0], candidate.from[1])?.side === playerSide) ??
    null
  )
}

// Legal-move dots for the selected piece, in the `{ col, row, capture }`
// shape ChessBoard already draws.
export function getMoveMarkers(piece, pieces) {
  return getLegalMovesForPiece(piece, pieces).map((square) => ({
    ...square,
    capture: Boolean(findPieceAt(pieces, square.col, square.row)),
  }))
}

// Judges moving `piece` to (toCol, toRow) at step `stepIndex`. A correct move
// comes back with the position after it; anything else leaves the position
// untouched and carries the message to show.
export function evaluateMove(challenge, stepIndex, pieces, piece, toCol, toRow) {
  const step = challenge.steps[stepIndex]
  const mistake = step.mistakes?.find((entry) => sameSquare(entry.to, toCol, toRow))

  if (!isFullyLegalMove(piece, toCol, toRow, pieces)) {
    return { result: MOVE_RESULT.ILLEGAL, message: mistake?.message ?? DEFAULT_MESSAGES.illegal }
  }

  const accepted = step.accept.some(
    (candidate) => sameSquare(candidate.from, piece.col, piece.row) && sameSquare(candidate.to, toCol, toRow),
  )
  if (!accepted) {
    return {
      result: MOVE_RESULT.WRONG,
      message: mistake?.message ?? challenge.failureMessage ?? DEFAULT_MESSAGES.failure,
    }
  }

  const solved = stepIndex + 1 >= challenge.steps.length
  return {
    result: MOVE_RESULT.CORRECT,
    solved,
    pieces: movePiece(pieces, piece.id, toCol, toRow),
    message: solved
      ? (challenge.successMessage ?? DEFAULT_MESSAGES.success)
      : (step.successMessage ?? DEFAULT_MESSAGES.stepSuccess),
  }
}

function isSquare(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    isInBounds(value[0], value[1])
  )
}

// True only if `moves` — [{ from: [col, row], to: [col, row] }, ...] as the
// player made them — solves the challenge from its starting position: one
// move per step, each one judged exactly as the board judged it. `moves`
// is untrusted input (it is what a client posts to the server), so its shape
// is checked before anything is read from it.
export function verifySolution(challenge, moves) {
  if (!Array.isArray(moves) || moves.length !== challenge.steps.length) return false

  const playerSide = getPlayerSide(challenge)
  let pieces = buildPieces(challenge)

  for (let stepIndex = 0; stepIndex < moves.length; stepIndex++) {
    const attempt = moves[stepIndex]
    if (!attempt || !isSquare(attempt.from) || !isSquare(attempt.to)) return false

    const piece = findPieceAt(pieces, attempt.from[0], attempt.from[1])
    if (!piece || piece.side !== playerSide) return false

    const outcome = evaluateMove(challenge, stepIndex, pieces, piece, attempt.to[0], attempt.to[1])
    if (outcome.result !== MOVE_RESULT.CORRECT) return false
    pieces = outcome.pieces
  }

  return true
}
