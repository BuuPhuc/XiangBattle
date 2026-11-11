// Server referee at the Room level (no sockets, no database): the server
// decides checkmate/stalemate from its own board and enforces the clocks
// with its own timer.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Room, setTurnTimeoutHandler } = require('../rooms/room')

const P = (id, side, type, col, row) => ({ id, side, type, char: '?', col, row })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function startedRoom(timeControl) {
  const room = new Room('T', 's1', 'p1')
  if (timeControl) room.timeControl = timeControl
  room.addPlayer('s2', 'p2')
  room.startGame()
  return room
}

test('checkmate is detected by the server', () => {
  // Lone black general on (3,0): the red general covers file 4, a rook on
  // row 1 covers (3,1), the other rook checks along row 0.
  const room = startedRoom()
  room.pieces = [P('b-g', 'black', 'general', 3, 0), P('r-g', 'red', 'general', 4, 9), P('r-r1', 'red', 'rook', 0, 1), P('r-r2', 'red', 'rook', 8, 5)]
  const result = room.playMove({ col: 8, row: 5 }, { col: 8, row: 0 })
  room.clearTurnTimer()
  assert.equal(result.ok, true)
  assert.equal(result.outcome, 'checkmate')
})

test('stalemate (no legal move, not in check) is detected as a game end', () => {
  const room = startedRoom()
  room.pieces = [P('b-g', 'black', 'general', 3, 0), P('r-g', 'red', 'general', 4, 9), P('r-r', 'red', 'rook', 0, 2), P('r-p', 'red', 'pawn', 8, 5)]
  const result = room.playMove({ col: 0, row: 2 }, { col: 0, row: 1 })
  room.clearTurnTimer()
  assert.equal(result.ok, true)
  assert.equal(result.outcome, 'stalemate')
})

test('an ordinary move has no outcome and passes the turn', () => {
  const room = startedRoom()
  const result = room.playMove({ col: 7, row: 7 }, { col: 4, row: 7 })
  room.clearTurnTimer()
  assert.equal(result.ok, true)
  assert.equal(result.outcome, null)
  assert.equal(room.currentTurn, 'black')
  assert.equal(result.entry.notation, 'P2-5')
})

test('illegal moves are rejected and change nothing', () => {
  const room = startedRoom()
  const before = JSON.stringify(room.pieces)
  assert.equal(room.playMove({ col: 0, row: 9 }, { col: 4, row: 5 }).code, 'ILLEGAL_MOVE') // rook diagonally
  assert.equal(room.playMove({ col: 0, row: 3 }, { col: 0, row: 4 }).code, 'ILLEGAL_MOVE') // opponent's pawn
  assert.equal(room.playMove({ col: 'x', row: 9 }, { col: 0, row: 8 }).code, 'INVALID_MOVE_PAYLOAD')
  room.clearTurnTimer()
  assert.equal(JSON.stringify(room.pieces), before)
  assert.equal(room.currentTurn, 'red')
})

// Puts `pieces` on the board as a fresh starting position (red to move).
function withPosition(room, pieces) {
  room.pieces = pieces
  room.positions = [{ pieces, side: 'red' }]
}

test('perpetual check: the checking side is ruled to lose at the 3rd occurrence', () => {
  const room = startedRoom()
  withPosition(room, [
    P('b-g', 'black', 'general', 4, 0),
    P('r-g', 'red', 'general', 3, 9),
    P('r-r', 'red', 'rook', 8, 1),
    P('r-p', 'red', 'pawn', 0, 6),
    P('b-p', 'black', 'pawn', 8, 3),
  ])
  const cycle = [
    [8, 1, 8, 0],
    [4, 0, 4, 1],
    [8, 0, 8, 1],
    [4, 1, 4, 0],
  ]
  const results = [...cycle, ...cycle].map(([fc, fr, tc, tr]) => room.playMove({ col: fc, row: fr }, { col: tc, row: tr }))
  room.clearTurnTimer()
  assert.ok(results.every((r) => r.ok), 'a scripted move was rejected')
  assert.deepEqual(
    results.map((r) => r.outcome),
    [null, null, null, null, null, null, null, 'perpetual-check']
  )
  assert.equal(results[7].winner, 'black')
})

test('repetition with no one at fault is a draw (no winner)', () => {
  const room = startedRoom()
  const cycle = [
    [1, 9, 2, 7], // red horse out
    [1, 0, 2, 2], // black horse out
    [2, 7, 1, 9], // and back
    [2, 2, 1, 0],
  ]
  const results = [...cycle, ...cycle].map(([fc, fr, tc, tr]) => room.playMove({ col: fc, row: fr }, { col: tc, row: tr }))
  room.clearTurnTimer()
  assert.ok(results.every((r) => r.ok))
  assert.equal(results[7].outcome, 'repetition-draw')
  assert.equal(results[7].winner, null)
})

test('server clock: turn timer ends the game, moves re-arm it, results clear it', async () => {
  const fired = []
  setTurnTimeoutHandler((room) => fired.push(room.getExpiredTimeout()))
  try {
    const room = startedRoom({ moveTimeMs: 150, gameTimeMs: 10_000 })
    assert.equal(room.getExpiredTimeout(), null)
    await sleep(300)
    assert.equal(fired.length, 1, 'timer did not fire')
    assert.deepEqual(fired[0], { status: 'timeout-move', loser: 'red' })

    fired.length = 0
    const room2 = startedRoom({ moveTimeMs: 200, gameTimeMs: 10_000 })
    await sleep(100)
    room2.playMove({ col: 7, row: 7 }, { col: 4, row: 7 })
    await sleep(150)
    assert.equal(fired.length, 0, 'red moved in time but still timed out')
    await sleep(150)
    assert.equal(fired.length, 1)
    assert.equal(fired[0].loser, 'black')

    fired.length = 0
    const room3 = startedRoom({ moveTimeMs: 100, gameTimeMs: 10_000 })
    room3.recordMatchResult('resign', 'black')
    await sleep(200)
    assert.equal(fired.length, 0, 'a finished match timed out')
  } finally {
    setTurnTimeoutHandler(null)
  }
})
