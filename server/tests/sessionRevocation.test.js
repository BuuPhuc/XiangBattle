// Session revocation, in-process and without a database: the real check
// (sessionService.authenticateToken) and the real middleware / controller,
// run against an in-memory token-version store.
//
// Covers: a token at the account's current version passes; an older one is
// refused as TOKEN_REVOKED by requireAuth and treated as a guest by
// optionalAuth; a token from before `tv` existed counts as version 0;
// expired / invalid / deleted-account tokens keep their own codes; a
// database failure is a 503, never a sign-out; revokeAllSessions only bumps
// the given account and kicks its sockets; logout-all acts on the caller's
// own account whatever id the request carries; the test-only store can
// never be loaded by the real server.
process.env.JWT_SECRET ||= 'test-secret-for-session-revocation'
const fs = require('node:fs')
const path = require('node:path')
const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const sessionService = require('../services/sessionService')
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware')
const { signAccessToken } = require('../utils/token')
const { memoryStore, fakeRes, runMiddleware: run } = require('./helpers/authTestUtils')

const { authenticateToken, revokeAllSessions, setTokenVersionStore } = sessionService
const SECRET = process.env.JWT_SECRET
const ALICE = { id: 7, username: 'alice' }
const BOB = { id: 8, username: 'bob' }

afterEach(() => {
  setTokenVersionStore(null)
  sessionService.attachIo(null)
})

const tokenAt = (user, tokenVersion) => signAccessToken({ ...user, tokenVersion })
// What every token issued before this feature looks like: no `tv` claim.
const legacyToken = (user) => jwt.sign({ userId: user.id, username: user.username }, SECRET, { expiresIn: '7d' })

// --- the check itself -------------------------------------------------------

test('authenticateToken: current version passes, older is TOKEN_REVOKED', async () => {
  setTokenVersionStore(memoryStore({ 7: 2 }))
  const ok = await authenticateToken(tokenAt(ALICE, 2))
  assert.equal(ok.code, undefined)
  assert.equal(ok.payload.userId, 7)
  assert.equal(ok.payload.tv, 2)

  for (const old of [0, 1]) {
    assert.deepEqual(await authenticateToken(tokenAt(ALICE, old)), { code: 'TOKEN_REVOKED' })
  }
})

test('authenticateToken: a token without `tv` (issued before this feature) counts as version 0', async () => {
  setTokenVersionStore(memoryStore({ 7: 0 }))
  const ok = await authenticateToken(legacyToken(ALICE))
  assert.equal(ok.payload.userId, 7, 'a pre-existing session must keep working after the rollout')

  setTokenVersionStore(memoryStore({ 7: 1 }))
  assert.deepEqual(await authenticateToken(legacyToken(ALICE)), { code: 'TOKEN_REVOKED' }, 'revoke must cover legacy tokens too')
})

test('authenticateToken: expired, forged, malformed and deleted-account tokens keep distinct codes', async () => {
  const store = memoryStore({ 7: 0 })
  setTokenVersionStore(store)
  const expired = jwt.sign({ userId: 7, username: 'alice', tv: 0 }, SECRET, { expiresIn: -10 })
  const forged = jwt.sign({ userId: 7, username: 'alice', tv: 0 }, 'not-our-secret')
  const badTv = jwt.sign({ userId: 7, username: 'alice', tv: 'zero' }, SECRET)
  const noUser = jwt.sign({ username: 'alice', tv: 0 }, SECRET)

  assert.deepEqual(await authenticateToken(expired), { code: 'TOKEN_EXPIRED' })
  assert.deepEqual(await authenticateToken(forged), { code: 'INVALID_TOKEN' })
  assert.deepEqual(await authenticateToken('not-a-jwt'), { code: 'INVALID_TOKEN' })
  assert.deepEqual(await authenticateToken(badTv), { code: 'INVALID_TOKEN' })
  assert.deepEqual(await authenticateToken(noUser), { code: 'INVALID_TOKEN' })
  assert.deepEqual(await authenticateToken(tokenAt({ id: 99, username: 'gone' }, 0)), { code: 'INVALID_TOKEN' })
  // Bad signatures / expiry are decided before the store is ever consulted.
  assert.deepEqual(store.calls.get, [99])
})

