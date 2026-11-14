// End-to-end over real sockets against a freshly started backend:
//  - referee: a client can't claim a win, play illegal moves, move the
//    opponent's pieces, move out of turn, or smuggle in a forged board;
//  - identity: nobody can act as an account they aren't logged in as;
//  - quick play: two players get matched.
// Guests and made-up account ids only — nothing is written to the database.
const path = require('node:path')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { SERVER_DIR, startServer, connect, firstOf } = require('./helpers/testServer')

require('dotenv').config({ path: path.join(SERVER_DIR, '.env'), quiet: true })
const { signAccessToken } = require('../utils/token')

const sq = (col, row) => ({ col, row })
const guestId = (tag) => `test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const X = { id: 900001, username: 'test_x' }
const Y = { id: 900002, username: 'test_y' }

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

// Two guests in one room with the game started; red moves first.
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
  return { red, black }
}

test('referee: a client cannot declare itself the winner', async () => {
  const { red, black } = await startedGuestGame()
  const over = firstOf(black, ['game_over'], 1000)
  red.emit('report_game_over', { status: 'checkmate', winner: 'red' })
  assert.equal(await over, null)
})

test('referee: illegal move, opponent piece and out-of-turn moves are rejected', async () => {
  const { red, black } = await startedGuestGame()

  let rejected = firstOf(red, ['move_rejected'])
  const leaked = firstOf(black, ['move_made'], 800)
  red.emit('make_move', { move: { from: sq(0, 9), to: sq(4, 5) } }) // rook diagonally
  assert.equal((await rejected)?.payload.code, 'ILLEGAL_MOVE')
  assert.equal(await leaked, null, 'illegal move was relayed to the opponent')

  rejected = firstOf(red, ['move_rejected'])
  red.emit('make_move', { move: { from: sq(0, 3), to: sq(0, 4) } }) // black's pawn
  assert.equal((await rejected)?.payload.code, 'ILLEGAL_MOVE')

  rejected = firstOf(black, ['move_rejected'])
  black.emit('make_move', { move: { from: sq(0, 3), to: sq(0, 4) } }) // red to move
  assert.equal((await rejected)?.payload.code, 'NOT_YOUR_TURN')
})

test('referee: a forged board sent with a legal move is ignored', async () => {
  const { red, black } = await startedGuestGame()
  const forged = [{ id: 'r-g', side: 'red', type: 'general', char: '帥', col: 4, row: 9 }]
  const made = firstOf(black, ['move_made'])
  red.emit('make_move', { move: { from: sq(7, 7), to: sq(4, 7), piecesAfter: forged, notation: 'HACK' } })
  const result = await made
  assert.ok(result, 'legal move was not relayed')
  assert.equal(result.payload.move.piecesAfter.length, 32)
  assert.equal(result.payload.move.notation, 'P2-5')
})

test('repetition: the server declares the draw once, then accepts no more moves', async () => {
  const { red, black } = await startedGuestGame()
  const overEvents = { red: [], black: [] }
  red.on('game_over', (p) => overEvents.red.push(p))
  black.on('game_over', (p) => overEvents.black.push(p))

  // Both horses out and back, twice: the start position occurs a 3rd time.
  const cycle = [
    [red, black, sq(1, 9), sq(2, 7)],
    [black, red, sq(1, 0), sq(2, 2)],
    [red, black, sq(2, 7), sq(1, 9)],
    [black, red, sq(2, 2), sq(1, 0)],
  ]
  for (const [mover, other, from, to] of [...cycle, ...cycle]) {
    const relayed = firstOf(other, ['move_made'])
    mover.emit('make_move', { move: { from, to } })
    assert.ok(await relayed, `move ${JSON.stringify(from)}→${JSON.stringify(to)} was not accepted`)
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
  assert.equal(overEvents.red.length, 1, 'red should get exactly one game_over')
  assert.equal(overEvents.black.length, 1, 'black should get exactly one game_over')
  assert.deepEqual(overEvents.red[0], { status: 'repetition-draw', winner: null, loser: null })

  const rejected = firstOf(red, ['move_rejected'])
  red.emit('make_move', { move: { from: sq(1, 9), to: sq(2, 7) } })
  assert.equal((await rejected)?.payload.code, 'GAME_NOT_PLAYING')
})

test('identity: a guest cannot claim an account id', async () => {
  const guest = await client()
  let r = firstOf(guest, ['room_error', 'room_created'])
  guest.emit('create_room', { playerId: `u:${X.id}` })
  r = await r
  assert.equal(r?.event, 'room_error')
  assert.equal(r.payload.code, 'INVALID_PLAYER_ID')

  r = firstOf(guest, ['room_error', 'quick_play_queued', 'match_found'])
  guest.emit('quick_play', { playerId: `u:${X.id}` })
  r = await r
  assert.equal(r?.event, 'room_error')
  assert.equal(r.payload.code, 'INVALID_PLAYER_ID')
})

test("identity: a seat can't be hijacked; its owner can still resume it", async () => {
  // X claims to be Y when creating: the server seats X as X anyway.
  const x1 = await client(X)
  let r = firstOf(x1, ['room_created', 'room_error'])
  x1.emit('create_room', { playerId: `u:${Y.id}` })
  r = await r
  assert.equal(r?.event, 'room_created')
  const roomId = r.payload.roomId
  const resumeEvents = ['rejoin_failed', 'game_state', 'room_joined', 'room_rejoined', 'room_state']

  const y = await client(Y)
  r = firstOf(y, resumeEvents)
  y.emit('rejoin_room', { roomId, playerId: `u:${X.id}` })
  assert.equal((await r)?.event, 'rejoin_failed', 'another account took X’s seat')

  const guest = await client()
  r = firstOf(guest, resumeEvents)
  guest.emit('rejoin_room', { roomId, playerId: `u:${X.id}` })
  assert.equal((await r)?.event, 'rejoin_failed', 'a guest took X’s seat')

  const x2 = await client(X)
  r = firstOf(x2, resumeEvents)
  x2.emit('rejoin_room', { roomId, playerId: 'ignored-anything' })
  r = await r
  assert.ok(r && r.event !== 'rejoin_failed', 'X could not resume their own seat')
})

test('identity: a guest with a normal random id can still play', async () => {
  const guest = await client()
  const r = firstOf(guest, ['room_created', 'room_error'])
  guest.emit('create_room', { playerId: '3f2b8c1e-1a2b-4c3d-9e8f-0123456789ab' })
  assert.equal((await r)?.event, 'room_created')
})

test('quick play: two waiting players are matched', async () => {
  const a = await client()
  const b = await client()
  const queued = firstOf(a, ['quick_play_queued', 'match_found'])
  a.emit('quick_play', { playerId: guestId('qa') })
  assert.equal((await queued)?.event, 'quick_play_queued')
  const found = Promise.all([firstOf(a, ['match_found']), firstOf(b, ['match_found'])])
  b.emit('quick_play', { playerId: guestId('qb') })
  const [fa, fb] = await found
  assert.ok(fa && fb, 'not both players got match_found')
  assert.equal(fa.payload.roomId, fb.payload.roomId)
})

// --- session revocation ------------------------------------------------------
// Token versions live in memory in this test server (fakeTokenVersionStore.js);
// every account id starts at version 0. Each test uses its own account id,
// since a revoke here is permanent for the server's lifetime.

const tokenFor = (user, tokenVersion = 0) => signAccessToken({ ...user, tokenVersion })

function logoutAll(token, body = {}) {
  return fetch(`${server.url}/api/auth/logout-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json() }))
}

