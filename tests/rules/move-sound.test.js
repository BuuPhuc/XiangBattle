// Which sound a move makes (moveSoundFor) and the live game's one-step sound
// decision (nextGameSound) — including the online cases a browser test can't
// reach without a server: a rejected move being taken back, and checkmate
// arriving both from the board and from the server's game_over.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../helpers/board.js'
import { createMoveEntry } from '../../src/features/game/utils/moveEntry.js'
import { moveSoundFor, nextGameSound, SOUND } from '../../src/features/sound/moveSound.js'

// Black general (4,0), red general (3,9) — different files, so they never face.
const BASE = [
  P('bg', 'black', 'general', 4, 0),
  P('rg', 'red', 'general', 3, 9),
  P('rr', 'red', 'rook', 0, 5),
  P('bp', 'black', 'pawn', 0, 3),
]
const rook = BASE.find((p) => p.id === 'rr')
const play = (col, row) => createMoveEntry(BASE, rook, col, row, 1)

const quiet = play(1, 5) // sideways, nothing taken, no check
const capture = play(0, 3) // takes the pawn
const check = play(4, 5) // onto the black general's file

test('moveSoundFor: move / capture / check', () => {
  assert.equal(moveSoundFor(quiet), SOUND.MOVE)
  assert.equal(moveSoundFor(capture), SOUND.CAPTURE)
  assert.equal(moveSoundFor(check), SOUND.CHECK)
})

test('moveSoundFor: a capture that gives check is "check" (one sound per move)', () => {
  const pieces = [...BASE, P('bx', 'black', 'pawn', 4, 5)]
  const move = createMoveEntry(pieces, rook, 4, 5, 1)
  assert.ok(move.captured)
  assert.equal(moveSoundFor(move), SOUND.CHECK)
})

test('moveSoundFor: a move that ends the game is only "game end", even if it checks', () => {
  assert.equal(moveSoundFor(check, { gameOver: true }), SOUND.GAME_END)
})

// --- nextGameSound: feed it the game state step by step, like the hook does.
function run(states) {
  let before = null
  const sounds = []
  for (const now of states) {
    const { sound, endPlayed } = nextGameSound(before, now)
    before = { lastMove: now.lastMove, externalResult: now.externalResult, endPlayed }
    sounds.push(sound)
  }
  return sounds
}
const at = (lastMove, extra = {}) => ({ lastMove, externalResult: null, isGameOver: false, ...extra })

test('nothing plays on the first look (opening / resuming a game)', () => {
  assert.deepEqual(run([at(quiet)]), [null])
  assert.deepEqual(run([at(check, { isGameOver: true, externalResult: { side: 'black' } })]), [null])
})

test('each new move plays its own sound', () => {
  assert.deepEqual(run([at(null), at(quiet), at(capture), at(check)]), [null, SOUND.MOVE, SOUND.CAPTURE, SOUND.CHECK])
})

test('undo / redo (history unchanged, game-over flips while browsing) stays silent', () => {
  const mate = play(4, 5)
  assert.deepEqual(
    run([at(quiet), at(mate, { isGameOver: true }), at(mate, { isGameOver: false }), at(mate, { isGameOver: true })]),
    [null, SOUND.GAME_END, null, null]
  )
})

test('a move the server rejects: one sound when played, none when it is taken back', () => {
  // Taking it back is undo(): moveHistory keeps the same last entry.
  assert.deepEqual(run([at(null), at(quiet), at(quiet)]), [null, SOUND.MOVE, null])
  // The next real move replaces it (new last entry) and plays normally.
  assert.deepEqual(run([at(null), at(quiet), at(quiet), at(capture)]), [null, SOUND.MOVE, null, SOUND.CAPTURE])
})

test('online checkmate: board first, then server game_over → game end plays once', () => {
  const mate = play(4, 5)
  const serverResult = { side: 'black', reason: 'checkmate' }
  assert.deepEqual(
    run([at(quiet), at(mate, { isGameOver: true }), at(mate, { isGameOver: true, externalResult: serverResult })]),
    [null, SOUND.GAME_END, null]
  )
})

test('online checkmate: server game_over first, then the move → game end plays once', () => {
  const mate = play(4, 5)
  const serverResult = { side: 'black', reason: 'checkmate' }
  assert.deepEqual(
    run([at(quiet), at(quiet, { isGameOver: true, externalResult: serverResult }), at(mate, { isGameOver: true, externalResult: serverResult })]),
    [null, SOUND.GAME_END, null]
  )
})

test('ending without a move (timeout, resignation) plays game end once', () => {
  const result = { side: 'red', reason: 'resign' }
  assert.deepEqual(
    run([at(quiet), at(quiet, { isGameOver: true, externalResult: result }), at(quiet, { isGameOver: true, externalResult: result })]),
    [null, SOUND.GAME_END, null]
  )
})

test('resigning before any move was played still plays game end', () => {
  const result = { side: 'red', reason: 'resign' }
  assert.deepEqual(run([at(null), at(null, { isGameOver: true, externalResult: result })]), [null, SOUND.GAME_END])
})

test('a new game (empty board) re-arms the game-end sound', () => {
  const mate = play(4, 5)
  assert.deepEqual(
    run([at(quiet), at(mate, { isGameOver: true }), at(null), at(quiet), at(mate, { isGameOver: true })]),
    [null, SOUND.GAME_END, null, SOUND.MOVE, SOUND.GAME_END]
  )
})
