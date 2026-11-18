// Quick Play pairing by Elo, over real sockets against a freshly started
// backend. The waiting timeline is shrunk 20× (XIANGBATTLE_MATCH_WINDOW_SCALE
// = 0.05): ±100 at once, ±200 after 0.5 s, ±400 after 1 s, anyone after
// 1.5 s. Made-up accounts get their Elo from the id (fakeRatingLookup.js:
// 951600 → 1600); guests count as 1200. Nothing is written to the database.
// Each account is used by one test only: once paired, it stays seated in
// that room for the rest of the server's life.
const path = require('node:path')
const { test, before, after, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { SERVER_DIR, startServer, connect, firstOf } = require('./helpers/testServer')

require('dotenv').config({ path: path.join(SERVER_DIR, '.env'), quiet: true })
const { signAccessToken } = require('../utils/token')

const guestId = (tag) => `test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const account = (rating) => ({ id: 950000 + rating, username: `test_elo_${rating}` })
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let server
let open = []
async function player(rating) {
  const socket = await connect(server.url, rating ? { token: signAccessToken(account(rating)) } : {})
  open.push(socket)
  return socket
}

// Joins the queue; resolves with whichever comes first of queued/matched.
function quickPlay(socket, extra = {}) {
  const reply = firstOf(socket, ['quick_play_queued', 'match_found', 'room_error'])
  socket.emit('quick_play', { playerId: guestId('qp'), ...extra })
  return reply
}

before(async () => {
  server = await startServer({ env: { XIANGBATTLE_MATCH_WINDOW_SCALE: '0.05' } })
})

// Nobody from one test may still be waiting in the next — with ranges this
// short they would be paired with anyone.
afterEach(async () => {
  open.forEach((s) => s.close())
  open = []
  await pause(150)
})

after(async () => {
  await server?.stop()
})

test('two guests (both 1200) are paired at once', async () => {
  const a = await player()
  const b = await player()
  const queued = await quickPlay(a)
  assert.equal(queued.event, 'quick_play_queued')
  assert.equal(queued.payload.rating, 1200)
  const found = Promise.all([firstOf(a, ['match_found']), firstOf(b, ['match_found'])])
  await quickPlay(b)
  const [fa, fb] = await found
  assert.ok(fa && fb)
  assert.equal(fa.payload.roomId, fb.payload.roomId)
})

test("an account searches at its own Elo; a client's claimed rating is ignored", async () => {
  const strong = await player(1650)
  const queued = await quickPlay(strong, { rating: 800 })
  assert.equal(queued.event, 'quick_play_queued')
  assert.equal(queued.payload.rating, 1650)
  assert.equal(queued.payload.timeControl, '10+0')
  assert.ok(queued.payload.waitedMs >= 0 && queued.payload.waitedMs < 1000)

  const guest = await player()
  const claimed = await quickPlay(guest, { rating: 1600 })
  assert.equal(claimed.payload.rating, 1200, 'a guest is 1200, whatever it says')
})

test('a 400-point gap waits for the ranges to widen, then pairs on its own', async () => {
  const low = await player(1200)
  const high = await player(1600)
  await quickPlay(low)
  const foundLow = firstOf(low, ['match_found'], 4000)
  const foundHigh = firstOf(high, ['match_found'], 4000)
  const started = Date.now()
  const queued = await quickPlay(high)
  assert.equal(queued.event, 'quick_play_queued', 'paired before the ranges allowed it')

  const [l, h] = await Promise.all([foundLow, foundHigh])
  assert.ok(l && h, 'never paired')
  assert.equal(l.payload.roomId, h.payload.roomId)
  // Both must have waited ~1 s (the ±400 step) — and nobody clicked again.
  assert.ok(Date.now() - started >= 800, `paired too early (${Date.now() - started} ms)`)
  // The one who waited longer hosts and plays Red.
  assert.equal(l.payload.you.color, 'red')
})

test('the closest rating is chosen, not the one who waited longest', async () => {
  const far = await player(1501)
  const near = await player(1201)
  await quickPlay(far)
  await quickPlay(near) // 300 apart: not yet
  const farMatched = firstOf(far, ['match_found'], 300)

  const newcomer = await player(1291) // 90 from near, 210 from far (who waited longer)
  const foundNear = firstOf(near, ['match_found'])
  const r = await quickPlay(newcomer)
  assert.equal(r.event, 'match_found', 'the newcomer should be paired at once, with no waiting screen')
  assert.equal((await foundNear)?.payload.roomId, r.payload.roomId, '1291 should play 1201')
  assert.equal(await farMatched, null)
})

test('several waiting: each newcomer gets the nearest', async () => {
  const p1002 = await player(1002)
  const p1402 = await player(1402)
  await quickPlay(p1002)
  await quickPlay(p1402)

  const n1382 = await player(1382)
  const found1402 = firstOf(p1402, ['match_found'])
  const found1002 = firstOf(p1002, ['match_found'], 200)
  const r = await quickPlay(n1382)
  assert.equal(r.event, 'match_found')
  assert.equal((await found1402)?.payload.roomId, r.payload.roomId)
  assert.equal(await found1002, null)
})

test('different time controls are never paired, however long they wait', async () => {
  const a = await player()
  const b = await player()
  await quickPlay(a, { timeControl: '5+0' })
  const never = firstOf(a, ['match_found'], 2200) // well past "anyone" (1.5 s)
  const queued = await quickPlay(b, { timeControl: '15+5' })
  assert.equal(queued.event, 'quick_play_queued')
  assert.equal(await never, null)
})

test('clicking again keeps the waiting time; cancelling leaves the queue', async () => {
  const a = await player(1203)
  const id = guestId('ignored') // accounts are identified by their token
  await quickPlay(a, { playerId: id })
  await pause(300)
  const again = await quickPlay(a, { playerId: id })
  assert.equal(again.event, 'quick_play_queued')
  assert.ok(again.payload.waitedMs >= 250, `waiting time was reset (${again.payload.waitedMs} ms)`)

  a.emit('cancel_quick_play', {})
  await pause(100)
  const b = await player()
  const r = await quickPlay(b)
  assert.equal(r.event, 'quick_play_queued', 'paired with someone who had cancelled')
  const stillAlone = firstOf(b, ['match_found'], 2000)
  assert.equal(await stillAlone, null)
})
