// Which sound a move makes — pure, so it's tested directly (tests/rules).
// One sound per move, by priority: the game ended → check → capture → plain
// move. A checkmating move therefore only plays the game-end sound, never
// "check" and "game end" on top of each other.
import { otherTurn } from '../game/gameLogic.js'
import { isInCheck } from '../game/utils/checkUtils.js'

export const SOUND = {
  MOVE: 'move',
  CAPTURE: 'capture',
  CHECK: 'check',
  GAME_END: 'gameEnd',
}

// `move` is a moveHistory entry (see moveEntry.js): needs turn, captured and
// piecesAfter. `gameOver` — the game is over right after this move.
export function moveSoundFor(move, { gameOver = false } = {}) {
  if (gameOver) return SOUND.GAME_END
  if (isInCheck(move.piecesAfter, otherTurn(move.turn))) return SOUND.CHECK
  if (move.captured) return SOUND.CAPTURE
  return SOUND.MOVE
}

// The live game's sound decision (used by useGameSounds), one step at a
// time: given what was seen last time (`before`, null on the first look)
// and the game now, which sound to play (or null) and whether the game-end
// sound has now been played for this game (`endPlayed`).
//
//   now.lastMove       — moveHistory's last entry (null for an empty board).
//                        A NEW move = a different object than before; undo,
//                        redo and taking back a rejected move don't change it.
//   now.externalResult — useGame's non-board result (timeout, resignation,
//                        draw, server game_over), compared by identity.
//   now.isGameOver     — the game is over in the position shown.
//
// The game-end sound plays once per game, whichever comes first: the
// finishing move, or the server/clock announcing the end.
export function nextGameSound(before, now) {
  const { lastMove, externalResult, isGameOver } = now
  if (!before) return { sound: null, endPlayed: isGameOver }
  if (lastMove !== before.lastMove) {
    // Back to an empty board: a new game — silent, and game end re-armed.
    if (lastMove === null) return { sound: null, endPlayed: isGameOver }
    if (isGameOver) return { sound: before.endPlayed ? null : SOUND.GAME_END, endPlayed: true }
    return { sound: moveSoundFor(lastMove), endPlayed: false }
  }
  if (externalResult && externalResult !== before.externalResult) {
    return { sound: before.endPlayed ? null : SOUND.GAME_END, endPlayed: true }
  }
  return { sound: null, endPlayed: before.endPlayed }
}