test('authenticateToken: a database failure rejects instead of producing a code', async () => {
  setTokenVersionStore(memoryStore({ 7: 0 }, { failing: true }))
  await assert.rejects(authenticateToken(tokenAt(ALICE, 0)), /database unreachable/)
})

// --- requireAuth / optionalAuth ---------------------------------------------

test('requireAuth: current version → next(); older → 401 TOKEN_REVOKED', async () => {
  setTokenVersionStore(memoryStore({ 7: 1 }))
  const ok = await run(requireAuth, `Bearer ${tokenAt(ALICE, 1)}`)
  assert.equal(ok.nextCalled, true)
  assert.equal(ok.req.auth.userId, 7)

  for (const header of [`Bearer ${tokenAt(ALICE, 0)}`, `Bearer ${legacyToken(ALICE)}`]) {
    const { res, nextCalled } = await run(requireAuth, header)
    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 401)
    assert.equal(res.body.code, 'TOKEN_REVOKED')
    assert.match(res.body.message, /thu hồi/)
  }
})

test('requireAuth: expired and invalid tokens keep TOKEN_EXPIRED / INVALID_TOKEN', async () => {
  setTokenVersionStore(memoryStore({ 7: 0 }))
  const expired = jwt.sign({ userId: 7, username: 'alice', tv: 0 }, SECRET, { expiresIn: -10 })
  assert.equal((await run(requireAuth, `Bearer ${expired}`)).res.body.code, 'TOKEN_EXPIRED')
  assert.equal((await run(requireAuth, 'Bearer garbage')).res.body.code, 'INVALID_TOKEN')
  assert.equal((await run(requireAuth)).res.body.code, 'UNAUTHORIZED')
})

test('requireAuth: database failure → 503, not a 401 that would sign the user out', async () => {
  setTokenVersionStore(memoryStore({ 7: 0 }, { failing: true }))
  const { res, nextCalled } = await run(requireAuth, `Bearer ${tokenAt(ALICE, 0)}`)
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 503)
  assert.equal(res.body.code, 'SERVICE_UNAVAILABLE')
})

test('optionalAuth: a revoked token is a guest — request continues, no 401', async () => {
  setTokenVersionStore(memoryStore({ 7: 3 }))
  const current = await run(optionalAuth, `Bearer ${tokenAt(ALICE, 3)}`)
  assert.equal(current.req.auth.userId, 7)

  for (const header of [`Bearer ${tokenAt(ALICE, 2)}`, `Bearer ${legacyToken(ALICE)}`]) {
    const { req, res, nextCalled } = await run(optionalAuth, header)
    assert.equal(nextCalled, true)
    assert.equal(req.auth, undefined)
    assert.equal(res.statusCode, 200)
  }

  setTokenVersionStore(memoryStore({ 7: 3 }, { failing: true }))
  const down = await run(optionalAuth, `Bearer ${tokenAt(ALICE, 3)}`)
  assert.equal(down.nextCalled, true, 'the public leaderboard must not break when the check fails')
  assert.equal(down.req.auth, undefined)
})

// --- revokeAllSessions -------------------------------------------------------

function fakeIo() {
  const log = []
  return {
    log,
    to: (room) => ({ emit: (event, payload) => log.push(['emit', room, event, payload]) }),
    in: (room) => ({ disconnectSockets: (close) => log.push(['disconnect', room, close]) }),
  }
}

