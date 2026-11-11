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