// Connects with a raw token and records every session_ended received,
// including one sent right on connect.
async function clientWithToken(token) {
  const ended = []
  const socket = await connect(server.url, token ? { token } : {}, (s) =>
    s.on('session_ended', (payload) => ended.push(payload))
  )
  sockets.push(socket)
  return { socket, ended }
}

function waitFor(socket, event, ms = 2000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve({ payload })
    })
  })
}

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

test('revocation: a token from before the revoke connects as a guest and is told TOKEN_REVOKED', async () => {
  const Z = { id: 900101, username: 'test_z' }
  const oldToken = tokenFor(Z, 0)

  // Before the revoke: an account socket, no session_ended.
  const before = await clientWithToken(oldToken)
  let r = firstOf(before.socket, ['room_created', 'room_error'])
  before.socket.emit('create_room', { playerId: 'ignored' })
  assert.equal((await r)?.event, 'room_created')
  assert.deepEqual(before.ended, [])

  assert.equal((await logoutAll(oldToken)).status, 200)

  const after = await clientWithToken(oldToken)
  await settle()
  assert.deepEqual(after.ended, [{ code: 'TOKEN_REVOKED' }])
  // ...and it acts as a guest: it can't claim the account's identity.
  r = firstOf(after.socket, ['room_created', 'room_error'])
  after.socket.emit('create_room', { playerId: `u:${Z.id}` })
  r = await r
  assert.equal(r?.event, 'room_error')
  assert.equal(r.payload.code, 'INVALID_PLAYER_ID')

  // A fresh login (new version) is a normal account socket again.
  const fresh = await clientWithToken(tokenFor(Z, 1))
  await settle()
  assert.deepEqual(fresh.ended, [])
})

