// How a finished match is written to the database (result + end reason +
// whether it's rated as a draw) — checked without touching the database.
// Repetition results must use the existing REPETITION end reason, and a
// repetition draw must be stored and rated as a draw, like an agreed draw.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { describeResult } = require('../services/gameHistoryService')

test('repetition results are stored as REPETITION with the right result', () => {
  assert.deepEqual(describeResult('perpetual-check', 'black'), { isDraw: false, result: 'BLACK_WIN', endReason: 'REPETITION' })
  assert.deepEqual(describeResult('perpetual-chase', 'red'), { isDraw: false, result: 'RED_WIN', endReason: 'REPETITION' })
  assert.deepEqual(describeResult('repetition-draw', null), { isDraw: true, result: 'DRAW', endReason: 'REPETITION' })
})

test('existing results are stored exactly as before', () => {
  assert.deepEqual(describeResult('draw', null), { isDraw: true, result: 'DRAW', endReason: 'DRAW_AGREEMENT' })
  assert.deepEqual(describeResult('checkmate', 'red'), { isDraw: false, result: 'RED_WIN', endReason: 'CHECKMATE' })
  assert.deepEqual(describeResult('stalemate', 'black'), { isDraw: false, result: 'BLACK_WIN', endReason: 'STALEMATE' })
  assert.deepEqual(describeResult('resign', 'black'), { isDraw: false, result: 'BLACK_WIN', endReason: 'RESIGN' })
  assert.deepEqual(describeResult('timeout-move', 'red'), { isDraw: false, result: 'RED_WIN', endReason: 'TIMEOUT' })
  assert.deepEqual(describeResult('opponent-left', 'red'), { isDraw: false, result: 'RED_WIN', endReason: 'DISCONNECT' })
})

// --- Elo only for Quick Play ---------------------------------------------
// settleRatings decides what a finished game does to both players: wins /
// losses / draws always count; Elo moves only in a rated (Quick Play) game.
const { settleRatings } = require('../services/gameHistoryService')

const redRow = { rating: 1300, wins: 5, losses: 2, draws: 1 }
const blackRow = { rating: 1200, wins: 3, losses: 4, draws: 0 }

test('a rated game moves Elo and counts the result', () => {
  const { elo, redStats, blackStats } = settleRatings({ rated: true, isDraw: false, winnerColor: 'black', red: redRow, black: blackRow })
  assert.ok(elo.changeA < 0 && elo.changeB > 0, 'the upset should cost red and pay black')
  assert.equal(elo.newRatingA, redRow.rating + elo.changeA)
  assert.equal(elo.newRatingB, blackRow.rating + elo.changeB)
  assert.deepEqual(redStats, { wins: 5, losses: 3, draws: 1 })
  assert.deepEqual(blackStats, { wins: 4, losses: 4, draws: 0 })
})

test('a friendly game counts the result but leaves Elo unchanged', () => {
  for (const [isDraw, winnerColor] of [
    [false, 'red'],
    [false, 'black'],
    [true, null],
  ]) {
    const { elo, redStats, blackStats } = settleRatings({ rated: false, isDraw, winnerColor, red: redRow, black: blackRow })
    assert.deepEqual(elo, { newRatingA: 1300, newRatingB: 1200, changeA: 0, changeB: 0 })
    const total = (s) => s.wins + s.losses + s.draws
    assert.equal(total(redStats), total(redRow) + 1, 'the game still counts for red')
    assert.equal(total(blackStats), total(blackRow) + 1, 'the game still counts for black')
  }
})

test('the stored rows are never modified in place', () => {
  const red = { ...redRow }
  settleRatings({ rated: true, isDraw: true, winnerColor: null, red, black: { ...blackRow } })
  assert.deepEqual(red, redRow)
})
