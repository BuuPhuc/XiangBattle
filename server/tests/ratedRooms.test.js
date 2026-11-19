// Which rooms count for Elo, over real sockets: only Quick Play (and its
// rematches, played in the same room). A room made with "Tạo phòng" is
// friendly. Every room tells its players which it is (`rated`), so the
// match screen can show "Tính Elo" / "Giao hữu". Guests only — nothing is
// written to the database (what a finished game does to ratings is covered
// in gameResult.test.js).
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, connect, firstOf } = require('./helpers/testServer')

const guestId = (tag) => `test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let server
const sockets = []
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

test('"Tạo phòng" rooms are friendly (rated: false), from creation to the match', async () => {
  const red = await client()
  const black = await client()
  const created = firstOf(red, ['room_created'])
  red.emit('create_room', { playerId: guestId('red') })
  const room = (await created).payload
  assert.equal(room.rated, false)

  const started = Promise.all([firstOf(red, ['game_started']), firstOf(black, ['game_started'])])
  black.emit('join_room', { roomId: room.roomId, playerId: guestId('black') })
  const [r, b] = await started
  assert.equal(r.payload.rated, false)
  assert.equal(b.payload.rated, false)

  // Spectators and the live list say the same.
  const viewer = await client()
  const state = firstOf(viewer, ['spectate:state'])
  viewer.emit('watch_room', { roomId: room.roomId })
  assert.equal((await state).payload.rated, false)
  const { games } = await new Promise((resolve) => viewer.emit('list_live_games', {}, resolve))
  assert.equal(games.find((g) => g.roomId === room.roomId).rated, false)
})

test('Quick Play rooms are rated, and so is a rematch in them', async () => {
  const a = await client()
  const b = await client()
  await new Promise((resolve) => {
    a.once('quick_play_queued', resolve)
    a.emit('quick_play', { playerId: guestId('qa') })
  })
  const found = Promise.all([firstOf(a, ['match_found']), firstOf(b, ['match_found'])])
  b.emit('quick_play', { playerId: guestId('qb') })
  const [fa, fb] = await found
  assert.equal(fa.payload.rated, true)
  assert.equal(fb.payload.rated, true)

  const over = firstOf(b, ['game_over'])
  a.emit('resign')
  assert.ok(await over)
  const asked = firstOf(b, ['play_again_requested'])
  a.emit('request_play_again')
  assert.ok(await asked)
  const rematch = firstOf(a, ['game_started'])
  b.emit('respond_play_again', { accept: true })
  assert.equal((await rematch)?.payload.rated, true, 'a Quick Play rematch must stay rated')
})