test('revocation: an expired or forged token on connect is told so, and is a guest', async () => {
  const jwt = require('jsonwebtoken')
  const expired = jwt.sign({ userId: 900102, username: 'test_e', tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 })
  const a = await clientWithToken(expired)
  const b = await clientWithToken('not-a-jwt')
  const guest = await clientWithToken(null)
  await settle()
  assert.deepEqual(a.ended, [{ code: 'TOKEN_EXPIRED' }])
  assert.deepEqual(b.ended, [{ code: 'INVALID_TOKEN' }])
  assert.deepEqual(guest.ended, [], 'a plain guest is never told its session ended')
})

test('revocation: logout-all ends every open socket of that account, and only that account', async () => {
  const A = { id: 900103, username: 'test_a' }
  const B = { id: 900104, username: 'test_b' }
  const tokenA = tokenFor(A)
  const deviceA1 = await clientWithToken(tokenA)
  const deviceA2 = await clientWithToken(tokenA)
  const deviceB = await clientWithToken(tokenFor(B))

  const kicked = Promise.all([waitFor(deviceA1.socket, 'disconnect'), waitFor(deviceA2.socket, 'disconnect')])
  // Naming the other account in the body changes nothing.
  const res = await logoutAll(tokenA, { userId: B.id })
  assert.equal(res.status, 200)
  const [d1, d2] = await kicked
  assert.equal(d1?.payload, 'io server disconnect')
  assert.equal(d2?.payload, 'io server disconnect')
  assert.deepEqual(deviceA1.ended, [{ code: 'TOKEN_REVOKED' }], 'session_ended must arrive before the disconnect')
  assert.deepEqual(deviceA2.ended, [{ code: 'TOKEN_REVOKED' }])

  await settle()
  assert.equal(deviceB.socket.connected, true, "the other account's socket was touched")
  assert.deepEqual(deviceB.ended, [])

  // The revoked token can't call logout-all (or anything) again.
  const again = await logoutAll(tokenA)
  assert.equal(again.status, 401)
  assert.equal(again.body.code, 'TOKEN_REVOKED')
  // B's session still works.
  assert.equal((await logoutAll(tokenFor(B))).status, 200)
})

test('revocation mid-match: grace period starts; the revoked device cannot resume, a fresh login can', async () => {
  const M = { id: 900105, username: 'test_m' }
  const oldToken = tokenFor(M, 0)
  const device = await clientWithToken(oldToken)
  const opponent = await client()

  let r = firstOf(device.socket, ['room_created', 'room_error'])
  device.socket.emit('create_room', { playerId: 'ignored' })
  r = await r
  assert.equal(r?.event, 'room_created')
  const roomId = r.payload.roomId
  const started = Promise.all([firstOf(device.socket, ['game_started']), firstOf(opponent, ['game_started'])])
  opponent.emit('join_room', { roomId, playerId: guestId('opp') })
  assert.ok((await started).every(Boolean), 'game did not start')

  const opponentNotified = firstOf(opponent, ['opponent_disconnected', 'game_over'], 3000)
  const kicked = waitFor(device.socket, 'disconnect')
  assert.equal((await logoutAll(oldToken)).status, 200)
  assert.equal((await kicked)?.payload, 'io server disconnect')
  const notified = await opponentNotified
  assert.equal(notified?.event, 'opponent_disconnected', 'the match must enter the reconnect grace period, not end')

  const resumeEvents = ['rejoin_failed', 'game_state']

  // The revoked device reconnects with its old token: a guest, so it can't take the seat back.
  const revokedDevice = await clientWithToken(oldToken)
  r = firstOf(revokedDevice.socket, resumeEvents)
  revokedDevice.socket.emit('rejoin_room', { roomId, playerId: `u:${M.id}` })
  assert.equal((await r)?.event, 'rejoin_failed')
  r = firstOf(revokedDevice.socket, ['room_error', 'room_joined', 'game_state'])
  revokedDevice.socket.emit('join_room', { roomId, playerId: `u:${M.id}` })
  assert.notEqual((await r)?.event, 'game_state', 'the revoked device got its seat back')

  // The owner signs in again (new token, version 1) within the grace period: back in the game.
  const freshLogin = await clientWithToken(tokenFor(M, 1))
  const opponentSeesReturn = firstOf(opponent, ['opponent_reconnected'])
  r = firstOf(freshLogin.socket, resumeEvents)
  freshLogin.socket.emit('rejoin_room', { roomId, playerId: 'ignored' })
  r = await r
  assert.equal(r?.event, 'game_state', 'the account owner could not resume after logging in again')
  assert.equal(r.payload.matchResult ?? null, null, 'the match should still be in progress')
  assert.equal((await opponentSeesReturn)?.event, 'opponent_reconnected')
})
