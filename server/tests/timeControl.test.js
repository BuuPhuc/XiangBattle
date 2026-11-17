// Time controls (5 + 0, 10 + 0, 15 + 5, 20 + 5):
//  - Room level (no sockets): each preset's clocks, per-move limit and
//    increment, and that an unknown id falls back to 10 + 0;
//  - over real sockets: create_room / quick_play carry the picked time
//    control into the match, made-up ones are replaced by the default, and
//    Quick Play only pairs players who picked the same one.
// Guests only — nothing is written to the database.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { Room } = require('../rooms/room')
const { startServer, connect, firstOf } = require('./helpers/testServer')

const MINUTE = 60 * 1000

// The side to move's clock is already running, so it may be a few ms under.
function assertAbout(actual, expected, message) {
  assert.ok(actual <= expected && actual > expected - 1000, `${message}: ${actual} is not about ${expected}`)
}

function startedRoom(timeControlId) {
  const room = new Room('T', 's1', 'p1', timeControlId)
  room.addPlayer('s2', 'p2')
  room.startGame()
  return room
}

test('each preset sets both clocks, the per-move limit and the increment', () => {
  const expected = {
    '5+0': { gameTimeMs: 5 * MINUTE, moveTimeMs: 1 * MINUTE, incrementMs: 0 },
    '10+0': { gameTimeMs: 10 * MINUTE, moveTimeMs: 2 * MINUTE, incrementMs: 0 },
    '15+5': { gameTimeMs: 15 * MINUTE, moveTimeMs: 2 * MINUTE, incrementMs: 5000 },
    '20+5': { gameTimeMs: 20 * MINUTE, moveTimeMs: 5 * MINUTE, incrementMs: 5000 },
  }
  for (const [id, control] of Object.entries(expected)) {
    const room = startedRoom(id)
    room.clearTurnTimer()
    assert.deepEqual(room.timeControl, { id, ...control }, id)
    assert.deepEqual(room.toPublic().timeControl, { id, ...control }, id)
    const snapshot = room.getTimerSnapshot()
    assertAbout(snapshot.red.gameTime, control.gameTimeMs, id)
    assert.equal(snapshot.black.gameTime, control.gameTimeMs, id)
    assert.equal(snapshot.black.moveTime, control.moveTimeMs, id)
  }
})

test('an unknown or missing time control falls back to 10 + 0', () => {
  for (const id of [undefined, null, '', '99+0', '10+5', { id: '5+0' }, 15]) {
    const room = new Room('T', 's1', 'p1', id)
    assert.equal(room.timeControl.id, '10+0', String(id))
    assert.equal(room.timeControl.gameTimeMs, 10 * MINUTE)
  }
})

test('15 + 5: the mover gets 5 seconds back after every move', () => {
  const room = startedRoom('15+5')
  const start = room.turnStartedAt
  room.turnStartedAt = start - 3000 // red thought for 3 seconds
  assert.equal(room.playMove({ col: 7, row: 7 }, { col: 4, row: 7 }).ok, true)
  // 15:00 - 0:03 + 0:05 = 15:02 (give or take the few ms the call took)
  const red = room.remainingGameTime.red
  assert.ok(red > 15 * MINUTE + 1900 && red <= 15 * MINUTE + 2000, `red has ${red}ms`)
  assert.equal(room.remainingGameTime.black, 15 * MINUTE, 'the side that did not move gets nothing')

  assert.equal(room.playMove({ col: 1, row: 0 }, { col: 2, row: 2 }).ok, true)
  room.clearTurnTimer()
  assert.ok(room.remainingGameTime.black > 15 * MINUTE + 4900, 'black got its 5 seconds too')
  assert.equal(room.getTimerSnapshot().red.gameTime, red, 'snapshot shows the incremented clock')
})

test('no increment on 5 + 0 / 10 + 0', () => {
  for (const id of ['5+0', '10+0']) {
    const room = startedRoom(id)
    room.playMove({ col: 7, row: 7 }, { col: 4, row: 7 })
    room.clearTurnTimer()
    assert.ok(room.remainingGameTime.red <= room.timeControl.gameTimeMs, id)
  }
})

test('the per-move limit differs per preset (1, 2, 2 and 5 minutes)', () => {
  const limits = { '5+0': 1, '10+0': 2, '15+5': 2, '20+5': 5 }
  for (const [id, minutes] of Object.entries(limits)) {
    const room = startedRoom(id)
    room.clearTurnTimer()
    const t0 = room.turnStartedAt
    assert.equal(room.getExpiredTimeout(t0 + minutes * MINUTE - 1), null, `${id}: still has time just before ${minutes}'`)
    assert.deepEqual(room.getExpiredTimeout(t0 + minutes * MINUTE), { status: 'timeout-move', loser: 'red' }, id)
  }
})

