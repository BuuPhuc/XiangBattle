// "Xem ván đang diễn ra" over real sockets against a freshly started backend:
//  - anyone can watch, gets the whole game so far, then every move/result;
//  - a spectator can't play, resign, offer a draw or write in the players'
//    chat, and never sees the players' draw offers or chat;
//  - the spectators' own chat: accounts write, guests only read, players
//    never see it;
//  - who is watching reaches players and spectators (one person = one);
//  - the live-games list; a room that empties out closes for its audience.
// Guests and made-up account ids only — nothing is written to the database.
const path = require('node:path')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { SERVER_DIR, startServer, connect, firstOf } = require('./helpers/testServer')

require('dotenv').config({ path: path.join(SERVER_DIR, '.env'), quiet: true })
const { signAccessToken } = require('../utils/token')

const sq = (col, row) => ({ col, row })
const guestId = (tag) => `test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const VIEWER = { id: 900011, username: 'test_viewer' }

let server
const sockets = []
async function client(user) {
  const socket = await connect(server.url, user ? { token: signAccessToken(user) } : {})
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

async function startedGuestGame() {
  const red = await client()
  const black = await client()
  const created = firstOf(red, ['room_created'])
  red.emit('create_room', { playerId: guestId('red') })
  const { payload } = await created
  const started = Promise.all([firstOf(red, ['game_started']), firstOf(black, ['game_started'])])
  black.emit('join_room', { roomId: payload.roomId, playerId: guestId('black') })
  const [r, b] = await started
  assert.ok(r && b, 'game did not start')
  return { red, black, roomId: payload.roomId }
}

async function watch(socket, roomId, playerId = guestId('viewer')) {
  const reply = firstOf(socket, ['spectate:state', 'spectate:error'])
  socket.emit('watch_room', { roomId, playerId })
  return reply
}

async function playRedCannonMove(red, black) {
  const relayed = firstOf(black, ['move_made'])
  red.emit('make_move', { move: { from: sq(1, 7), to: sq(4, 7) } })
  assert.ok(await relayed, 'move was not played')
}

test('a guest watches: gets the game so far, then moves and the result', async () => {
  const { red, black, roomId } = await startedGuestGame()
  await playRedCannonMove(red, black)

  const viewer = await client()
  const reply = await watch(viewer, roomId)
  assert.equal(reply.event, 'spectate:state')
  const state = reply.payload
  assert.equal(state.roomId, roomId)
  assert.equal(state.status, 'playing')
  assert.equal(state.moveHistory.length, 1)
  assert.equal(state.currentTurn, 'black')
  assert.ok(state.timerState.red && state.timerState.black)
  assert.equal(state.players.length, 2)
  assert.deepEqual(state.players.map((p) => p.color).sort(), ['black', 'red'])
  state.players.forEach((p) => {
    assert.equal(p.userId, null)
    assert.equal(p.socketId, undefined, 'never leaks a socket id')
    assert.equal(p.playerId, undefined, "never leaks a guest's private id")
  })
  assert.equal(state.spectators.count, 1)

  const move = firstOf(viewer, ['spectate:move'])
  black.emit('make_move', { move: { from: sq(1, 0), to: sq(2, 2) } })
  const moved = await move
  assert.ok(moved, 'spectator did not get the move')
  assert.equal(moved.payload.move.ply, 2)
  assert.equal(moved.payload.currentTurn, 'red')

  const over = firstOf(viewer, ['spectate:game_over'])
  red.emit('resign')
  const result = await over
  assert.ok(result, 'spectator did not get the result')
  assert.equal(result.payload.status, 'resign')
  assert.equal(result.payload.winner, 'black')
})

test('a spectator cannot play, resign, offer a draw or use the players\' chat', async () => {
  const { red, black, roomId } = await startedGuestGame()
  const viewer = await client()
  await watch(viewer, roomId)

  const rejected = firstOf(viewer, ['move_rejected'])
  const leak = firstOf(red, ['move_made'], 800)
  viewer.emit('make_move', { move: { from: sq(1, 7), to: sq(4, 7) } })
  assert.equal((await rejected)?.payload.code, 'NOT_IN_ROOM')
  assert.equal(await leak, null)

  for (const [event, payload] of [
    ['resign', undefined],
    ['offer_draw', undefined],
    ['chat:send', { message: 'xin chào' }],
  ]) {
    const error = firstOf(viewer, ['room_error'])
    const reached = firstOf(black, ['game_over', 'draw_offered', 'chat:message'], 600)
    viewer.emit(event, payload)
    assert.equal((await error)?.payload.code, 'NOT_IN_ROOM', `${event} was not refused`)
    assert.equal(await reached, null, `${event} reached a player`)
  }
})

test("a spectator never sees the players' draw offers or chat", async () => {
  const { red, black, roomId } = await startedGuestGame()
  const viewer = await client()
  await watch(viewer, roomId)

  const seen = firstOf(viewer, ['draw_offered', 'draw_offer_sent', 'chat:message', 'spectate:chat_message'], 1000)
  const offered = firstOf(black, ['draw_offered'])
  const chatted = firstOf(black, ['chat:message'])
  red.emit('offer_draw')
  red.emit('chat:send', { message: 'riêng tư' })
  assert.ok(await offered)
  assert.ok(await chatted)
  assert.equal(await seen, null)
})

test('spectator chat: accounts write, guests only read, players never see it', async () => {
  const { red, roomId } = await startedGuestGame()
  const guest = await client()
  const account = await client(VIEWER)
  await watch(guest, roomId)
  await watch(account, roomId)

  const refused = firstOf(guest, ['spectate:error'])
  guest.emit('spectate:chat_send', { message: 'khách nói' })
  assert.equal((await refused)?.payload.code, 'LOGIN_REQUIRED')

  const toGuest = firstOf(guest, ['spectate:chat_message'])
  const toAccount = firstOf(account, ['spectate:chat_message'])
  const toPlayer = firstOf(red, ['spectate:chat_message', 'chat:message'], 1000)
  account.emit('spectate:chat_send', { message: '  nước hay!  ', playerName: 'kẻ mạo danh' })
  const got = await toGuest
  assert.ok(got, 'guest did not read the message')
  assert.equal(got.payload.message, 'nước hay!')
  assert.equal(got.payload.playerName, VIEWER.username, 'the name comes from the account, not the payload')
  assert.equal(got.payload.playerId, `u:${VIEWER.id}`)
  assert.ok(await toAccount)
  assert.equal(await toPlayer, null)

  // A later spectator gets the log with the state.
  const late = await client()
  const state = await watch(late, roomId)
  assert.equal(state.payload.messages.length, 1)
})

test('who is watching: players and spectators are told; one person counts once', async () => {
  const { red, roomId } = await startedGuestGame()

  const account = await client(VIEWER)
  const update = firstOf(red, ['spectators_update'])
  await watch(account, roomId)
  const first = (await update)?.payload
  assert.equal(first.count, 1)
  assert.equal(first.viewers[0].username, VIEWER.username)
  assert.equal(first.guests, 0)

  // Same account, second tab: still one viewer.
  const secondTab = await client(VIEWER)
  const again = firstOf(red, ['spectators_update'])
  await watch(secondTab, roomId)
  assert.equal((await again)?.payload.count, 1)

  // Two guests (different ids) count as two, by number only.
  const g1 = await client()
  const g2 = await client()
  const second = firstOf(red, ['spectators_update'])
  await watch(g1, roomId)
  assert.equal((await second)?.payload.count, 2)
  const third = firstOf(red, ['spectators_update'])
  await watch(g2, roomId)
  const summary = (await third)?.payload
  assert.equal(summary.count, 3)
  assert.equal(summary.guests, 2)
  assert.equal(summary.viewers.length, 1)

  // Leaving (explicitly or by disconnecting) brings the number down.
  const afterUnwatch = firstOf(red, ['spectators_update'])
  g1.emit('unwatch_room')
  assert.equal((await afterUnwatch)?.payload.count, 2)
  const afterDisconnect = firstOf(red, ['spectators_update'])
  g2.close()
  assert.equal((await afterDisconnect)?.payload.count, 1)
})

test('a player cannot watch their own match; an unknown room is refused', async () => {
  const red = await client()
  const black = await client()
  const redId = guestId('red')
  const created = firstOf(red, ['room_created'])
  red.emit('create_room', { playerId: redId })
  const { payload } = await created
  const started = firstOf(black, ['game_started'])
  black.emit('join_room', { roomId: payload.roomId, playerId: guestId('black') })
  assert.ok(await started)

  const otherTab = await client()
  const own = await watch(otherTab, payload.roomId, redId)
  assert.equal(own.event, 'spectate:error')
  assert.equal(own.payload.code, 'YOU_ARE_PLAYING')

  const missing = await watch(otherTab, 'ZZZZZZ')
  assert.equal(missing.payload.code, 'ROOM_NOT_FOUND')
})

test('live games list: running matches only, with players and spectator count', async () => {
  const { red, roomId } = await startedGuestGame()
  const viewer = await client()
  await watch(viewer, roomId)

  const list = () => new Promise((resolve) => viewer.emit('list_live_games', {}, resolve))
  const { games } = await list()
  const row = games.find((g) => g.roomId === roomId)
  assert.ok(row, 'running game not listed')
  assert.equal(row.spectatorCount, 1)
  assert.equal(row.moveCount, 0)
  assert.equal(row.players.length, 2)
  assert.equal(row.timeControl.id, '10+0')

  const over = firstOf(viewer, ['spectate:game_over'])
  red.emit('resign')
  assert.ok(await over)
  const after = await list()
  assert.equal(after.games.find((g) => g.roomId === roomId), undefined, 'finished game still listed')
})

test('a player dropping out shows for spectators; an emptied room closes', async () => {
  const { red, black, roomId } = await startedGuestGame()
  const viewer = await client()
  await watch(viewer, roomId)

  const dropped = firstOf(viewer, ['spectate:connection'])
  black.close()
  const connection = await dropped
  assert.ok(connection)
  assert.deepEqual(connection.payload, { color: 'black', connected: false })

  // Finish it (red resigns), then both seats leave: the audience is told.
  const over = firstOf(viewer, ['spectate:game_over'])
  red.emit('resign')
  assert.ok(await over)
  const left = firstOf(viewer, ['spectate:player_left'])
  red.emit('leave_room')
  assert.equal((await left)?.payload.color, 'red')
})

test('both players leaving a room closes it for spectators', async () => {
  const { red, black, roomId } = await startedGuestGame()
  const viewer = await client()
  await watch(viewer, roomId)
  const over = firstOf(viewer, ['spectate:game_over'])
  red.emit('resign')
  assert.ok(await over)

  const closed = firstOf(viewer, ['spectate:closed'], 2000)
  red.emit('leave_room')
  black.emit('leave_room')
  assert.equal((await closed)?.payload.roomId, roomId)

  const gone = await watch(viewer, roomId)
  assert.equal(gone.payload.code, 'ROOM_NOT_FOUND')
})

test('a rematch reaches spectators as a fresh game', async () => {
  const { red, black, roomId } = await startedGuestGame()
  await playRedCannonMove(red, black)
  const viewer = await client()
  await watch(viewer, roomId)

  const over = firstOf(viewer, ['spectate:game_over'])
  red.emit('resign')
  assert.ok(await over)

  const fresh = firstOf(viewer, ['spectate:state'])
  const asked = firstOf(black, ['play_again_requested'])
  red.emit('request_play_again')
  assert.ok(await asked)
  black.emit('respond_play_again', { accept: true })
  const state = (await fresh)?.payload
  assert.ok(state, 'spectator did not follow the rematch')
  assert.equal(state.moveHistory.length, 0)
  assert.equal(state.matchResult, null)
  assert.equal(state.spectators.count, 1)
})