test('revokeAllSessions: bumps only that account, then tells and disconnects its sockets', async () => {
  const store = memoryStore({ 7: 0, 8: 0 })
  setTokenVersionStore(store)
  const io = fakeIo()
  sessionService.attachIo(io)
  const aliceBefore = tokenAt(ALICE, 0)
  const bobToken = tokenAt(BOB, 0)

  assert.equal(await revokeAllSessions(7), true)
  assert.equal(store.versionOf(7), 1)
  assert.equal(store.versionOf(8), 0)
  assert.deepEqual(io.log, [
    ['emit', 'user:7', 'session_ended', { code: 'TOKEN_REVOKED' }],
    ['disconnect', 'user:7', true],
  ])

  assert.deepEqual(await authenticateToken(aliceBefore), { code: 'TOKEN_REVOKED' })
  assert.equal((await authenticateToken(bobToken)).payload.userId, 8, "another account's session must survive")
  // A login after the revoke signs with the new version and works.
  assert.equal((await authenticateToken(tokenAt(ALICE, 1))).payload.userId, 7)
})

test('revokeAllSessions: unknown account → false, nothing emitted', async () => {
  setTokenVersionStore(memoryStore({ 7: 0 }))
  const io = fakeIo()
  sessionService.attachIo(io)
  assert.equal(await revokeAllSessions(404), false)
  assert.deepEqual(io.log, [])
})

// --- POST /api/auth/logout-all ------------------------------------------------

// Runs the real route stack (requireAuth, then the controller) for the
// given token and request body/query/params.
async function callLogoutAll(token, extra = {}) {
  const { logoutAll } = require('../controllers/authController')
  const res = fakeRes()
  const req = { headers: { authorization: `Bearer ${token}` }, body: {}, query: {}, params: {}, ...extra }
  let passed = false
  await requireAuth(req, res, () => {
    passed = true
  })
  if (passed) await logoutAll(req, res)
  return res
}

test("logout-all: revokes the caller's own sessions, ignoring any id the client sends", async () => {
  const store = memoryStore({ 7: 0, 8: 0 })
  setTokenVersionStore(store)
  sessionService.attachIo(fakeIo())

  const res = await callLogoutAll(tokenAt(ALICE, 0), {
    body: { userId: 8, id: 8 },
    query: { userId: '8' },
    params: { userId: '8' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.deepEqual(store.calls.bump, [7], 'only the signed-in account may be revoked')
  assert.equal(store.versionOf(7), 1)
  assert.equal(store.versionOf(8), 0)
})

test('logout-all: requires a live session (no token / revoked token → 401, nothing bumped)', async () => {
  const store = memoryStore({ 7: 1 })
  setTokenVersionStore(store)

  const revoked = await callLogoutAll(tokenAt(ALICE, 0))
  assert.equal(revoked.statusCode, 401)
  assert.equal(revoked.body.code, 'TOKEN_REVOKED')

  const { res } = await run(requireAuth)
  assert.equal(res.statusCode, 401)
  assert.deepEqual(store.calls.bump, [])
})

test('logout-all is registered as POST /logout-all behind requireAuth', () => {
  const router = require('../routes/authRoutes')
  const layer = router.stack.find((l) => l.route && l.route.path === '/logout-all')
  assert.ok(layer, 'route missing')
  assert.deepEqual(Object.keys(layer.route.methods), ['post'])
  assert.equal(layer.route.stack[0].handle, requireAuth)
})

// --- the test-only store stays test-only ---------------------------------------

test('fakeTokenVersionStore is never loaded by the real server', () => {
  const serverDir = path.resolve(__dirname, '..')
  for (const file of ['server.js', 'package.json', path.join('services', 'sessionService.js')]) {
    const source = fs.readFileSync(path.join(serverDir, file), 'utf8')
    assert.doesNotMatch(source, /require\([^)]*fakeTokenVersionStore/, `${file} loads the fake store`)
    if (file !== path.join('services', 'sessionService.js')) {
      assert.doesNotMatch(source, /fakeTokenVersionStore/, `${file} mentions the fake store`)
    }
  }
  const previous = process.env.XIANGBATTLE_FAKE_TOKEN_STORE
  delete process.env.XIANGBATTLE_FAKE_TOKEN_STORE
  try {
    assert.throws(() => require('./helpers/fakeTokenVersionStore'), /test helper/)
  } finally {
    if (previous !== undefined) process.env.XIANGBATTLE_FAKE_TOKEN_STORE = previous
  }
})