test('a rematch in the same room keeps its time control', () => {
  const room = startedRoom('20+5')
  room.recordMatchResult('resign', 'black')
  room.startGame()
  room.clearTurnTimer()
  assert.equal(room.timeControl.id, '20+5')
  assert.equal(room.remainingGameTime.red, 20 * MINUTE)
})

// ---------------------------------------------------------------- sockets

let server
const sockets = []
const guestId = (tag) => `test-tc-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
async function client() {
  const socket = await connect(server.url, {})
  sockets.push(socket)
  return socket
}

before(async () => {
  server = await startServer()
})

after(async () => {
  sockets.forEach((s) => s.close())
  await server?.stop()
})

async function createAndJoin(timeControl) {
  const red = await client()
  const black = await client()
  const created = firstOf(red, ['room_created', 'room_error'])
  red.emit('create_room', { playerId: guestId('red'), timeControl })
  const { event, payload } = await created
  assert.equal(event, 'room_created')
  const started = Promise.all([firstOf(red, ['game_started']), firstOf(black, ['game_started'])])
  black.emit('join_room', { roomId: payload.roomId, playerId: guestId('black') })
  const [r, b] = await started
  assert.ok(r && b, 'game did not start')
  return { created: payload, red: r.payload, black: b.payload }
}

test('create_room: the picked time control reaches both players', async () => {
  const { created, red, black } = await createAndJoin('15+5')
  assert.equal(created.timeControl.id, '15+5', 'waiting room shows it')
  assert.equal(red.timeControl.id, '15+5')
  assert.equal(black.timeControl.id, '15+5')
  assert.equal(black.timerState.black.gameTime, 15 * MINUTE) // red moves first: black's clock is not running
  assert.equal(black.timerState.black.moveTime, 2 * MINUTE)
})

test('create_room: a made-up or missing time control becomes 10 + 0', async () => {
  for (const timeControl of ['1+0', undefined, { gameTimeMs: 1 }]) {
    const { red } = await createAndJoin(timeControl)
    assert.equal(red.timeControl.id, '10+0', JSON.stringify(timeControl))
    assertAbout(red.timerState.red.gameTime, 10 * MINUTE, 'red clock')
  }
})

test('quick play only pairs players who picked the same time control', async () => {
  const a = await client()
  const b = await client()
  const c = await client()

  let queued = firstOf(a, ['quick_play_queued', 'match_found'])
  a.emit('quick_play', { playerId: guestId('a'), timeControl: '5+0' })
  queued = await queued
  assert.equal(queued?.event, 'quick_play_queued')
  assert.equal(queued.payload.timeControl, '5+0')

  // B picked 15 + 5: queued too, not matched with A.
  const aNotMatched = firstOf(a, ['match_found'], 600)
  queued = firstOf(b, ['quick_play_queued', 'match_found'])
  b.emit('quick_play', { playerId: guestId('b'), timeControl: '15+5' })
  queued = await queued
  assert.equal(queued?.event, 'quick_play_queued')
  assert.equal(queued.payload.timeControl, '15+5')
  assert.equal(await aNotMatched, null, 'A (5 + 0) was matched with B (15 + 5)')

  // C picked 5 + 0: matched with A straight away, at 5 + 0.
  const matchedA = firstOf(a, ['match_found'])
  const matchedC = firstOf(c, ['match_found', 'quick_play_queued'])
  c.emit('quick_play', { playerId: guestId('c'), timeControl: '5+0' })
  const [ma, mc] = await Promise.all([matchedA, matchedC])
  assert.equal(mc?.event, 'match_found')
  assert.ok(ma, 'A was not matched')
  assert.equal(ma.payload.roomId, mc.payload.roomId)
  assert.equal(mc.payload.timeControl.id, '5+0')
  assertAbout(mc.payload.timerState.red.moveTime, 1 * MINUTE, 'red move clock')

  b.emit('cancel_quick_play', {})
})

test('quick play: a made-up time control is queued as 10 + 0', async () => {
  const d = await client()
  const queued = firstOf(d, ['quick_play_queued', 'match_found'])
  d.emit('quick_play', { playerId: guestId('d'), timeControl: '0+0' })
  const r = await queued
  assert.equal(r?.event, 'quick_play_queued')
  assert.equal(r.payload.timeControl, '10+0')
  d.emit('cancel_quick_play', {})
})
